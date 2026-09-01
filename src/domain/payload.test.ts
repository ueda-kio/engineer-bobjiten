import { describe, expect, it } from "vitest";
import type { ConnectionRegistry, Seat } from "./connection";
import { payloadFor, toPresenterPayload, toPublicPayload } from "./payload";
import type { Rng } from "./rng";
import {
  createSession,
  reduceSession,
  type SessionAction,
  type SessionDeps,
  type SessionState,
} from "./session";
import type { Difficulty, Topic } from "./topic";

const topic = (id: string, word: string, difficulty: Difficulty): Topic => ({
  id,
  word,
  difficulty,
  category: "言語・文法",
  relatedWords: ["ヒント1", "ヒント2", "ヒント3"],
});

const TOPICS: Topic[] = [
  topic("a1", "アアア", 1),
  topic("a2", "アアアア", 1),
  topic("b1", "イイイイ", 2),
  topic("b2", "イイイイイ", 2),
  topic("c1", "ウウウウウ", 3),
  topic("c2", "ウウウウウウ", 3),
];

const SECRET = TOPICS[2];

const headRng: Rng = () => 0;
const deps: SessionDeps = { topics: TOPICS, rng: headRng };

const run = (state: SessionState, actions: SessionAction[]): SessionState =>
  actions.reduce((current, action) => reduceSession(current, action, deps), state);

/** p1 hosts and presents first; p2 and p3 answer. */
const JOINED: SessionAction[] = [
  { type: "addPlayer", id: "p1", name: "ホスト" },
  { type: "addPlayer", id: "p2", name: "参加者2" },
  { type: "addPlayer", id: "p3", name: "参加者3" },
];

const lobby = (): SessionState => run(createSession(), JOINED);

const picking = (): SessionState => run(lobby(), [{ type: "startGame" }]);

const presenting = (): SessionState =>
  run(picking(), [{ type: "selectTopic", topicId: SECRET.id }]);

const revealed = (): SessionState =>
  run(presenting(), [{ type: "confirmAnswerer", playerId: "p2" }]);

/** Every player presents one answered round, which ends the game. */
const result = (): SessionState => {
  // The presenter rotates p1 -> p2 -> p3, and nobody may answer their own round.
  const rounds: [topicId: string, answererId: string][] = [
    ["b1", "p2"],
    ["a1", "p1"],
    ["c1", "p1"],
  ];

  return run(
    run(lobby(), [{ type: "setEndCondition", roundsPerPlayer: 1 }, { type: "startGame" }]),
    rounds.flatMap(([topicId, answererId]): SessionAction[] => [
      { type: "selectTopic", topicId },
      { type: "confirmAnswerer", playerId: answererId },
      { type: "next" },
    ]),
  );
};

const TOKEN_P1 = "p1の秘密トークン";
const TOKEN_P2 = "p2の秘密トークン";

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

/** p1 is connected, p2 has dropped off, p3's seat was released by the host. */
const MIXED = registryOf(connected("p1", TOKEN_P1, "c1"), away("p2", TOKEN_P2), vacated("p3"));

const ALL_CONNECTED = registryOf(
  connected("p1", TOKEN_P1, "c1"),
  connected("p2", TOKEN_P2, "c2"),
  connected("p3", "p3の秘密トークン", "c3"),
);

describe("toPublicPayload", () => {
  describe("正常系", () => {
    describe("接続中・離脱中・空席の参加者がいるとき", () => {
      it("離脱中は awayPlayerIds に、空席は vacantPlayerIds に入り、接続中はどちらにも入らないこと", () => {
        expect(toPublicPayload(presenting(), MIXED)).toMatchObject({
          audience: "everyone",
          awayPlayerIds: ["p2"],
          vacantPlayerIds: ["p3"],
        });
      });
    });

    describe("出題中のとき", () => {
      it("お題の語・お題の識別子・秘密トークンのいずれも含まれないこと", () => {
        const serialized = JSON.stringify(toPublicPayload(presenting(), MIXED));

        expect(serialized).not.toContain(SECRET.word);
        expect(serialized).not.toContain(SECRET.id);
        expect(serialized).not.toContain(TOKEN_P1);
        expect(serialized).not.toContain(TOKEN_P2);
      });
    });
  });

  describe("境界値", () => {
    describe("名簿にいるがレジストリに席がない参加者がいるとき", () => {
      it("離脱中として扱われること", () => {
        const onlyHost = registryOf(connected("p1", TOKEN_P1, "c1"));

        expect(toPublicPayload(presenting(), onlyHost)).toMatchObject({
          awayPlayerIds: ["p2", "p3"],
          vacantPlayerIds: [],
        });
      });
    });
  });
});

describe("toPresenterPayload", () => {
  describe("正常系", () => {
    describe("出題者に配信するとき", () => {
      it("3つの候補と出題中のお題が含まれること", () => {
        expect(toPresenterPayload(picking(), ALL_CONNECTED)).toMatchObject({
          audience: "presenter",
          phase: "picking",
          candidates: [{ id: "a1" }, { id: "b1" }, { id: "c1" }],
        });
        expect(toPresenterPayload(presenting(), ALL_CONNECTED)).toMatchObject({
          audience: "presenter",
          phase: "presenting",
          topic: { id: SECRET.id, word: SECRET.word },
        });
      });
    });

    describe("状態を全て受け取る出題者に対しても", () => {
      it("秘密トークンは含まれないこと", () => {
        const serialized = JSON.stringify(toPresenterPayload(presenting(), MIXED));

        expect(serialized).not.toContain(TOKEN_P1);
        expect(serialized).not.toContain(TOKEN_P2);
      });
    });
  });
});

describe("payloadFor", () => {
  describe("正常系", () => {
    describe("受信者が現在の出題者のとき", () => {
      it("出題者向けのペイロードが返ること", () => {
        expect(payloadFor(picking(), MIXED, "p1").audience).toBe("presenter");
        expect(payloadFor(presenting(), MIXED, "p1").audience).toBe("presenter");
      });
    });

    describe("受信者が出題者以外、または名簿にない playerId のとき", () => {
      it("全員向けのペイロードが返ること", () => {
        expect(payloadFor(presenting(), MIXED, "p2").audience).toBe("everyone");
        expect(payloadFor(presenting(), MIXED, "名簿にない").audience).toBe("everyone");
      });
    });
  });

  describe("境界値", () => {
    describe("秘密を持たない状態のとき", () => {
      it("受信者が出題者であっても全員向けが返ること", () => {
        const states = [lobby(), revealed(), result()];

        // Pinned so that a helper failing to reach its phase cannot make the
        // assertion below pass for the wrong reason.
        expect(states.map((state) => state.phase)).toEqual(["lobby", "revealed", "result"]);
        expect(states.map((state) => payloadFor(state, MIXED, "p1").audience)).toEqual([
          "everyone",
          "everyone",
          "everyone",
        ]);
      });
    });
  });
});
