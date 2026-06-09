/**
 * Periodic auction-expiry sweep service.
 *
 * Runs one pass over all open auctions on startup and then on a configurable
 * interval. Any auction whose 3-day window has elapsed is settled via the
 * injected `settle` callback (which delegates to {@link settleAuction} in
 * production), guaranteeing closure even if no client ever requests it.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import type { AuctionOpportunity } from "../models/types.js";

/**
 * Dependencies the sweep needs, injected so this service stays decoupled from
 * `app.ts` (avoids circular imports) and is easy to test with fakes.
 *
 * `settle` must be idempotent on already-settled auctions and must mutate the
 * auction in place so that `runExpirySweep` can detect a status change.
 */
export type ExpirySweepDeps = {
  /** Return all auctions (OPEN, CLOSED, and EXPIRED). */
  listAuctions: () => Promise<AuctionOpportunity[]>;
  /**
   * Settle one auction (timeout path): applies the outcome, persists the
   * auction and its account side-effects, and returns the mutated auction.
   */
  settle: (auction: AuctionOpportunity) => Promise<AuctionOpportunity>;
};

/**
 * Execute one sweep pass: settle every auction whose expiry window has elapsed.
 *
 * Iterates all auctions and calls `deps.settle` on each one. A status change
 * after `settle` returns counts as "settled". The actual outcome logic (CLOSED
 * with winner, EXPIRED with no offers) lives inside the injected `settle`, so
 * this sweep is identical to the request-driven close path.
 *
 * @param deps - Injected I/O helpers.
 * @returns The number of auctions whose status changed during this pass.
 */
export async function runExpirySweep(deps: ExpirySweepDeps): Promise<number> {
  let settled = 0;
  for (const auction of await deps.listAuctions()) {
    const before = auction.status;
    await deps.settle(auction);
    if (auction.status !== before) settled++;
  }
  return settled;
}

/** 1-minute tick — much finer than a 3-day window, negligible overhead. */
const DEFAULT_INTERVAL_MS = 60_000;

/**
 * Start the periodic auction-expiry sweep.
 *
 * Runs one pass immediately to settle anything already overdue at startup, then
 * repeats on the given interval. The timer is `unref`'d so it never prevents
 * a clean process exit. Call `stop()` on graceful shutdown or in tests.
 *
 * @param deps       - Injected I/O helpers (see {@link ExpirySweepDeps}).
 * @param intervalMs - How often to sweep, in milliseconds (default: 60 000).
 * @returns An object with a `stop()` method that clears the interval.
 */
export function startAuctionExpiryService(
  deps: ExpirySweepDeps,
  intervalMs: number = DEFAULT_INTERVAL_MS
): { stop: () => void } {
  const tick = () => {
    runExpirySweep(deps)
      .then((settled) => {
        if (settled > 0) {
          console.log(`[auction-expiry] settled ${settled} expired auction(s)`);
        }
      })
      .catch((err) => console.error("[auction-expiry] sweep failed", err));
  };

  tick(); // settle anything already overdue at startup

  const handle = setInterval(tick, intervalMs);
  handle.unref?.();

  return { stop: () => clearInterval(handle) };
}
