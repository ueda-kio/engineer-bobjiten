import { describe, expect, it } from "vitest";
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

/** Always draws the first remaining topic of each difficulty. */
const headRng: Rng = () => 0;

const deps = (topics: Topic[] = TOPICS, rng: Rng = headRng): SessionDeps => ({ topics, rng });

const run = (state: SessionState, actions: SessionAction[], d: SessionDeps): SessionState =>
  actions.reduce((current, action) => reduceSession(current, action, d), state);

const withPlayers = (...ids: string[]): SessionAction[] =>
  ids.map((id) => ({ type: "addPlayer", id, name: id }) as const);

/** lobby with the given players registered. */
const lobby = (ids: string[], d: SessionDeps = deps()) =>
  run(createSession(), withPlayers(...ids), d);

/** picking, right after the game started. */
const picking = (ids: string[], d: SessionDeps = deps()) =>
  run(lobby(ids, d), [{ type: "startGame" }], d);

/** presenting the difficulty-2 candidate. */
const presenting = (ids: string[], d: SessionDeps = deps()) =>
  run(picking(ids, d), [{ type: "selectTopic", topicId: "b1" }], d);

describe("reduceSession", () => {
  describe("正常系 - lobby", () => {
    describe("参加者を追加したとき", () => {
      it("参加者リストに加わること", () => {
        const state = lobby(["p1", "p2"]);

        expect(state.players.map((player) => player.id)).toEqual(["p1", "p2"]);
      });
    });

    describe("最初の参加者を追加したとき", () => {
      it("その参加者がホストになること", () => {
        const state = lobby(["p1", "p2"]);

        expect(state.hostId).toBe("p1");
      });
    });

    describe("終了条件を更新したとき", () => {
      it("設定値が反映されること", () => {
        const state = run(
          createSession(),
          [{ type: "setEndCondition", roundsPerPlayer: 5 }],
          deps(),
        );

        expect(state.endCondition).toEqual({ type: "rounds", roundsPerPlayer: 5 });
      });
    });

    describe("参加者2名以上でゲームを開始したとき", () => {
      it("picking へ遷移し、候補3件と最初の出題者が決まること", () => {
        const state = picking(["p1", "p2"]);

        expect(state).toMatchObject({
          phase: "picking",
          consumptions: 0,
          presenterIndex: 0,
          candidates: [{ id: "a1" }, { id: "b1" }, { id: "c1" }],
        });
      });
    });
  });

  describe("正常系 - picking / presenting", () => {
    describe("お題を選択したとき", () => {
      it("presenting へ遷移し、選択した1語だけが出題済みに記録されること", () => {
        const state = presenting(["p1", "p2"]);

        expect(state).toMatchObject({ phase: "presenting", topic: { id: "b1" } });
        expect(state.usedTopicIds).toEqual(["b1"]);
      });
    });

    describe("picking で引き直したとき", () => {
      it("消費が1増え、候補が再抽選されて picking に留まること", () => {
        const state = run(picking(["p1", "p2"]), [{ type: "redraw" }], deps());

        expect(state).toMatchObject({ phase: "picking", consumptions: 1 });
      });
    });

    describe("presenting で引き直したとき", () => {
      it("消費が1増えて picking へ戻り、出題者が交代しないこと", () => {
        const state = run(presenting(["p1", "p2"]), [{ type: "redraw" }], deps());

        expect(state).toMatchObject({ phase: "picking", consumptions: 1, presenterIndex: 0 });
      });
    });

    describe("お助け機能を使ったとき", () => {
      it("消費が1増え、その機能の開示フラグが立つこと", () => {
        const state = run(
          presenting(["p1", "p2"]),
          [{ type: "useHelp", kind: "category" }],
          deps(),
        );

        expect(state).toMatchObject({
          phase: "presenting",
          consumptions: 1,
          revealedHelps: { category: true, whitelist: false, oneKatakana: false },
        });
      });
    });

    describe("カタカナ使用の指摘を出題者が認めたとき", () => {
      it("指摘者に1点入り、出題者の得点は減らないこと", () => {
        const state = run(
          presenting(["p1", "p2"]),
          [{ type: "acceptKatakanaReport", reporterId: "p2" }],
          deps(),
        );

        expect(state.scores).toEqual({ p1: 0, p2: 1 });
      });
    });

    describe("正解者を確定したとき", () => {
      it("出題者に「難易度 − 消費」、正解者に難易度分が加点され、出題回数が1増えて revealed へ遷移すること", () => {
        const state = run(
          presenting(["p1", "p2"]),
          [
            { type: "useHelp", kind: "category" },
            { type: "confirmAnswerer", playerId: "p2" },
          ],
          deps(),
        );

        expect(state).toMatchObject({ phase: "revealed", topic: { id: "b1" } });
        expect(state.scores).toEqual({ p1: 1, p2: 2 });
        expect(state.presentCounts).toEqual({ p1: 1, p2: 0 });
      });
    });
  });

  describe("正常系 - revealed / result", () => {
    describe("結果表示から次へ進んだとき", () => {
      it("出題者がラウンドロビンで次の人へ進み、消費が0に戻って picking へ遷移すること", () => {
        const state = run(
          presenting(["p1", "p2", "p3"]),
          [{ type: "confirmAnswerer", playerId: "p2" }, { type: "next" }],
          deps(),
        );

        expect(state).toMatchObject({ phase: "picking", presenterIndex: 1, consumptions: 0 });
      });
    });

    describe("全員が n 問出題し終えたとき", () => {
      it("次へで result へ遷移すること", () => {
        const d = deps();
        const start = run(
          lobby(["p1", "p2"], d),
          [{ type: "setEndCondition", roundsPerPlayer: 1 }, { type: "startGame" }],
          d,
        );
        const state = run(
          start,
          [
            { type: "selectTopic", topicId: "b1" },
            { type: "confirmAnswerer", playerId: "p2" },
            { type: "next" },
            { type: "selectTopic", topicId: "b2" },
            { type: "confirmAnswerer", playerId: "p1" },
            { type: "next" },
          ],
          d,
        );

        expect(state.phase).toBe("result");
      });
    });

    describe("もう一度を選んだとき", () => {
      it("得点・出題回数・出題済み記録が初期化され lobby へ戻ること", () => {
        const d = deps();
        const start = run(
          lobby(["p1", "p2"], d),
          [{ type: "setEndCondition", roundsPerPlayer: 1 }, { type: "startGame" }],
          d,
        );
        const finished = run(
          start,
          [
            { type: "selectTopic", topicId: "b1" },
            { type: "confirmAnswerer", playerId: "p2" },
            { type: "next" },
            { type: "selectTopic", topicId: "b2" },
            { type: "confirmAnswerer", playerId: "p1" },
            { type: "next" },
          ],
          d,
        );

        const state = run(finished, [{ type: "restart" }], d);

        expect(state).toMatchObject({ phase: "lobby", presenterIndex: 0 });
        expect(state.scores).toEqual({ p1: 0, p2: 0 });
        expect(state.presentCounts).toEqual({ p1: 0, p2: 0 });
        expect(state.usedTopicIds).toEqual([]);
        expect(state.players.map((player) => player.id)).toEqual(["p1", "p2"]);
      });
    });
  });

  describe("正常系 - 強制スキップ", () => {
    describe("出題中に強制スキップしたとき", () => {
      it("加点も出題回数の加算もされず、出題者が次の人へ進んで picking になること", () => {
        const state = run(presenting(["p1", "p2", "p3"]), [{ type: "forceSkip" }], deps());

        expect(state).toMatchObject({ phase: "picking", presenterIndex: 1 });
        expect(state.scores).toEqual({ p1: 0, p2: 0, p3: 0 });
        expect(state.presentCounts).toEqual({ p1: 0, p2: 0, p3: 0 });
      });
    });

    describe("候補提示中に強制スキップしたとき", () => {
      it("同じく出題者が次の人へ進むこと", () => {
        const state = run(picking(["p1", "p2", "p3"]), [{ type: "forceSkip" }], deps());

        expect(state).toMatchObject({ phase: "picking", presenterIndex: 1 });
      });
    });

    describe("消費が積み上がった状態で強制スキップしたとき", () => {
      it("消費が0に戻ること", () => {
        const state = run(
          presenting(["p1", "p2", "p3"]),
          [{ type: "useHelp", kind: "category" }, { type: "forceSkip" }],
          deps(),
        );

        expect(state).toMatchObject({ phase: "picking", consumptions: 0 });
      });
    });
  });

  describe("異常系", () => {
    describe("参加者が1名のときゲーム開始を試みたとき", () => {
      it("開始されず lobby のままであること", () => {
        const state = run(lobby(["p1"]), [{ type: "startGame" }], deps());

        expect(state.phase).toBe("lobby");
      });
    });

    describe("現在の状態で定義されていない操作を行ったとき", () => {
      it("状態が変化しないこと", () => {
        const before = lobby(["p1", "p2"]);

        const after = run(before, [{ type: "confirmAnswerer", playerId: "p2" }], deps());

        expect(after).toBe(before);
      });
    });

    describe("lobby・revealed・result で強制スキップしたとき", () => {
      it("いずれも状態が変化しないこと", () => {
        const d = deps();
        const inLobby = lobby(["p1", "p2"], d);
        const inRevealed = run(
          presenting(["p1", "p2"], d),
          [{ type: "confirmAnswerer", playerId: "p2" }],
          d,
        );
        const inResult = run(
          run(
            lobby(["p1", "p2"], d),
            [{ type: "setEndCondition", roundsPerPlayer: 1 }, { type: "startGame" }],
            d,
          ),
          [
            { type: "selectTopic", topicId: "b1" },
            { type: "confirmAnswerer", playerId: "p2" },
            { type: "next" },
            { type: "selectTopic", topicId: "b2" },
            { type: "confirmAnswerer", playerId: "p1" },
            { type: "next" },
          ],
          d,
        );

        for (const before of [inLobby, inRevealed, inResult]) {
          expect(run(before, [{ type: "forceSkip" }], d)).toBe(before);
        }
      });
    });

    describe("出題者自身を正解者に指定したとき", () => {
      it("加点されず presenting のままであること", () => {
        const before = presenting(["p1", "p2"]);

        const after = run(before, [{ type: "confirmAnswerer", playerId: "p1" }], deps());

        expect(after).toBe(before);
      });
    });
  });

  describe("境界値", () => {
    describe("1名だけが n 問に達していないとき", () => {
      it("終了条件が成立せず picking へ進むこと", () => {
        const d = deps();
        const start = run(
          lobby(["p1", "p2", "p3"], d),
          [{ type: "setEndCondition", roundsPerPlayer: 1 }, { type: "startGame" }],
          d,
        );
        const state = run(
          start,
          [
            { type: "selectTopic", topicId: "b1" },
            { type: "confirmAnswerer", playerId: "p2" },
            { type: "next" },
            { type: "selectTopic", topicId: "b2" },
            { type: "confirmAnswerer", playerId: "p1" },
            { type: "next" },
          ],
          d,
        );

        expect(state).toMatchObject({ phase: "picking", presenterIndex: 2 });
      });
    });

    describe("次の抽選で特定の難易度の語が枯渇するとき", () => {
      it("その難易度の出題済み記録だけがリセットされ、状態に記録されること", () => {
        const scarce = [topic("a1", 1), topic("b1", 2), topic("c1", 3)];
        const d = deps(scarce);
        const state = run(
          run(lobby(["p1", "p2"], d), [{ type: "startGame" }], d),
          [
            { type: "selectTopic", topicId: "a1" },
            { type: "confirmAnswerer", playerId: "p2" },
            { type: "next" },
          ],
          d,
        );

        expect(state).toMatchObject({ phase: "picking", resetDifficulties: [1] });
        expect(state.usedTopicIds).toEqual([]);
      });
    });
  });
});
