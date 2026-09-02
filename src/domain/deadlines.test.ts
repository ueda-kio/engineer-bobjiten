import { describe, expect, it } from "vitest";
import { authorizeJoin, type ConnectionRegistry, type Seat } from "./connection";
import {
  createDeadlines,
  dueDeadlines,
  earliestDeadline,
  hostSuccessor,
  nextDeadlines,
  touchRoomLifetime,
  type Deadlines,
} from "./deadlines";
import type { Rng } from "./rng";
import { AWAY_GRACE_MS, ROOM_LIFETIME_MS } from "./rules";
import {
  createSession,
  reduceSession,
  type SessionAction,
  type SessionDeps,
  type SessionState,
} from "./session";
import type { Difficulty, Topic } from "./topic";

const topic = (id: string, difficulty: Difficulty): Topic => ({
  id,
  word: id,
  difficulty,
  category: "その他",
  relatedWords: ["あ", "い", "う"],
});

const TOPICS: Topic[] = [
  topic("a1", 1),
  topic("a2", 1),
  topic("b1", 2),
  topic("b2", 2),
  topic("c1", 3),
  topic("c2", 3),
];

const headRng: Rng = () => 0;
const deps: SessionDeps = { topics: TOPICS, rng: headRng };

const run = (state: SessionState, actions: SessionAction[]): SessionState =>
  actions.reduce((current, action) => reduceSession(current, action, deps), state);

/** p1 hosts and presents first. */
const JOINED: SessionAction[] = [
  { type: "addPlayer", id: "p1", name: "ホスト" },
  { type: "addPlayer", id: "p2", name: "参加者2" },
  { type: "addPlayer", id: "p3", name: "参加者3" },
];

const lobby = (): SessionState => run(createSession(), JOINED);
const picking = (): SessionState => run(lobby(), [{ type: "startGame" }]);
const presenting = (): SessionState => run(picking(), [{ type: "selectTopic", topicId: "b1" }]);
const revealed = (): SessionState =>
  run(presenting(), [{ type: "confirmAnswerer", playerId: "p2" }]);

const registryOf = (...seats: Seat[]): ConnectionRegistry => ({ seats });

const connected = (playerId: string, token: string, connectionId: string): Seat => ({
  playerId,
  token,
  connectionId,
});
const away = (playerId: string, token: string): Seat => ({
  playerId,
  token,
  connectionId: null,
});
const vacated = (playerId: string): Seat => ({ playerId, token: null, connectionId: null });

const NOW = 1_700_000_000_000;

const ALL_CONNECTED = registryOf(
  connected("p1", "t1", "c1"),
  connected("p2", "t2", "c2"),
  connected("p3", "t3", "c3"),
);

/** The presenter (p1) has dropped off; the others are still there. */
const PRESENTER_AWAY = registryOf(
  away("p1", "t1"),
  connected("p2", "t2", "c2"),
  connected("p3", "t3", "c3"),
);

const FRESH = createDeadlines(NOW);

describe("nextDeadlines", () => {
  describe("正常系", () => {
    describe("出題者が離脱しているとき", () => {
      it("猶予後の自動スキップ期限が、その出題者に紐づいて立つこと", () => {
        const deadlines = nextDeadlines(FRESH, presenting(), PRESENTER_AWAY, NOW);

        expect(deadlines.presenterSkip).toEqual({ at: NOW + AWAY_GRACE_MS, playerId: "p1" });
      });
    });

    describe("ホストが離脱していて、接続中の他の参加者がいるとき", () => {
      it("猶予後のホスト移譲期限が、そのホストに紐づいて立つこと", () => {
        const deadlines = nextDeadlines(FRESH, presenting(), PRESENTER_AWAY, NOW);

        expect(deadlines.hostHandover).toEqual({ at: NOW + AWAY_GRACE_MS, playerId: "p1" });
      });
    });

    describe("ルーム破棄の期限は", () => {
      it("操作の適用時にのみ更新され、切断や再計算では据え置かれること", () => {
        const recomputed = nextDeadlines(FRESH, presenting(), PRESENTER_AWAY, NOW + 60_000);
        const operated = touchRoomLifetime(FRESH, NOW + 60_000);

        expect(recomputed.roomExpiresAt).toBe(FRESH.roomExpiresAt);
        expect(operated.roomExpiresAt).toBe(NOW + 60_000 + ROOM_LIFETIME_MS);
      });
    });
  });

  describe("異常系", () => {
    describe("離脱していた出題者が復帰したとき", () => {
      it("自動スキップ期限が解除されること", () => {
        const pending: Deadlines = {
          ...FRESH,
          presenterSkip: { at: NOW + AWAY_GRACE_MS, playerId: "p1" },
        };

        const deadlines = nextDeadlines(pending, presenting(), ALL_CONNECTED, NOW + 60_000);

        expect(deadlines.presenterSkip).toBeNull();
      });
    });

    describe("離脱していたホストが復帰したとき", () => {
      it("移譲期限が解除されるだけで、ホストは元のままであること", () => {
        const state = presenting();
        const pending: Deadlines = {
          ...FRESH,
          hostHandover: { at: NOW + AWAY_GRACE_MS, playerId: "p1" },
        };
        // Reconnects through the real join path, so that a future change to it
        // handing the role back would fail here (design 6.6).
        const rejoined = authorizeJoin(
          PRESENTER_AWAY,
          { connectionId: "c9", token: "t1" },
          { acceptsNewPlayers: false, newId: () => "unused" },
        );
        if (rejoined.kind !== "resumed") throw new Error(`resumed のはずが ${rejoined.kind}`);

        const deadlines = nextDeadlines(pending, state, rejoined.registry, NOW + 60_000);

        expect(deadlines.hostHandover).toBeNull();
        expect(state.hostId).toBe("p1");
      });
    });
  });

  describe("境界値", () => {
    describe("同じ出題者が離脱したままで再計算されたとき", () => {
      it("既存の期限が延長されないこと", () => {
        const pending: Deadlines = {
          ...FRESH,
          presenterSkip: { at: NOW + AWAY_GRACE_MS, playerId: "p1" },
        };

        const deadlines = nextDeadlines(pending, presenting(), PRESENTER_AWAY, NOW + 60_000);

        expect(deadlines.presenterSkip).toEqual({ at: NOW + AWAY_GRACE_MS, playerId: "p1" });
      });
    });

    describe("離脱中に出題者が交代したとき", () => {
      it("新しい出題者に対して期限が引き直されること", () => {
        const skipped = run(presenting(), [{ type: "forceSkip" }]);
        const bothAway = registryOf(
          away("p1", "t1"),
          away("p2", "t2"),
          connected("p3", "t3", "c3"),
        );
        const pending: Deadlines = {
          ...FRESH,
          presenterSkip: { at: NOW + AWAY_GRACE_MS, playerId: "p1" },
        };

        const deadlines = nextDeadlines(pending, skipped, bothAway, NOW + 60_000);

        expect(deadlines.presenterSkip).toEqual({
          at: NOW + 60_000 + AWAY_GRACE_MS,
          playerId: "p2",
        });
      });
    });

    describe("出題者が交代しない状態のとき", () => {
      it("lobby・revealed のいずれでも自動スキップ期限が立たないこと", () => {
        const states = [lobby(), revealed()];

        expect(states.map((state) => state.phase)).toEqual(["lobby", "revealed"]);
        expect(
          states.map((state) => nextDeadlines(FRESH, state, PRESENTER_AWAY, NOW).presenterSkip),
        ).toEqual([null, null]);
      });
    });

    describe("移譲先がいないとき", () => {
      it("ホスト移譲期限が立たないこと", () => {
        const nobodyElse = registryOf(away("p1", "t1"), away("p2", "t2"), vacated("p3"));

        const deadlines = nextDeadlines(FRESH, presenting(), nobodyElse, NOW);

        expect(deadlines.hostHandover).toBeNull();
      });
    });
  });
});

describe("earliestDeadline", () => {
  describe("正常系", () => {
    describe("3種の期限が立っているとき", () => {
      it("最も早い時刻が返ること", () => {
        const deadlines: Deadlines = {
          presenterSkip: { at: NOW + 300, playerId: "p1" },
          hostHandover: { at: NOW + 100, playerId: "p2" },
          roomExpiresAt: NOW + 200,
        };

        expect(earliestDeadline(deadlines)).toBe(NOW + 100);
      });
    });

    describe("立っていない期限があるとき", () => {
      it("それが無視されること", () => {
        const deadlines: Deadlines = {
          presenterSkip: null,
          hostHandover: null,
          roomExpiresAt: NOW + 200,
        };

        expect(earliestDeadline(deadlines)).toBe(NOW + 200);
      });
    });
  });
});

describe("dueDeadlines", () => {
  describe("正常系", () => {
    describe("一部だけが期限を過ぎているとき", () => {
      it("過ぎたものだけが返ること", () => {
        const deadlines: Deadlines = {
          presenterSkip: { at: NOW - 1, playerId: "p1" },
          hostHandover: { at: NOW + 1, playerId: "p2" },
          roomExpiresAt: NOW + 1,
        };

        expect(dueDeadlines(deadlines, NOW)).toEqual(["presenterSkip"]);
      });
    });

    describe("複数が同時に期限を過ぎているとき", () => {
      it("すべてが返ること", () => {
        const deadlines: Deadlines = {
          presenterSkip: { at: NOW - 1, playerId: "p1" },
          hostHandover: { at: NOW - 1, playerId: "p2" },
          roomExpiresAt: NOW - 1,
        };

        expect(dueDeadlines(deadlines, NOW)).toEqual([
          "presenterSkip",
          "hostHandover",
          "roomExpired",
        ]);
      });
    });
  });

  describe("境界値", () => {
    describe("期限とちょうど同時刻のとき", () => {
      it("期限切れとみなされること", () => {
        const deadlines: Deadlines = {
          presenterSkip: { at: NOW, playerId: "p1" },
          hostHandover: null,
          roomExpiresAt: NOW + 1,
        };

        expect(dueDeadlines(deadlines, NOW)).toEqual(["presenterSkip"]);
      });
    });
  });
});

describe("hostSuccessor", () => {
  describe("正常系", () => {
    describe("接続中の参加者が複数いるとき", () => {
      it("名簿の先頭に近い順で、ホスト以外が選ばれること", () => {
        expect(hostSuccessor(presenting(), ALL_CONNECTED)).toBe("p2");
      });
    });
  });

  describe("境界値", () => {
    describe("先頭の候補が離脱中や空席のとき", () => {
      it("それらは候補にならず、次の接続中の参加者が選ばれること", () => {
        const registry = registryOf(away("p1", "t1"), vacated("p2"), connected("p3", "t3", "c3"));

        expect(hostSuccessor(presenting(), registry)).toBe("p3");
      });
    });

    describe("接続中がホストだけのとき", () => {
      it("移譲先がないこと", () => {
        const registry = registryOf(connected("p1", "t1", "c1"), away("p2", "t2"), vacated("p3"));

        expect(hostSuccessor(presenting(), registry)).toBeNull();
      });
    });
  });
});
