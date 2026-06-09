import { crmIntegration } from "../integration/crm-integration.js";
/** In-memory append-only log; the `GET /crm-log` endpoint exposes a copy. */
const log = [];
/**
 * Append a pending log entry then fire the async CRM call.
 * The entry is mutated in place once the call resolves.
 */
function record(event, request) {
    log.push(event);
    console.log(`[crm] ${event.kind} account=${event.accountId} :: ${event.detail}`);
    crmIntegration
        .sync(request)
        .then((response) => {
        if (response.success) {
            event.syncStatus = "success";
            if (response.syncedAt)
                event.syncedAt = response.syncedAt;
        }
        else {
            event.syncStatus = "failed";
            event.failureReason = response.failureReason ?? "Unknown CRM error";
            console.error(`[crm] FAILED account=${event.accountId} trigger=${event.trigger} :: ${event.failureReason}`);
        }
    })
        .catch((err) => {
        event.syncStatus = "failed";
        event.failureReason = err instanceof Error ? err.message : String(err);
        console.error(`[crm] ERROR account=${event.accountId} trigger=${event.trigger} ::`, err);
    });
}
/**
 * Push the latest account state to the CRM (e.g. after a document upload or
 * a status change).
 *
 * @param account - The account whose state should be synced.
 * @param trigger - The CRM trigger type that caused this sync.
 */
export function syncAccount(account, trigger) {
    const event = {
        kind: "sync",
        accountId: account.id,
        at: new Date().toISOString(),
        detail: `sync (${trigger}); lastActivity=${account.lastActivity ?? "n/a"}`,
        trigger,
        syncStatus: "pending",
    };
    record(event, { trigger, entityId: account.id, payload: account });
}
/**
 * Notify the CRM that an account won an auction at a given interest rate.
 *
 * @param account - The account that was marked WON.
 * @param offer   - The winning bank offer.
 */
export function notifyAccountWon(account, offer) {
    const event = {
        kind: "won",
        accountId: account.id,
        at: new Date().toISOString(),
        detail: `won auction ${offer.auctionId} via ${offer.bankId} @ ${offer.interestRate}`,
        trigger: "winning_offer_selected",
        syncStatus: "pending",
    };
    record(event, {
        trigger: "winning_offer_selected",
        entityId: account.id,
        payload: {
            auctionId: offer.auctionId,
            winningOfferId: offer.id,
            interestRate: offer.interestRate,
        },
    });
}
/**
 * Return a read-only snapshot of the full CRM event log (newest entries last).
 * Each entry reflects the *current* syncStatus — callers may see `"pending"`
 * entries if the async CRM call has not yet resolved.
 *
 * @returns A shallow copy of the internal log array.
 */
export function getCrmLog() {
    return [...log];
}
/**
 * Clear the in-memory log.
 * Intended for test isolation only — do not call in production code.
 */
export function clearLog() {
    log.splice(0, log.length);
}
//# sourceMappingURL=crmService.js.map