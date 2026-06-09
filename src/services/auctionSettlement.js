import { isExpired, selectWinner } from "./auctionRules.js";
import * as crm from "./crmService.js";
/**
 * Settle an auction and apply its account / CRM side-effects.
 *
 * Decision table:
 * - Already CLOSED or EXPIRED → no-op (idempotent).
 * - Not yet expired and `force` is false → left OPEN (no-op).
 * - Expired with no offers → status set to `"EXPIRED"`; account untouched.
 * - Expired with offers → status set to `"CLOSED"`, `winningOfferId` set to
 *   the lowest-rate offer; the related account's status is changed to `"WON"`
 *   and the CRM is notified.
 *
 * The auction object is mutated in place; the caller is responsible for
 * persisting it.
 *
 * @param auction - The auction to settle (mutated).
 * @param offers  - All bank offers submitted for this auction.
 * @param deps    - Injected I/O helpers.
 * @param options - Optional overrides (`force`).
 * @param now     - Current epoch ms (injectable for tests; defaults to `Date.now()`).
 * @returns The mutated auction.
 */
export async function settleAuction(auction, offers, deps, options = {}, now = Date.now()) {
    if (auction.status !== "OPEN")
        return auction;
    if (!options.force && !isExpired(auction, now))
        return auction;
    const winner = selectWinner(offers);
    if (!winner) {
        auction.status = "EXPIRED";
        return auction;
    }
    auction.status = "CLOSED";
    auction.winningOfferId = winner.id;
    // Winning offer → account marked WON + CRM sync.
    const account = await deps.findAccount(auction.accountId);
    if (account) {
        account.status = "WON";
        await deps.persistAccount(account);
        crm.notifyAccountWon(account, winner);
    }
    return auction;
}
//# sourceMappingURL=auctionSettlement.js.map