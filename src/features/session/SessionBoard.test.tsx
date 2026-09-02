import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createRegistry, type ConnectionRegistry } from "../../domain/connection";
import { toPresenterPayload, toPublicPayload } from "../../domain/payload";
import type { Rng } from "../../domain/rng";
import {
  createSession,
  reduceSession,
  type SessionAction,
  type SessionDeps,
  type SessionState,
} from "../../domain/session";
import type { Topic } from "../../domain/topic";
import { SessionBoard } from "./SessionBoard";

const TOPICS: Topic[] = [
  { id: "a1", word: "アアア", difficulty: 1, category: "その他", relatedWords: ["あ", "い", "う"] },
  {
    id: "b1",
    word: "ヒミツノオダイ",
    difficulty: 2,
    category: "言語・文法",
    relatedWords: ["か", "き", "く"],
  },
  {
    id: "c1",
    word: "ウウウウウ",
    difficulty: 3,
    category: "その他",
    relatedWords: ["さ", "し", "す"],
  },
];

const SECRET = TOPICS[1];

const deps: SessionDeps = { topics: TOPICS, rng: (() => 0) as Rng };

const run = (state: SessionState, actions: SessionAction[]): SessionState =>
  actions.reduce((current, action) => reduceSession(current, action, deps), state);

/** p1 presents `SECRET`; p2 answers. */
const presenting = (): SessionState =>
  run(createSession(), [
    { type: "addPlayer", id: "p1", name: "出題者" },
    { type: "addPlayer", id: "p2", name: "回答者" },
    { type: "startGame" },
    { type: "selectTopic", topicId: SECRET.id },
  ]);

const REGISTRY: ConnectionRegistry = createRegistry();

const noop = () => {};

describe("SessionBoard", () => {
  describe("出題中の画面", () => {
    describe("出題者以外に配信されたペイロードを描画したとき", () => {
      it("お題の語が表示されず、難易度と文字数だけが出ること", () => {
        render(
          <SessionBoard
            payload={toPublicPayload(presenting(), REGISTRY)}
            viewerId="p2"
            dispatch={noop}
            onReleaseSeat={noop}
          />,
        );

        expect(screen.queryByText(SECRET.word)).toBeNull();
        expect(screen.getByText(`${SECRET.word.length} 文字`)).toBeInTheDocument();
      });
    });

    describe("出題者に配信されたペイロードを描画したとき", () => {
      it("お題の語が表示されること", () => {
        render(
          <SessionBoard
            payload={toPresenterPayload(presenting(), REGISTRY)}
            viewerId="p1"
            dispatch={noop}
            onReleaseSeat={noop}
          />,
        );

        expect(screen.getByText(SECRET.word)).toBeInTheDocument();
      });
    });
  });
});
