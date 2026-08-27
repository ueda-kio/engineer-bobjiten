import { describe, expect, it } from "vitest";
import { canPerform } from "./permissions";
import type { Rng } from "./rng";
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

/** p1 is the host; the presenter has already moved on to p2. */
const pickingWithPresenterP2 = (): SessionState =>
  run(createSession(), [
    { type: "addPlayer", id: "p1", name: "p1" },
    { type: "addPlayer", id: "p2", name: "p2" },
    { type: "addPlayer", id: "p3", name: "p3" },
    { type: "startGame" },
    { type: "selectTopic", topicId: "b1" },
    { type: "confirmAnswerer", playerId: "p2" },
    { type: "next" },
  ]);

const presentingWithPresenterP2 = (): SessionState =>
  run(pickingWithPresenterP2(), [{ type: "selectTopic", topicId: "b2" }]);

const HOST_ONLY: SessionAction[] = [
  { type: "startGame" },
  { type: "setEndCondition", roundsPerPlayer: 2 },
  { type: "restart" },
  { type: "forceSkip" },
];

const PRESENTER_ONLY: SessionAction[] = [
  { type: "selectTopic", topicId: "b2" },
  { type: "redraw" },
  { type: "useHelp", kind: "category" },
  { type: "confirmAnswerer", playerId: "p3" },
];

describe("canPerform", () => {
  describe("正常系", () => {
    describe("ホスト専用の操作をホストが行うとき", () => {
      it("すべて許可されること", () => {
        const state = pickingWithPresenterP2();

        expect(HOST_ONLY.map((action) => canPerform(state, action, "p1"))).toEqual([
          true,
          true,
          true,
          true,
        ]);
      });
    });

    describe("出題者専用の操作を現在の出題者が行うとき", () => {
      it("すべて許可されること", () => {
        const state = pickingWithPresenterP2();

        expect(PRESENTER_ONLY.map((action) => canPerform(state, action, "p2"))).toEqual([
          true,
          true,
          true,
          true,
        ]);
      });
    });
  });

  describe("異常系", () => {
    describe("ホスト専用の操作をホスト以外が行おうとするとき", () => {
      it("すべて拒否されること", () => {
        const state = pickingWithPresenterP2();

        expect(HOST_ONLY.map((action) => canPerform(state, action, "p2"))).toEqual([
          false,
          false,
          false,
          false,
        ]);
      });
    });

    describe("出題者専用の操作を出題者以外が行おうとするとき", () => {
      it("すべて拒否されること", () => {
        const state = pickingWithPresenterP2();

        expect(PRESENTER_ONLY.map((action) => canPerform(state, action, "p3"))).toEqual([
          false,
          false,
          false,
          false,
        ]);
      });
    });

    describe("カタカナ使用の指摘を出題者自身が行おうとするとき", () => {
      it("拒否されること", () => {
        const state = presentingWithPresenterP2();

        expect(canPerform(state, { type: "acceptKatakanaReport", reporterId: "p2" }, "p2")).toBe(
          false,
        );
        expect(canPerform(state, { type: "acceptKatakanaReport", reporterId: "p3" }, "p3")).toBe(
          true,
        );
      });
    });
  });

  describe("境界値", () => {
    describe("参加者として登録されていない actorId のとき", () => {
      it("どの操作も許可されないこと", () => {
        const state = pickingWithPresenterP2();
        const everyAction: SessionAction[] = [
          ...HOST_ONLY,
          ...PRESENTER_ONLY,
          { type: "addPlayer", id: "x", name: "x" },
          { type: "acceptKatakanaReport", reporterId: "unknown" },
          { type: "next" },
        ];

        const allowed = everyAction.filter((action) => canPerform(state, action, "unknown"));

        expect(allowed).toEqual([]);
      });
    });

    describe("まだ誰も登録されていないとき", () => {
      it("最初の参加者登録のみ許可されること", () => {
        const empty = createSession();

        expect(canPerform(empty, { type: "addPlayer", id: "p1", name: "p1" }, "p1")).toBe(true);
        expect(canPerform(empty, { type: "startGame" }, "p1")).toBe(false);
      });
    });
  });
});
