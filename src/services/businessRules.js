import * as crm from "./crmService.js";
/** 24-hour window used for the high-activity threshold check. */
const DAY_MS = 24 * 60 * 60 * 1000;
/** Minimum number of events within 24 h that triggers the high-activity flag. */
const HIGH_ACTIVITY_THRESHOLD = 3; // strictly MORE than 3 events
/**
 * Apply the event-driven business rules for a newly created event.
 *
 * Rules evaluated (in order):
 * 1. **High-activity**: if the account has strictly more than 3 events in the
 *    past 24 hours and `highActivity` is not already set, mark the account.
 * 2. **Document uploaded**: update `account.lastActivity` to the event's
 *    timestamp and trigger a CRM sync (returns early — the `changed` flag is
 *    handled inside the branch).
 *
 * Exits silently when the referenced account does not exist.
 *
 * @param event - The event that was just created.
 * @param deps  - Injected I/O helpers.
 * @param now   - Current epoch ms (injectable for tests; defaults to `Date.now()`).
 */
export async function applyEventRules(event, deps, now = Date.now()) {
    const account = await deps.findAccount(event.accountId);
    if (!account)
        return; // event may reference an account not in the store
    let changed = false;
    // High-activity rule: count events for this account in the last 24 hours.
    const cutoff = now - DAY_MS;
    const recentCount = (await deps.listEvents())
        .filter((e) => e.accountId === account.id && Date.parse(e.createdAt) >= cutoff).length;
    if (recentCount > HIGH_ACTIVITY_THRESHOLD && !account.highActivity) {
        account.highActivity = true;
        changed = true;
    }
    // document_uploaded rule: update lastActivity + trigger CRM sync.
    if (event.type === "document_uploaded") {
        account.lastActivity = event.createdAt;
        changed = true;
        await deps.persistAccount(account);
        crm.syncAccount(account, "document_uploaded");
        return;
    }
    if (changed) {
        await deps.persistAccount(account);
    }
}
//# sourceMappingURL=businessRules.js.map