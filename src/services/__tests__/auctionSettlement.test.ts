import { describe, it, expect, vi, beforeEach } from "vitest";
import { settleAuction } from "../auctionSettlement.js";
import type { SettlementDeps } from "../auctionSettlement.js";
import type { Account, AuctionOpportunity, BankOffer } from "../../models/types.js";

const PAST = new Date(Date.now() - 86_400_000).toISOString();
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

const makeAuction = (o: Partial<AuctionOpportunity> = {}): AuctionOpportunity => ({
  id: "a1",
  accountId: "acc1",
  model: "SEALED",
  status: "OPEN",
  eligibleBankIds: ["bank1"],
  openedAt: new Date().toISOString(),
  expiresAt: PAST,
  ...o,
});

const makeOffer = (o: Partial<BankOffer> = {}): BankOffer => ({
  id: "o1",
  auctionId: "a1",
  bankId: "bank1",
  interestRate: 5.0,
  createdAt: new Date().toISOString(),
  ...o,
});

const makeAccount = (o: Partial<Account> = {}): Account => ({
  id: "acc1",
  customerName: "Acme",
  phone: "123",
  email: "acme@test.com",
  status: "ELIGIBLE",
  managerId: "mgr1",
  highActivity: false,
  ...o,
});

let deps: SettlementDeps;

beforeEach(() => {
  deps = {
    findAccount: vi.fn().mockResolvedValue(makeAccount()),
    persistAccount: vi.fn().mockResolvedValue(undefined),
  };
});

describe("settleAuction", () => {
  it("is a no-op when the auction is already CLOSED", async () => {
    const auction = makeAuction({ status: "CLOSED" });
    await settleAuction(auction, [], deps);
    expect(auction.status).toBe("CLOSED");
    expect(deps.findAccount).not.toHaveBeenCalled();
  });

  it("is a no-op when the auction is already EXPIRED", async () => {
    const auction = makeAuction({ status: "EXPIRED" });
    await settleAuction(auction, [], deps);
    expect(auction.status).toBe("EXPIRED");
  });

  it("is a no-op when auction is OPEN but not yet expired", async () => {
    const auction = makeAuction({ expiresAt: FUTURE });
    await settleAuction(auction, [], deps);
    expect(auction.status).toBe("OPEN");
  });

  it("marks EXPIRED when there are no offers", async () => {
    const auction = makeAuction();
    await settleAuction(auction, [], deps);
    expect(auction.status).toBe("EXPIRED");
    expect(deps.findAccount).not.toHaveBeenCalled();
  });

  it("marks CLOSED and sets winner when offers exist", async () => {
    const auction = makeAuction();
    const offer = makeOffer({ id: "w1" });
    await settleAuction(auction, [offer], deps);
    expect(auction.status).toBe("CLOSED");
    expect(auction.winningOfferId).toBe("w1");
  });

  it("marks the account WON and persists it on close", async () => {
    const account = makeAccount();
    (deps.findAccount as ReturnType<typeof vi.fn>).mockResolvedValue(account);
    const auction = makeAuction();
    await settleAuction(auction, [makeOffer()], deps);
    expect(account.status).toBe("WON");
    expect(deps.persistAccount).toHaveBeenCalledWith(account);
  });

  it("force-closes an OPEN auction before its expiry window", async () => {
    const auction = makeAuction({ expiresAt: FUTURE });
    const offer = makeOffer({ id: "forced" });
    await settleAuction(auction, [offer], deps, { force: true });
    expect(auction.status).toBe("CLOSED");
    expect(auction.winningOfferId).toBe("forced");
  });

  it("skips account update when the account no longer exists", async () => {
    (deps.findAccount as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const auction = makeAuction();
    await settleAuction(auction, [makeOffer()], deps);
    expect(auction.status).toBe("CLOSED");
    expect(deps.persistAccount).not.toHaveBeenCalled();
  });
});
