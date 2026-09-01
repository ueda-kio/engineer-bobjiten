/**
 * One room, as a Durable Object (tech selection 1, 5.1-5.3).
 *
 * The object holds every connection for a room code, which is what lets it send
 * a different payload to each of them — the requirement design 7.2 turns on.
 *
 * No game rule is decided here. Every branch below picks which pure function to
 * call and where to put the result; the answers come from `authorizeJoin`,
 * `canPerform`, `canReleaseSeat`, `reduceSession` and `payloadFor`.
 */

import { DurableObject } from "cloudflare:workers";
import { TOPICS } from "../src/data/topics";
import {
  authorizeJoin,
  createRegistry,
  disconnect,
  releaseSeat,
  type ConnectionRegistry,
} from "../src/domain/connection";
import { payloadFor } from "../src/domain/payload";
import { canPerform, canReleaseSeat } from "../src/domain/permissions";
import { defaultRng } from "../src/domain/rng";
import {
  createSession,
  reduceSession,
  type SessionDeps,
  type SessionState,
} from "../src/domain/session";
import type { ClientMessage, ServerMessage } from "../src/sync/protocol";
import { parseClientMessage } from "./parse";

const DEPS: SessionDeps = { topics: TOPICS, rng: defaultRng };

/** The whole room as one record, per tech selection 5.2. */
type RoomSnapshot = {
  state: SessionState;
  registry: ConnectionRegistry;
};

/**
 * Per-connection metadata that survives hibernation.
 *
 * Kept on the socket rather than in a field: hibernation discards memory, and
 * the room must still know which player each waking socket belongs to.
 */
type Attachment = {
  connectionId: string;
  /** Null until the connection has joined. */
  playerId: string | null;
};

const SNAPSHOT_KEY = "room";

export class Room extends DurableObject<Env> {
  #snapshot: RoomSnapshot = { state: createSession(), registry: createRegistry() };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Every wake-up runs the constructor again, so the snapshot is read back
    // before any handler can observe an empty room.
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<RoomSnapshot>(SNAPSHOT_KEY);
      if (stored) this.#snapshot = stored;
    });
  }

  override async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected a websocket upgrade", { status: 426 });
    }

    const pair = new WebSocketPair();
    // Hibernatable: the runtime may unload this object between messages.
    this.ctx.acceptWebSocket(pair[1]);
    setAttachment(pair[1], { connectionId: crypto.randomUUID(), playerId: null });

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  override async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    const message = parseClientMessage(raw);
    if (!message) return send(ws, { type: "error", message: "could not read the message" });

    await this.#handle(ws, message);
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    await this.#dropConnection(ws);
  }

  override async webSocketError(ws: WebSocket): Promise<void> {
    await this.#dropConnection(ws);
  }

  async #handle(ws: WebSocket, message: ClientMessage): Promise<void> {
    const attachment = getAttachment(ws);
    if (message.type === "join") return this.#join(ws, attachment, message);

    // Everything else needs a seat: who is acting comes from the connection,
    // never from the message, so a client cannot name somebody else as actor.
    const actorId = attachment.playerId;
    if (actorId === null) return send(ws, { type: "error", message: "join first" });

    if (message.type === "releaseSeat") {
      if (!canReleaseSeat(this.#snapshot.state, actorId, message.playerId)) {
        return send(ws, { type: "denied", operation: "releaseSeat" });
      }

      const released = releaseSeat(this.#snapshot.registry, message.playerId);
      this.#snapshot = { ...this.#snapshot, registry: released.registry };
      await this.#save();
      if (released.displaced !== null) this.#closeConnection(released.displaced);
      return this.#broadcast();
    }

    const { action } = message;
    // Registration goes through `join` alone, so identity is settled in one
    // place and a seat always exists for anybody on the roster.
    if (action.type === "addPlayer") return send(ws, { type: "denied", operation: "addPlayer" });

    if (!canPerform(this.#snapshot.state, action, actorId)) {
      return send(ws, { type: "denied", operation: action.type });
    }

    this.#snapshot = {
      ...this.#snapshot,
      state: reduceSession(this.#snapshot.state, action, DEPS),
    };
    await this.#save();
    this.#broadcast();
  }

  async #join(
    ws: WebSocket,
    attachment: Attachment,
    message: Extract<ClientMessage, { type: "join" }>,
  ): Promise<void> {
    const { state, registry } = this.#snapshot;

    const outcome = authorizeJoin(
      registry,
      {
        connectionId: attachment.connectionId,
        ...(message.token === undefined ? {} : { token: message.token }),
        ...(message.claimPlayerId === undefined ? {} : { claimPlayerId: message.claimPlayerId }),
      },
      {
        acceptsNewPlayers: state.phase === "lobby",
        newId: () => crypto.randomUUID(),
      },
    );

    if (outcome.kind === "rejected") {
      send(ws, { type: "rejected", reason: outcome.reason });
      return ws.close(1008, outcome.reason);
    }

    // Only a brand new seat joins the roster. A reseated player is already on
    // it, and taking the name they submitted would let whoever sits down rename
    // the player whose score the seat still carries.
    this.#snapshot = {
      registry: outcome.registry,
      state:
        outcome.kind === "created"
          ? reduceSession(
              state,
              { type: "addPlayer", id: outcome.playerId, name: message.name },
              DEPS,
            )
          : state,
    };
    setAttachment(ws, { ...attachment, playerId: outcome.playerId });
    await this.#save();

    // The token reaches the connection it was issued for and nothing else: it
    // never appears in a payload (design 7.2).
    if (outcome.kind === "resumed") {
      if (outcome.displaced !== null) this.#closeConnection(outcome.displaced);
      send(ws, {
        type: "joined",
        outcome: "resumed",
        playerId: outcome.playerId,
        payload: this.#payloadFor(outcome.playerId),
      });
    } else {
      send(ws, {
        type: "joined",
        outcome: outcome.kind,
        playerId: outcome.playerId,
        token: outcome.token,
        payload: this.#payloadFor(outcome.playerId),
      });
    }

    this.#broadcast();
  }

  async #dropConnection(ws: WebSocket): Promise<void> {
    const { connectionId } = getAttachment(ws);
    // A socket that was already displaced holds no seat, so its late close
    // changes nothing and nobody needs telling.
    const seated = this.#snapshot.registry.seats.some((seat) => seat.connectionId === connectionId);
    if (!seated) return;

    this.#snapshot = {
      ...this.#snapshot,
      registry: disconnect(this.#snapshot.registry, connectionId),
    };
    await this.#save();
    this.#broadcast();
  }

  /** Sends everyone their own view of the room. */
  #broadcast(): void {
    for (const ws of this.ctx.getWebSockets()) {
      const { playerId } = getAttachment(ws);
      if (playerId === null) continue;
      send(ws, { type: "state", payload: this.#payloadFor(playerId) });
    }
  }

  #payloadFor(playerId: string) {
    return payloadFor(this.#snapshot.state, this.#snapshot.registry, playerId);
  }

  #closeConnection(connectionId: string): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (getAttachment(ws).connectionId === connectionId) ws.close(1000, "replaced");
    }
  }

  async #save(): Promise<void> {
    await this.ctx.storage.put(SNAPSHOT_KEY, this.#snapshot);
  }
}

const send = (ws: WebSocket, message: ServerMessage): void => ws.send(JSON.stringify(message));

const setAttachment = (ws: WebSocket, attachment: Attachment): void =>
  ws.serializeAttachment(attachment);

const getAttachment = (ws: WebSocket): Attachment => ws.deserializeAttachment() as Attachment;
