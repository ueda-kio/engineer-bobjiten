import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { SessionAction } from "../../domain/session";
import {
  createConnectionState,
  nextStoredToken,
  reconnectDelay,
  reduceConnection,
} from "../../sync/client";
import type { ClientMessage, ServerMessage } from "../../sync/protocol";

type RoomConnection = {
  roomCode: string;
  name: string;
};

/**
 * Holds the socket to a room and turns it into React state.
 *
 * Wiring only: what each message means is decided by `reduceConnection`, how
 * long to wait before retrying by `reconnectDelay`, and which token to keep by
 * `nextStoredToken`. Nothing here judges any of that.
 */
export const useRoomConnection = ({ roomCode, name }: RoomConnection) => {
  const [state, dispatch] = useReducer(reduceConnection, undefined, createConnectionState);
  const [generation, setGeneration] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);
  /** Read through a ref so that renaming does not tear the socket down. */
  const nameRef = useRef(name);
  /** Set while answering `choosingSeat`; cleared once the join lands. */
  const claimRef = useRef<string | null>(null);

  useEffect(() => {
    nameRef.current = name;
  }, [name]);

  useEffect(() => {
    const socket = new WebSocket(socketUrl(roomCode));
    socketRef.current = socket;
    let closedByUs = false;

    socket.addEventListener("open", () => {
      dispatch({ type: "opened" });
      // The stored token is read here, on every attempt, rather than kept in a
      // ref: presenting a stale one would land us in somebody else's seat, and
      // presenting none at all is refused outright once the game has started.
      const token = readToken(roomCode);
      const claimPlayerId = claimRef.current;
      socket.send(
        JSON.stringify({
          type: "join",
          name: nameRef.current,
          ...(token === null ? {} : { token }),
          ...(claimPlayerId === null ? {} : { claimPlayerId }),
        } satisfies ClientMessage),
      );
    });

    socket.addEventListener("message", (event) => {
      const message = parseServerMessage(event.data);
      if (message === null) return;

      if (message.type === "joined") {
        writeToken(roomCode, nextStoredToken(readToken(roomCode), message));
        claimRef.current = null;
      }
      dispatch({ type: "received", message });
    });

    socket.addEventListener("close", () => {
      if (!closedByUs) dispatch({ type: "disconnected" });
    });

    return () => {
      // Our own teardown is not a dropped connection, so it must not count as a
      // failed attempt.
      closedByUs = true;
      socketRef.current = null;
      socket.close();
    };
  }, [roomCode, generation]);

  useEffect(() => {
    if (state.status.kind !== "reconnecting") return;

    const delay = reconnectDelay(state.status.attempt);
    if (delay === null) return;

    const timer = setTimeout(() => setGeneration((current) => current + 1), delay);
    return () => clearTimeout(timer);
  }, [state.status]);

  const post = useCallback((message: ClientMessage): void => {
    const socket = socketRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  }, []);

  const reconnect = useCallback((): void => {
    dispatch({ type: "reconnect" });
    setGeneration((current) => current + 1);
  }, []);

  const send = useCallback(
    (action: SessionAction): void => post({ type: "action", action }),
    [post],
  );

  const releaseSeat = useCallback(
    (playerId: string): void => post({ type: "releaseSeat", playerId }),
    [post],
  );

  /** Answers `choosingSeat` by naming which free seat is ours (design 6.4). */
  const claimSeat = useCallback(
    (playerId: string): void => {
      claimRef.current = playerId;
      reconnect();
    },
    [reconnect],
  );

  return {
    status: state.status,
    payload: state.payload,
    notice: state.notice,
    send,
    releaseSeat,
    claimSeat,
    retry: reconnect,
  };
};

const socketUrl = (roomCode: string): string => {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws?room=${encodeURIComponent(roomCode)}`;
};

const tokenKey = (roomCode: string): string => `bobjiten:token:${roomCode}`;

/** Storage throws rather than returning null in a locked-down browser. */
const readToken = (roomCode: string): string | null => {
  try {
    return localStorage.getItem(tokenKey(roomCode));
  } catch {
    return null;
  }
};

const writeToken = (roomCode: string, token: string | null): void => {
  if (token === null) return;
  try {
    localStorage.setItem(tokenKey(roomCode), token);
  } catch {
    // Without storage the player simply cannot resume after a reload. Nothing
    // is gained by taking the room down over it.
  }
};

const parseServerMessage = (raw: unknown): ServerMessage | null => {
  if (typeof raw !== "string") return null;
  try {
    return JSON.parse(raw) as ServerMessage;
  } catch {
    return null;
  }
};
