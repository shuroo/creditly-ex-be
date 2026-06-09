/**
 * Returns true when the given auction's 3-day window has elapsed.
 *
 * @param auction - The auction to evaluate.
 * @param now     - Current epoch ms; defaults to `Date.now()` (injectable for tests).
 * @returns `true` if the auction's `expiresAt` timestamp is in the past.
 */
export function isExpired(auction, now = Date.now()) {
    return now > Date.parse(auction.expiresAt);
}
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
export function selectWinner(offers) {
    return offers.reduce((best, offer) => {
        if (!best)
            return offer;
        if (offer.interestRate < best.interestRate)
            return offer;
        if (offer.interestRate === best.interestRate &&
            Date.parse(offer.createdAt) < Date.parse(best.createdAt)) {
            return offer;
        }
        return best;
    }, undefined);
}
//# sourceMappingURL=auctionRules.js.map