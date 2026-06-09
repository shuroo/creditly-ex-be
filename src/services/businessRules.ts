/**
 * Event-driven business rules applied after an event is recorded.
 *
 * All logic is pure-ish (only reads + conditional writes through injected deps)
 * so it can be unit-tested without a real database.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import type { Account, Event } from "../models/types.js";
import * as crm from "./crmService.js";

/**
 * Dependencies injected so the rules stay decoupled from `app.ts` (avoids
 * circular imports) and are unit-testable with in-memory fakes.
 */
export type EventRuleDeps = {
  /** Return all events currently in the store (used to count recent activity). */
  listEvents: () => Promise<Event[]>;
  /** Look up an account by its UUID. Returns `undefined` if not found. */
  findAccount: (id: string) => Promise<Account | undefined>;
  /** Persist a mutated account back to the store. */
  persistAccount: (account: Account) => Promise<void>;
};

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
export async function applyEventRules(
  event: Event,
  deps: EventRuleDeps,
  now: number = Date.now()
): Promise<void> {
  const account = await deps.findAccount(event.accountId);
  if (!account) return; // event may reference an account not in the store

  let changed = false;

  // High-activity rule: count events for this account in the last 24 hours.
  const cutoff = now - DAY_MS;
  const recentCount = (await deps.listEvents())
    .filter(
      (e) => e.accountId === account.id && Date.parse(e.createdAt) >= cutoff
    ).length;
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
