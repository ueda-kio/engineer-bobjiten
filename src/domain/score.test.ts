import { describe, expect, it } from "vitest";
import { settleRound } from "./score";

describe("settleRound", () => {
  describe("正常系", () => {
    describe("お助け機能も引き直しも使わなかったとき", () => {
      it("出題者・正解者ともに難易度と同じ点数になること", () => {
        expect(settleRound({ difficulty: 3, consumptions: 0 })).toEqual({
          presenter: 3,
          answerer: 3,
        });
      });
    });

    describe("消費が1のとき", () => {
      it("出題者は難易度から1減り、正解者は満額のままであること", () => {
        expect(settleRound({ difficulty: 3, consumptions: 1 })).toEqual({
          presenter: 2,
          answerer: 3,
        });
      });
    });
  });

  describe("境界値", () => {
    describe("消費が難易度と同数のとき", () => {
      it("出題者が0点になること", () => {
        expect(settleRound({ difficulty: 2, consumptions: 2 }).presenter).toBe(0);
      });
    });

    describe("消費が難易度を超えるとき", () => {
      it("出題者が0点に留まり、負の値にならないこと", () => {
        expect(settleRound({ difficulty: 1, consumptions: 5 }).presenter).toBe(0);
      });
    });

    describe("難易度3で2つ消費した場合と、難易度1を無消費で成功させた場合", () => {
      it("出題者の得点が一致すること", () => {
        expect(settleRound({ difficulty: 3, consumptions: 2 }).presenter).toBe(
          settleRound({ difficulty: 1, consumptions: 0 }).presenter,
        );
      });
    });
  });
});
