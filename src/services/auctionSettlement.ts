/**
 * Auction settlement service — the single authority for closing an auction and
 * applying all downstream side-effects (account status, CRM notification).
 *
 * Both the manual "close now" endpoint and the periodic expiry sweep delegate
 * here so the outcome is always identical regardless of how settlement was
 * triggered.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import type {
  Account,
  AuctionOpportunity,
  BankOffer,
} from "../models/types.js";
import { isExpired, selectWinner } from "./auctionRules.js";
import * as crm from "./crmService.js";

/**
 * Dependencies injected so this service is decoupled from app.ts and testable.
 */
export type SettlementDeps = {
  /** Look up an account by its UUID. Returns `undefined` if not found. */
  findAccount: (id: string) => Promise<Account | undefined>;
  /** Persist a mutated account back to the store. */
  persistAccount: (account: Account) => Promise<void>;
};

/** Options that modify settlement behaviour. */
export type SettleOptions = {
  /** When `true`, close the auction immediately regardless of the 3-day window. */
  force?: boolean;
};

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
export async function settleAuction(
  auction: AuctionOpportunity,
  offers: BankOffer[],
  deps: SettlementDeps,
  options: SettleOptions = {},
  now: number = Date.now()
): Promise<AuctionOpportunity> {
  if (auction.status !== "OPEN") return auction;
  if (!options.force && !isExpired(auction, now)) return auction;

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
