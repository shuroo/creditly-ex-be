import { describe, it, expect } from "vitest";
import { isExpired, selectWinner } from "../auctionRules.js";
import type { AuctionOpportunity, BankOffer } from "../../models/types.js";

const makeAuction = (o: Partial<AuctionOpportunity> = {}): AuctionOpportunity => ({
  _id: "a1",
  accountId: "acc1",
  model: "SEALED",
  status: "OPEN",
  eligibleBankIds: [],
  openedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  ...o,
});

const makeOffer = (o: Partial<BankOffer> = {}): BankOffer => ({
  _id: "o1",
  auctionId: "a1",
  bankId: "bank1",
  interestRate: 5.0,
  createdAt: new Date(1000).toISOString(),
  ...o,
});

describe("isExpired", () => {
  it("returns false when expiresAt is in the future", () => {
    const auction = makeAuction({ expiresAt: new Date(Date.now() + 1000).toISOString() });
    expect(isExpired(auction)).toBe(false);
  });

  it("returns true when expiresAt is in the past", () => {
    const auction = makeAuction({ expiresAt: new Date(Date.now() - 1000).toISOString() });
    expect(isExpired(auction)).toBe(true);
  });

  it("respects the provided now timestamp", () => {
    const expiresAt = new Date(1000).toISOString();
    expect(isExpired(makeAuction({ expiresAt }), 500)).toBe(false);
    expect(isExpired(makeAuction({ expiresAt }), 2000)).toBe(true);
  });
});

describe("selectWinner", () => {
  it("returns undefined for an empty list", () => {
    expect(selectWinner([])).toBeUndefined();
  });

  it("returns the only offer when there is one", () => {
    const offer = makeOffer();
    expect(selectWinner([offer])).toBe(offer);
  });

  it("picks the offer with the lowest interest rate", () => {
    const low = makeOffer({ _id: "low", interestRate: 3 });
    const high = makeOffer({ _id: "high", interestRate: 7 });
    expect(selectWinner([high, low])).toBe(low);
  });

  it("breaks a tie by earliest createdAt", () => {
    const first = makeOffer({ _id: "first", interestRate: 5, createdAt: new Date(1000).toISOString() });
    const second = makeOffer({ _id: "second", interestRate: 5, createdAt: new Date(2000).toISOString() });
    expect(selectWinner([second, first])).toBe(first);
  });

  it("does not beat the winner when a later offer matches its rate", () => {
    const winner = makeOffer({ _id: "w", interestRate: 4, createdAt: new Date(500).toISOString() });
    const later = makeOffer({ _id: "l", interestRate: 4, createdAt: new Date(1500).toISOString() });
    expect(selectWinner([later, winner])).toBe(winner);
  });
});
