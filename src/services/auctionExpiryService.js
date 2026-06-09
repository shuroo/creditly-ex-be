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
export async function runExpirySweep(deps) {
    let settled = 0;
    for (const auction of await deps.listAuctions()) {
        const before = auction.status;
        await deps.settle(auction);
        if (auction.status !== before)
            settled++;
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
export function startAuctionExpiryService(deps, intervalMs = DEFAULT_INTERVAL_MS) {
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
//# sourceMappingURL=auctionExpiryService.js.map