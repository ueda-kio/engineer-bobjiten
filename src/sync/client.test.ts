import { describe, expect, it } from "vitest";
import { createRegistry } from "../domain/connection";
import { toPublicPayload } from "../domain/payload";
import { createSession, reduceSession, type SessionDeps } from "../domain/session";
import {
  createConnectionState,
  nextStoredToken,
  reconnectDelay,
  reduceConnection,
  type ClientConnectionState,
  type ConnectionEvent,
} from "./client";
import type { JoinedMessage, ServerMessage } from "./protocol";

const deps: SessionDeps = { topics: [], rng: () => 0 };

const PAYLOAD = toPublicPayload(createSession(), createRegistry());
const LATER_PAYLOAD = toPublicPayload(
  reduceSession(createSession(), { type: "addPlayer", id: "p1", name: "p1" }, deps),
  createRegistry(),
);

const JOINED: ServerMessage = {
  type: "joined",
  outcome: "created",
  playerId: "p1",
  token: "秘密トークン",
  payload: PAYLOAD,
};

const run = (state: ClientConnectionState, events: ConnectionEvent[]): ClientConnectionState =>
  events.reduce(reduceConnection, state);

/** Connected, joined, and holding a seat. */
const joined = (): ClientConnectionState =>
  run(createConnectionState(), [{ type: "opened" }, { type: "received", message: JOINED }]);

const disconnectedTimes = (state: ClientConnectionState, times: number): ClientConnectionState =>
  run(
    state,
    Array.from({ length: times }, () => ({ type: "disconnected" }) as const),
  );

describe("reduceConnection", () => {
  describe("正常系", () => {
    describe("joined を受け取ったとき", () => {
      it("参加済みになり、自分の playerId と payload が保持されること", () => {
        expect(joined()).toMatchObject({
          status: { kind: "joined", playerId: "p1" },
          payload: PAYLOAD,
          seated: true,
        });
      });
    });

    describe("state を受け取ったとき", () => {
      it("payload が差し替わること", () => {
        const state = run(joined(), [
          { type: "received", message: { type: "state", payload: LATER_PAYLOAD } },
        ]);

        expect(state.payload).toEqual(LATER_PAYLOAD);
      });
    });

    describe("切断されたとき", () => {
      it("再接続待ちになり、切断のたびに試行回数が増えること", () => {
        const once = disconnectedTimes(joined(), 1);
        const twice = disconnectedTimes(joined(), 2);

        expect(once.status).toEqual({ kind: "reconnecting", attempt: 0 });
        expect(twice.status).toEqual({ kind: "reconnecting", attempt: 1 });
      });
    });

    describe("再接続して接続が開いたとき", () => {
      it("試行回数が 0 に戻ること", () => {
        const reopened = run(disconnectedTimes(joined(), 3), [{ type: "opened" }]);

        expect(reopened.status).toEqual({ kind: "joining" });
        expect(disconnectedTimes(reopened, 1).status).toEqual({
          kind: "reconnecting",
          attempt: 0,
        });
      });
    });
  });

  describe("異常系", () => {
    describe("rejected を受け取ったとき", () => {
      it("seatAmbiguous なら席の選択待ちに、それ以外なら拒否として終わること", () => {
        const ambiguous = run(joined(), [
          { type: "received", message: { type: "rejected", reason: "seatAmbiguous" } },
        ]);
        const refused = run(joined(), [
          { type: "received", message: { type: "rejected", reason: "newPlayersNotAccepted" } },
        ]);

        expect(ambiguous.status).toEqual({ kind: "choosingSeat" });
        expect(refused.status).toEqual({
          kind: "rejected",
          reason: "newPlayersNotAccepted",
        });
      });
    });

    describe("denied や error を受け取ったとき", () => {
      it("payload が保持され、通知だけが載ること", () => {
        const denied = run(joined(), [
          { type: "received", message: { type: "denied", operation: "redraw" } },
        ]);
        const errored = run(joined(), [
          { type: "received", message: { type: "error", message: "読めません" } },
        ]);

        expect(denied).toMatchObject({
          payload: PAYLOAD,
          status: { kind: "joined" },
          notice: { kind: "denied", operation: "redraw" },
        });
        expect(errored).toMatchObject({
          payload: PAYLOAD,
          notice: { kind: "error", message: "読めません" },
        });
      });
    });
  });

  describe("境界値", () => {
    describe("拒否・席選択待ち・打ち切りの状態で切断されたとき", () => {
      it("自動では再接続せず、明示的な再接続でのみ再開すること", () => {
        const settled = [
          run(joined(), [
            { type: "received", message: { type: "rejected", reason: "seatUnavailable" } },
          ]),
          run(joined(), [
            { type: "received", message: { type: "rejected", reason: "seatAmbiguous" } },
          ]),
        ];

        expect(settled.map((state) => disconnectedTimes(state, 1).status)).toEqual(
          settled.map((state) => state.status),
        );
        expect(settled.map((state) => run(state, [{ type: "reconnect" }]).status)).toEqual([
          { kind: "connecting" },
          { kind: "connecting" },
        ]);
      });
    });

    describe("再試行の上限に達したとき", () => {
      it("諦めた状態になり、席が残っていることが伝わること", () => {
        const exhausted = disconnectedTimes(joined(), attemptsUntilGiveUp() + 1);
        const neverJoined = disconnectedTimes(createConnectionState(), attemptsUntilGiveUp() + 1);

        expect(exhausted.status).toEqual({ kind: "gaveUp", rejoinable: true });
        expect(neverJoined.status).toEqual({ kind: "gaveUp", rejoinable: false });
      });
    });
  });
});

/** How many attempts `reconnectDelay` allows before it returns null. */
const attemptsUntilGiveUp = (): number => {
  let attempt = 0;
  while (reconnectDelay(attempt) !== null) attempt += 1;
  return attempt;
};

describe("reconnectDelay", () => {
  describe("正常系", () => {
    describe("最初の再接続のとき", () => {
      it("短い間隔で試みること", () => {
        expect(reconnectDelay(0)).toBeLessThanOrEqual(1000);
      });
    });

    describe("試行を重ねたとき", () => {
      it("間隔が倍増していくこと", () => {
        expect(reconnectDelay(1)).toBe((reconnectDelay(0) ?? 0) * 2);
        expect(reconnectDelay(2)).toBe((reconnectDelay(1) ?? 0) * 2);
      });
    });
  });

  describe("境界値", () => {
    describe("間隔が上限に達したあと", () => {
      it("頭打ちになり、それ以上増えないこと", () => {
        expect(reconnectDelay(20)).toBe(reconnectDelay(10));
      });
    });

    describe("打ち切りに達したとき", () => {
      it("null が返り、それまでに30分以上ねばること", () => {
        const attempts = attemptsUntilGiveUp();
        const total = Array.from(
          { length: attempts },
          (_, attempt) => reconnectDelay(attempt) ?? 0,
        ).reduce((sum, delay) => sum + delay, 0);

        expect(reconnectDelay(attempts)).toBeNull();
        // A trip to the bathroom, a smoke, a phone call outside, moving to the
        // second venue: the seat and its token outlive all of these, so the
        // client must not throw the way back away first (design 6.4, 6.7).
        expect(total).toBeGreaterThanOrEqual(30 * 60 * 1000);
      });
    });
  });
});

describe("nextStoredToken", () => {
  describe("正常系", () => {
    describe("新しいトークンが発行されたとき", () => {
      it("created でも reseated でもそのトークンが返ること", () => {
        const created: JoinedMessage = {
          type: "joined",
          outcome: "created",
          playerId: "p1",
          token: "新しいトークン",
          payload: PAYLOAD,
        };
        const reseated: JoinedMessage = { ...created, outcome: "reseated", token: "座り直し" };

        expect(nextStoredToken("古いトークン", created)).toBe("新しいトークン");
        expect(nextStoredToken("古いトークン", reseated)).toBe("座り直し");
      });
    });
  });

  describe("境界値", () => {
    describe("resumed でトークンが返らなかったとき", () => {
      it("保存済みのトークンがそのまま返ること", () => {
        const resumed: JoinedMessage = {
          type: "joined",
          outcome: "resumed",
          playerId: "p1",
          payload: PAYLOAD,
        };

        expect(nextStoredToken("使い続けるトークン", resumed)).toBe("使い続けるトークン");
      });
    });
  });
});
