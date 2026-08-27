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
import { toPublicView } from "./view";

const topic = (id: string, word: string, difficulty: Difficulty): Topic => ({
  id,
  word,
  difficulty,
  category: "言語・文法",
  relatedWords: ["ヒント1", "ヒント2", "ヒント3"],
});

const TOPICS: Topic[] = [
  topic("a1", "アアア", 1),
  topic("b1", "イイイイ", 2),
  topic("c1", "ウウウウウ", 3),
];

const SECRET = TOPICS[1];

const headRng: Rng = () => 0;
const deps: SessionDeps = { topics: TOPICS, rng: headRng };

const run = (state: SessionState, actions: SessionAction[]): SessionState =>
  actions.reduce((current, action) => reduceSession(current, action, deps), state);

const picking = (): SessionState =>
  run(createSession(), [
    { type: "addPlayer", id: "p1", name: "ホスト" },
    { type: "addPlayer", id: "p2", name: "参加者" },
    { type: "startGame" },
  ]);

const presenting = (helps: SessionAction[] = []): SessionState =>
  run(picking(), [{ type: "selectTopic", topicId: SECRET.id }, ...helps]);

const revealed = (): SessionState =>
  run(presenting(), [{ type: "confirmAnswerer", playerId: "p2" }]);

const serialized = (state: SessionState): string => JSON.stringify(toPublicView(state));

describe("toPublicView", () => {
  describe("正常系", () => {
    describe("出題中のとき", () => {
      it("お題の語と識別子が含まれず、難易度と文字数が含まれること", () => {
        const view = toPublicView(presenting());

        expect(serialized(presenting())).not.toContain(SECRET.word);
        expect(serialized(presenting())).not.toContain(SECRET.id);
        expect(view).toMatchObject({
          phase: "presenting",
          topicHint: { difficulty: SECRET.difficulty, length: SECRET.word.length },
        });
      });
    });

    describe("お助け機能の開示状況によって", () => {
      it("未開示ならカテゴリと関連語が含まれず、開示済みなら含まれること", () => {
        const hidden = toPublicView(presenting());
        const shown = toPublicView(
          presenting([
            { type: "useHelp", kind: "category" },
            { type: "useHelp", kind: "whitelist" },
          ]),
        );

        expect(hidden).toMatchObject({ phase: "presenting" });
        expect(hidden).not.toHaveProperty("topicHint.category");
        expect(hidden).not.toHaveProperty("topicHint.relatedWords");
        expect(shown).toMatchObject({
          topicHint: { category: SECRET.category, relatedWords: SECRET.relatedWords },
        });
      });
    });

    describe("候補を提示しているとき", () => {
      it("候補が一切含まれないこと", () => {
        const state = picking();

        expect(toPublicView(state)).not.toHaveProperty("candidates");
        for (const candidate of TOPICS) {
          expect(serialized(state)).not.toContain(candidate.word);
        }
      });
    });

    describe("結果表示のとき", () => {
      it("お題が開示されること", () => {
        const view = toPublicView(revealed());

        expect(view).toMatchObject({ phase: "revealed", topic: { id: SECRET.id } });
      });
    });

    describe("どの状態でも", () => {
      it("参加者・得点・現在の出題者・消費数・終了条件が含まれること", () => {
        const view = toPublicView(presenting([{ type: "useHelp", kind: "category" }]));

        expect(view).toMatchObject({
          players: [{ id: "p1" }, { id: "p2" }],
          scores: { p1: 0, p2: 0 },
          presenterIndex: 0,
          hostId: "p1",
          consumptions: 1,
          endCondition: { type: "rounds", roundsPerPlayer: 3 },
        });
      });
    });
  });
});
