/**
 * CRM notification service.
 *
 * Every outbound CRM call is written to an in-memory log *immediately* with
 * `syncStatus = "pending"`, then the real async call to {@link CrmIntegration}
 * runs fire-and-forget. The log entry is updated in place when the response
 * arrives:
 *
 * - success  → `syncStatus = "success"`, `syncedAt` set.
 * - failure  → `syncStatus = "failed"`, `failureReason` set.
 *
 * This keeps the critical request path non-blocking while still giving the
 * `GET /crm-log` endpoint an auditable record of every attempt and its outcome.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import type { Account, BankOffer } from "../models/types.js";
import type { CrmTrigger } from "../integration/crm-integration.js";
/**
 * A single entry in the CRM activity log.
 *
 * Entries start as `"pending"` and are updated in place once the async CRM
 * call resolves or rejects.
 */
export type CrmEvent = {
    /** Broad category of the notification. */
    kind: "sync" | "won";
    /** The account the notification relates to. */
    accountId: string;
    /** ISO-8601 timestamp when the notification was dispatched. */
    at: string;
    /** Human-readable detail string for debugging. */
    detail: string;
    /** The CRM trigger type that caused this sync. */
    trigger: CrmTrigger;
    /** Outcome of the async CRM call. Starts as `"pending"` until resolved. */
    syncStatus: "pending" | "success" | "failed";
    /** ISO-8601 timestamp returned by the CRM on success. */
    syncedAt?: string;
    /** Human-readable reason returned by the CRM (or thrown error) on failure. */
    failureReason?: string;
};
/**
 * Push the latest account state to the CRM (e.g. after a document upload or
 * a status change).
 *
 * @param account - The account whose state should be synced.
 * @param trigger - The CRM trigger type that caused this sync.
 */
export declare function syncAccount(account: Account, trigger: CrmTrigger): void;
/**
 * Notify the CRM that an account won an auction at a given interest rate.
 *
 * @param account - The account that was marked WON.
 * @param offer   - The winning bank offer.
 */
export declare function notifyAccountWon(account: Account, offer: BankOffer): void;
/**
 * Return a read-only snapshot of the full CRM event log (newest entries last).
 * Each entry reflects the *current* syncStatus — callers may see `"pending"`
 * entries if the async CRM call has not yet resolved.
 *
 * @returns A shallow copy of the internal log array.
 */
export declare function getCrmLog(): CrmEvent[];
/**
 * Clear the in-memory log.
 * Intended for test isolation only — do not call in production code.
 */
export declare function clearLog(): void;
//# sourceMappingURL=crmService.d.ts.map