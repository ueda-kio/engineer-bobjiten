import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Rng } from "../../domain/rng";
import type { Difficulty, Topic } from "../../domain/topic";
import { useGame } from "./useGame";

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

/** Returns the given values in order, then repeats from the head. */
const sequenceRng = (values: number[]): Rng => {
  let index = 0;
  return () => values[index++ % values.length];
};

const renderGame = (rng: Rng = sequenceRng([0])) => renderHook(() => useGame(TOPICS, rng)).result;

describe("useGame", () => {
  describe("初期状態", () => {
    it("idle であること", () => {
      const game = renderGame();

      expect(game.current.state.phase).toBe("idle");
    });
  });

  describe("お題を引いたとき", () => {
    it("picking へ遷移し、難易度ごとの候補3件を保持すること", () => {
      const game = renderGame();

      act(() => game.current.draw());

      expect(game.current.state).toMatchObject({
        phase: "picking",
        candidates: [{ id: "a1" }, { id: "b1" }, { id: "c1" }],
      });
    });
  });

  describe("候補を1件選んだとき", () => {
    it("presenting へ遷移し、選択した語を保持すること", () => {
      const game = renderGame();
      act(() => game.current.draw());

      act(() => game.current.select(TOPICS[2]));

      expect(game.current.state).toMatchObject({ phase: "presenting", topic: { id: "b1" } });
    });
  });

  describe("出題中に引き直したとき", () => {
    it("picking へ戻り、新しい候補を保持すること", () => {
      const game = renderGame(sequenceRng([0, 0, 0, 0.9]));
      act(() => game.current.draw());
      act(() => game.current.select(TOPICS[0]));

      act(() => game.current.redraw());

      expect(game.current.state).toMatchObject({
        phase: "picking",
        candidates: [{ id: "a2" }, { id: "b1" }, { id: "c1" }],
      });
    });
  });

  describe("お助け機能を使ったとき", () => {
    it("公開フラグが立ち、引き直して選び直すと伏せられた状態に戻ること", () => {
      const game = renderGame();
      act(() => game.current.draw());
      act(() => game.current.select(TOPICS[0]));

      act(() => game.current.revealCategory());
      act(() => game.current.revealWhitelist());

      expect(game.current.state).toMatchObject({
        categoryRevealed: true,
        whitelistRevealed: true,
      });

      act(() => game.current.redraw());
      act(() => game.current.select(TOPICS[0]));

      expect(game.current.state).toMatchObject({
        categoryRevealed: false,
        whitelistRevealed: false,
      });
    });
  });
});
