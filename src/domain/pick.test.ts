import { describe, expect, it } from "vitest";
import { pickCandidates, pickTopics } from "./pick";
import type { Rng } from "./rng";
import type { Difficulty, Topic } from "./topic";

const topic = (id: string, difficulty: Difficulty): Topic => ({
  id,
  word: id,
  difficulty,
  category: "その他",
  relatedWords: ["あ", "い", "う"],
});

/** Returns the given values in order, then repeats from the head. */
const sequenceRng = (values: number[]): Rng => {
  let index = 0;
  return () => values[index++ % values.length];
};

describe("pickTopics", () => {
  describe("正常系", () => {
    describe("各難易度に複数の語があるとき", () => {
      it("難易度1・2・3の語が1件ずつ、難易度の昇順で返ること", () => {
        const topics = [
          topic("c1", 3),
          topic("a1", 1),
          topic("b1", 2),
          topic("a2", 1),
          topic("c2", 3),
          topic("b2", 2),
        ];

        const picked = pickTopics(topics, sequenceRng([0]));

        expect(picked.map((t) => t.difficulty)).toEqual([1, 2, 3]);
        expect(picked.map((t) => t.id)).toEqual(["a1", "b1", "c1"]);
      });
    });

    describe("同じ値を返す Rng を渡したとき", () => {
      it("何度呼んでも同一の組み合わせが返ること", () => {
        const topics = [
          topic("a1", 1),
          topic("a2", 1),
          topic("b1", 2),
          topic("b2", 2),
          topic("c1", 3),
          topic("c2", 3),
        ];

        const first = pickTopics(topics, sequenceRng([0.6]));
        const second = pickTopics(topics, sequenceRng([0.6]));

        expect(first.map((t) => t.id)).toEqual(second.map((t) => t.id));
      });
    });
  });

  describe("境界値", () => {
    describe("ある難易度の語が1件しかないとき", () => {
      it("その1件が必ず選ばれること", () => {
        const topics = [topic("a1", 1), topic("a2", 1), topic("b1", 2), topic("c1", 3)];

        const picked = pickTopics(topics, sequenceRng([0.99]));

        expect(picked[1].id).toBe("b1");
      });
    });

    describe("Rng が下限・上限付近の値を返すとき", () => {
      it("配列外参照せず、それぞれ先頭・末尾の語が選ばれること", () => {
        const topics = [
          topic("a1", 1),
          topic("a2", 1),
          topic("b1", 2),
          topic("b2", 2),
          topic("c1", 3),
          topic("c2", 3),
        ];

        expect(pickTopics(topics, sequenceRng([0])).map((t) => t.id)).toEqual(["a1", "b1", "c1"]);
        expect(pickTopics(topics, sequenceRng([0.9999999])).map((t) => t.id)).toEqual([
          "a2",
          "b2",
          "c2",
        ]);
      });
    });
  });

  describe("異常系", () => {
    describe("いずれかの難易度の語が0件のとき", () => {
      it("例外を投げること", () => {
        const topics = [topic("a1", 1), topic("b1", 2)];

        expect(() => pickTopics(topics, sequenceRng([0]))).toThrow();
      });
    });
  });
});

describe("pickCandidates", () => {
  const topics = [
    topic("a1", 1),
    topic("a2", 1),
    topic("b1", 2),
    topic("b2", 2),
    topic("c1", 3),
    topic("c2", 3),
  ];

  describe("正常系", () => {
    describe("出題済みの語があるとき", () => {
      it("その語が候補から除外されること", () => {
        const { candidates, didResetUsed } = pickCandidates(
          topics,
          ["a1", "b1", "c1"],
          sequenceRng([0]),
        );

        expect(candidates.map((t) => t.id)).toEqual(["a2", "b2", "c2"]);
        expect(didResetUsed).toBe(false);
      });
    });

    describe("出題済みが空のとき", () => {
      it("すべての語が抽選対象になること", () => {
        const { candidates, didResetUsed } = pickCandidates(topics, [], sequenceRng([0]));

        expect(candidates.map((t) => t.id)).toEqual(["a1", "b1", "c1"]);
        expect(didResetUsed).toBe(false);
      });
    });
  });

  describe("境界値", () => {
    describe("いずれかの難易度の未出題が0件になったとき", () => {
      it("出題済み記録をリセットして抽選し、リセットの発生が返り値に現れること", () => {
        const { candidates, didResetUsed } = pickCandidates(topics, ["a1", "a2"], sequenceRng([0]));

        expect(candidates.map((t) => t.id)).toEqual(["a1", "b1", "c1"]);
        expect(didResetUsed).toBe(true);
      });
    });

    describe("リセットが発生したとき", () => {
      it("直前まで出題済みだった語も抽選対象に含まれること", () => {
        const { candidates } = pickCandidates(topics, ["a1", "a2"], sequenceRng([0.9]));

        expect(candidates.map((t) => t.id)).toEqual(["a2", "b2", "c2"]);
      });
    });
  });
});
