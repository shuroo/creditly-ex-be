import { describe, it, expect, vi, beforeEach } from "vitest";
import { runExpirySweep } from "../auctionExpiryService.js";
import type { ExpirySweepDeps } from "../auctionExpiryService.js";
import { settleAuction } from "../auctionSettlement.js";
import type { AuctionOpportunity, BankOffer } from "../../models/types.js";

const THREE_DAYS_AGO = new Date(Date.now() - 3 * 86_400_000).toISOString();
const PAST = new Date(Date.now() - 86_400_000).toISOString();
const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

const makeOffer = (o: Partial<BankOffer> = {}): BankOffer => ({
  id: "o1",
  auctionId: "a1",
  bankId: "bank1",
  interestRate: 5.0,
  createdAt: new Date().toISOString(),
  ...o,
});

const makeAuction = (o: Partial<AuctionOpportunity> = {}): AuctionOpportunity => ({
  id: "a1",
  accountId: "acc1",
  model: "SEALED",
  status: "OPEN",
  eligibleBankIds: [],
  openedAt: new Date().toISOString(),
  expiresAt: PAST,
  ...o,
});

let deps: ExpirySweepDeps;

beforeEach(() => {
  deps = {
    listAuctions: vi.fn().mockResolvedValue([]),
    settle: vi.fn().mockImplementation(async (auction: AuctionOpportunity) => auction),
  };
});

describe("runExpirySweep", () => {
  it("returns 0 when there are no auctions", async () => {
    expect(await runExpirySweep(deps)).toBe(0);
  });

  it("calls settle for each auction", async () => {
    const auctions = [makeAuction({ id: "a1" }), makeAuction({ id: "a2" })];
    (deps.listAuctions as ReturnType<typeof vi.fn>).mockResolvedValue(auctions);
    await runExpirySweep(deps);
    expect(deps.settle).toHaveBeenCalledTimes(2);
  });

  it("counts auctions whose status changed after settle", async () => {
    const auction = makeAuction({ status: "OPEN" });
    (deps.listAuctions as ReturnType<typeof vi.fn>).mockResolvedValue([auction]);
    (deps.settle as ReturnType<typeof vi.fn>).mockImplementation(
      async (a: AuctionOpportunity) => {
        a.status = "EXPIRED";
        return a;
      }
    );
    const settled = await runExpirySweep(deps);
    expect(settled).toBe(1);
  });

  it("does not count auctions that settle returned unchanged", async () => {
    const auction = makeAuction({ status: "OPEN" });
    (deps.listAuctions as ReturnType<typeof vi.fn>).mockResolvedValue([auction]);
    const settled = await runExpirySweep(deps);
    expect(settled).toBe(0);
  });
});

// Integration: sweep + real settleAuction — verifies the full 3-day expiry path.
describe("3-day expiry — end-to-end via real settleAuction", () => {
  const noopDeps = {
    findAccount: vi.fn().mockResolvedValue(undefined),
    persistAccount: vi.fn().mockResolvedValue(undefined),
  };

  function realSettle(offers: BankOffer[]) {
    return async (auction: AuctionOpportunity): Promise<AuctionOpportunity> => {
      await settleAuction(auction, offers, noopDeps);
      return auction;
    };
  }

  it("marks an auction EXPIRED when 3 days have passed and there are no offers", async () => {
    const auction = makeAuction({ expiresAt: THREE_DAYS_AGO });
    const count = await runExpirySweep({
      listAuctions: async () => [auction],
      settle: realSettle([]),
    });
    expect(auction.status).toBe("EXPIRED");
    expect(count).toBe(1);
  });

  it("marks an auction CLOSED and picks the winner when 3 days have passed with offers", async () => {
    const auction = makeAuction({ expiresAt: THREE_DAYS_AGO });
    const winner = makeOffer({ id: "w1", interestRate: 3.5 });
    const loser = makeOffer({ id: "w2", interestRate: 5.0 });
    await runExpirySweep({
      listAuctions: async () => [auction],
      settle: realSettle([loser, winner]),
    });
    expect(auction.status).toBe("CLOSED");
    expect(auction.winningOfferId).toBe("w1");
  });

  it("does not touch an auction that has not yet reached its 3-day window", async () => {
    const auction = makeAuction({ expiresAt: FUTURE });
    const count = await runExpirySweep({
      listAuctions: async () => [auction],
      settle: realSettle([]),
    });
    expect(auction.status).toBe("OPEN");
    expect(count).toBe(0);
  });

  it("skips an auction that is already CLOSED", async () => {
    const auction = makeAuction({ expiresAt: THREE_DAYS_AGO, status: "CLOSED" });
    const count = await runExpirySweep({
      listAuctions: async () => [auction],
      settle: realSettle([]),
    });
    expect(auction.status).toBe("CLOSED");
    expect(count).toBe(0);
  });
});
