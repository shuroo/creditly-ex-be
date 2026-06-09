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
import { crmIntegration } from "../integration/crm-integration.js";
import type { CrmSyncRequest, CrmTrigger } from "../integration/crm-integration.js";

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

/** In-memory append-only log; the `GET /crm-log` endpoint exposes a copy. */
const log: CrmEvent[] = [];

/**
 * Append a pending log entry then fire the async CRM call.
 * The entry is mutated in place once the call resolves.
 */
function record(event: CrmEvent, request: CrmSyncRequest): void {
  log.push(event);
  console.log(`[crm] ${event.kind} account=${event.accountId} :: ${event.detail}`);

  crmIntegration
    .sync(request)
    .then((response) => {
      if (response.success) {
        event.syncStatus = "success";
        if (response.syncedAt) event.syncedAt = response.syncedAt;
      } else {
        event.syncStatus = "failed";
        event.failureReason = response.failureReason ?? "Unknown CRM error";
        console.error(
          `[crm] FAILED account=${event.accountId} trigger=${event.trigger} :: ${event.failureReason}`
        );
      }
    })
    .catch((err: unknown) => {
      event.syncStatus = "failed";
      event.failureReason = err instanceof Error ? err.message : String(err);
      console.error(
        `[crm] ERROR account=${event.accountId} trigger=${event.trigger} ::`,
        err
      );
    });
}

/**
 * Push the latest account state to the CRM (e.g. after a document upload or
 * a status change).
 *
 * @param account - The account whose state should be synced.
 * @param trigger - The CRM trigger type that caused this sync.
 */
export function syncAccount(account: Account, trigger: CrmTrigger): void {
  const event: CrmEvent = {
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
export function notifyAccountWon(account: Account, offer: BankOffer): void {
  const event: CrmEvent = {
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
export function getCrmLog(): CrmEvent[] {
  return [...log];
}

/**
 * Clear the in-memory log.
 * Intended for test isolation only — do not call in production code.
 */
export function clearLog(): void {
  log.splice(0, log.length);
}
