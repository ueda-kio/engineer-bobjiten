import { describe, expect, it } from "vitest";
import {
  authorizeJoin,
  disconnect,
  releaseSeat,
  type ConnectionRegistry,
  type JoinDeps,
  type Seat,
} from "./connection";

/** Hands out "id-1", "id-2", ... so a test can predict what gets issued. */
const sequentialIds = (): (() => string) => {
  let issued = 0;
  return () => `id-${++issued}`;
};

const deps = (acceptsNewPlayers: boolean): JoinDeps => ({
  acceptsNewPlayers,
  newId: sequentialIds(),
});

const registryOf = (...seats: Seat[]): ConnectionRegistry => ({ seats });

/** The three seat states of design 6.1-6.4. */
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

describe("authorizeJoin", () => {
  describe("正常系", () => {
    describe("既知のトークンが提示されたとき", () => {
      it("同じ席に接続が結び直され、トークンが再発行されないこと", () => {
        const registry = registryOf(away("p1", "t1"));

        expect(authorizeJoin(registry, { connectionId: "c9", token: "t1" }, deps(true))).toEqual({
          kind: "resumed",
          playerId: "p1",
          displaced: null,
          registry: registryOf(connected("p1", "t1", "c9")),
        });
      });
    });

    describe("トークンなしで空席がちょうど1つあるとき", () => {
      it("その席の playerId を引き継ぎ、新しいトークンだけが発行されること", () => {
        const registry = registryOf(vacated("p1"), connected("p2", "t2", "c2"));

        expect(authorizeJoin(registry, { connectionId: "c9" }, deps(true))).toEqual({
          kind: "reseated",
          playerId: "p1",
          token: "id-1",
          registry: registryOf(connected("p1", "id-1", "c9"), connected("p2", "t2", "c2")),
        });
      });
    });

    describe("トークンなしで空席がないとき", () => {
      it("新しい席が末尾に作られ、playerId とトークンが別々に発行されること", () => {
        const registry = registryOf(connected("p1", "t1", "c1"));

        expect(authorizeJoin(registry, { connectionId: "c9" }, deps(true))).toEqual({
          kind: "created",
          playerId: "id-1",
          token: "id-2",
          registry: registryOf(connected("p1", "t1", "c1"), connected("id-1", "id-2", "c9")),
        });
      });
    });

    describe("claimPlayerId で空席が指定されたとき", () => {
      it("最も古い空席ではなく、指定された席が埋まること", () => {
        const registry = registryOf(vacated("p1"), vacated("p3"));

        expect(
          authorizeJoin(registry, { connectionId: "c9", claimPlayerId: "p3" }, deps(true)),
        ).toEqual({
          kind: "reseated",
          playerId: "p3",
          token: "id-1",
          registry: registryOf(vacated("p1"), connected("p3", "id-1", "c9")),
        });
      });
    });
  });

  describe("異常系", () => {
    describe("未知のトークンが提示されたとき", () => {
      it("トークンなしと同じ経路をたどること", () => {
        const withVacant = registryOf(vacated("p1"));
        const withoutVacant = registryOf(connected("p1", "t1", "c1"));
        const stale = { connectionId: "c9", token: "無効になった古いトークン" };

        expect(authorizeJoin(withVacant, stale, deps(true)).kind).toBe("reseated");
        expect(authorizeJoin(withoutVacant, stale, deps(true)).kind).toBe("created");
      });
    });

    describe("トークンなしで空席が2つ以上あるとき", () => {
      it("どの席か決められないため拒否されること", () => {
        const registry = registryOf(vacated("p1"), connected("p2", "t2", "c2"), vacated("p3"));

        expect(authorizeJoin(registry, { connectionId: "c9" }, deps(true))).toEqual({
          kind: "rejected",
          reason: "seatAmbiguous",
        });
      });
    });

    describe("claimPlayerId が空席以外を指すとき", () => {
      it("接続中・離脱中・存在しない席のいずれも拒否されること", () => {
        const registry = registryOf(connected("p1", "t1", "c1"), away("p2", "t2"));

        const claims = ["p1", "p2", "存在しない"].map((claimPlayerId) =>
          authorizeJoin(registry, { connectionId: "c9", claimPlayerId }, deps(true)),
        );

        expect(claims).toEqual([
          { kind: "rejected", reason: "seatUnavailable" },
          { kind: "rejected", reason: "seatUnavailable" },
          { kind: "rejected", reason: "seatUnavailable" },
        ]);
      });
    });

    describe("新規受付を締め切っているとき", () => {
      it("空席のない新規入室のみ拒否され、再入室と空席の再利用は許可されること", () => {
        const full = registryOf(connected("p1", "t1", "c1"));
        const withVacant = registryOf(connected("p1", "t1", "c1"), vacated("p2"));

        expect(authorizeJoin(full, { connectionId: "c9" }, deps(false))).toEqual({
          kind: "rejected",
          reason: "newPlayersNotAccepted",
        });
        expect(authorizeJoin(full, { connectionId: "c9", token: "t1" }, deps(false)).kind).toBe(
          "resumed",
        );
        expect(authorizeJoin(withVacant, { connectionId: "c9" }, deps(false)).kind).toBe(
          "reseated",
        );
      });
    });
  });

  describe("境界値", () => {
    describe("同一の参加者が2つ目の接続で入室したとき", () => {
      it("新しい接続が有効になり、古い接続が切断対象として返ること", () => {
        const registry = registryOf(connected("p1", "t1", "古い接続"));

        expect(authorizeJoin(registry, { connectionId: "c9", token: "t1" }, deps(true))).toEqual({
          kind: "resumed",
          playerId: "p1",
          displaced: "古い接続",
          registry: registryOf(connected("p1", "t1", "c9")),
        });
      });
    });

    describe("すでに着席している接続から同じトークンで再度入室したとき", () => {
      it("切断対象が返らないこと", () => {
        const registry = registryOf(connected("p1", "t1", "c1"));

        expect(authorizeJoin(registry, { connectionId: "c1", token: "t1" }, deps(true))).toEqual({
          kind: "resumed",
          playerId: "p1",
          displaced: null,
          registry,
        });
      });
    });
  });
});

describe("releaseSeat", () => {
  describe("正常系", () => {
    describe("接続中の席を解放するとき", () => {
      it("playerId は席に残り、トークンと接続だけが無効化されること", () => {
        const registry = registryOf(connected("p1", "t1", "c1"), connected("p2", "t2", "c2"));

        expect(releaseSeat(registry, "p1")).toEqual({
          displaced: "c1",
          registry: registryOf(vacated("p1"), connected("p2", "t2", "c2")),
        });
      });
    });

    describe("解放された席の古いトークンで入室しようとするとき", () => {
      it("そのトークンでは特定されず、空席の再利用として同じ席に戻れること", () => {
        const { registry } = releaseSeat(registryOf(connected("p1", "t1", "c1")), "p1");

        const outcome = authorizeJoin(registry, { connectionId: "c9", token: "t1" }, deps(false));

        expect(outcome).toEqual({
          kind: "reseated",
          playerId: "p1",
          token: "id-1",
          registry: registryOf(connected("p1", "id-1", "c9")),
        });
      });
    });
  });

  describe("境界値", () => {
    describe("離脱中の席を解放するとき", () => {
      it("席は空席になり、切断すべき接続がないこと", () => {
        const registry = registryOf(away("p1", "t1"));

        expect(releaseSeat(registry, "p1")).toEqual({
          displaced: null,
          registry: registryOf(vacated("p1")),
        });
      });
    });

    describe("存在しない playerId、またはすでに空席の playerId を指定するとき", () => {
      it("レジストリが変化しないこと", () => {
        const registry = registryOf(connected("p1", "t1", "c1"), vacated("p2"));

        expect(releaseSeat(registry, "存在しない")).toEqual({ registry, displaced: null });
        expect(releaseSeat(registry, "p2")).toEqual({ registry, displaced: null });
      });
    });
  });
});

describe("disconnect", () => {
  describe("正常系", () => {
    describe("接続中の席の接続が切れたとき", () => {
      it("離脱中になり、playerId とトークンが保持されること", () => {
        const registry = registryOf(connected("p1", "t1", "c1"), connected("p2", "t2", "c2"));

        expect(disconnect(registry, "c1")).toEqual(
          registryOf(away("p1", "t1"), connected("p2", "t2", "c2")),
        );
      });
    });
  });

  describe("境界値", () => {
    describe("置き換え済みの古い接続の切断が遅れて届いたとき", () => {
      it("現在有効な接続を切らないこと", () => {
        const joined = authorizeJoin(
          registryOf(connected("p1", "t1", "古い接続")),
          { connectionId: "新しい接続", token: "t1" },
          deps(true),
        );
        if (joined.kind !== "resumed") throw new Error(`resumed のはずが ${joined.kind}`);

        expect(disconnect(joined.registry, "古い接続")).toEqual(
          registryOf(connected("p1", "t1", "新しい接続")),
        );
      });
    });

    describe("未知の接続の切断が届いたとき", () => {
      it("レジストリが変化しないこと", () => {
        const registry = registryOf(connected("p1", "t1", "c1"), vacated("p2"));

        expect(disconnect(registry, "未知の接続")).toEqual(registry);
      });
    });
  });
});
