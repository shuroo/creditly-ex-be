/**
 * Pure auction rule functions — no I/O, no side-effects.
 * All business logic for determining expiry and selecting a winner lives here
 * so it can be unit-tested independently of any persistence layer.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import type { AuctionOpportunity, BankOffer } from "../models/types.js";
/**
 * Returns true when the given auction's 3-day window has elapsed.
 *
 * @param auction - The auction to evaluate.
 * @param now     - Current epoch ms; defaults to `Date.now()` (injectable for tests).
 * @returns `true` if the auction's `expiresAt` timestamp is in the past.
 */
export declare function isExpired(auction: AuctionOpportunity, now?: number): boolean;
/**
 * Select the winning offer from a set of bids.
 *
 * Spec: "lowest interest rate wins; ties are broken by earliest submission".
 * Returns `undefined` when the offers array is empty (auction should expire).
 *
 * @param offers - All offers submitted for an auction.
 * @returns The {@link BankOffer} with the lowest rate (earliest submission on tie),
 *          or `undefined` if no offers were provided.
 */
export declare function selectWinner(offers: BankOffer[]): BankOffer | undefined;
//# sourceMappingURL=auctionRules.d.ts.map