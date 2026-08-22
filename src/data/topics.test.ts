import { describe, expect, it } from "vitest";
import { CATEGORIES, DIFFICULTIES } from "../domain/topic";
import { TOPICS } from "./topics";

describe("お題データ", () => {
  describe("一意性", () => {
    it("id に重複がないこと", () => {
      const ids = TOPICS.map((topic) => topic.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("word に重複がないこと", () => {
      const words = TOPICS.map((topic) => topic.word);
      expect(new Set(words).size).toBe(words.length);
    });
  });

  describe("お題ピックの成立条件", () => {
    it.each(DIFFICULTIES)("難易度 %i の語が最低1件存在すること", (difficulty) => {
      expect(TOPICS.filter((topic) => topic.difficulty === difficulty).length).toBeGreaterThan(0);
    });
  });

  describe("値の妥当性", () => {
    it("すべての category が定義済みの値であること", () => {
      const invalid = TOPICS.filter((topic) => !CATEGORIES.includes(topic.category));
      expect(invalid).toEqual([]);
    });
  });

  describe("関連語", () => {
    it("お題の word と部分一致する関連語を含まないこと", () => {
      const invalid = TOPICS.flatMap((topic) =>
        topic.relatedWords
          .filter((related) => topic.word.includes(related) || related.includes(topic.word))
          .map((related) => `${topic.word}: ${related}`),
      );
      expect(invalid).toEqual([]);
    });

    it("関連語が 3〜5 語であること", () => {
      const invalid = TOPICS.filter(
        (topic) => topic.relatedWords.length < 3 || topic.relatedWords.length > 5,
      ).map((topic) => topic.word);
      expect(invalid).toEqual([]);
    });
  });
});
