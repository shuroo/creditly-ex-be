import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import {
  authenticate,
  requireRole,
  signToken,
} from "./middleware/authContext.js";

import {
  userRepository,
  accountRepository,
  eventRepository,
  auctionRepository,
  bankOfferRepository
} from "./repositories/repositories.js";

import type {
  User,
  Account,
  Event,
  AuctionOpportunity,
  BankOffer,
  Role,
} from "./models/types.js";
import { AUCTION_DURATION_DAYS } from "./models/types.js";

import { CrudService } from "./services/crudService.js";
import { isExpired } from "./services/auctionRules.js";
import {
  canManageAccount,
  scopeAccountsForUser,
  scopeEventsForUser,
  stripAccountPII,
  toPublicUser,
} from "./services/rbac.js";
import { startAuctionExpiryService } from "./services/auctionExpiryService.js";
import { applyEventRules } from "./services/businessRules.js";
import { settleAuction } from "./services/auctionSettlement.js";
import { getCrmLog } from "./services/crmService.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:3000",
  })
);
app.use(express.json());

const userService = new CrudService<User>(userRepository);
const accountService = new CrudService<Account>(accountRepository);
const eventService = new CrudService<Event>(eventRepository);
const auctionService = new CrudService<AuctionOpportunity>(auctionRepository);
const bankOfferService = new CrudService<BankOffer>(bankOfferRepository);

/** All offers submitted for a given auction. */
async function offersForAuction(auctionId: string): Promise<BankOffer[]> {
  return (await bankOfferService.findAll()).filter((o) => o.auctionId === auctionId);
}

// Shared dependency bundles so the dedicated business-logic services stay
// decoupled from the controllers (and from app.ts) while reusing the stores.
const accountSideEffects = {
  findAccount: async (id: string): Promise<Account | undefined> => {
    try {
      return await accountService.findById(id);
    } catch {
      return undefined;
    }
  },
  persistAccount: async (account: Account): Promise<void> => {
    await accountService.update(account.id, account);
  },
};

const eventRuleDeps = {
  listEvents: () => eventService.findAll(),
  ...accountSideEffects,
};

/** Settle one auction (manual or timeout) applying account/CRM side effects. */
async function settleAndPersist(
  auction: AuctionOpportunity,
  options: { force?: boolean } = {}
): Promise<AuctionOpportunity> {
  await settleAuction(auction, await offersForAuction(auction.id), accountSideEffects, options);
  await auctionService.update(auction.id, auction);
  return auction;
}

const VALID_ROLES: Role[] = ["ADMIN", "MANAGER", "USER", "BANKER"];

// ---------------------------------------------------------------------------
// Public auth endpoints (no token required). Registered BEFORE authenticate.
// ---------------------------------------------------------------------------

/** Open registration: create a user and return a token + public profile. */
app.post("/register", async (req, res) => {
  const { name, email, password, role, bankId } = req.body ?? {};

  if (!name || !email || !password || !role) {
    return res
      .status(400)
      .json({ message: "name, email, password and role are required" });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ message: "Invalid role" });
  }
  if (role === "BANKER" && !bankId) {
    return res.status(400).json({ message: "bankId is required for a banker" });
  }
  if ((await userService.findAll()).some((u) => u.email === email)) {
    return res.status(409).json({ message: "Email already registered" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await userService.create({
    name,
    email,
    role,
    passwordHash,
    ...(role === "BANKER" ? { bankId } : {}),
  });

  return res
    .status(201)
    .json({ token: signToken(user), user: toPublicUser(user) });
});

/** Login: verify credentials and return a token + public profile. */
app.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const user = (await userService.findAll()).find((u) => u.email === email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  return res.json({ token: signToken(user), user: toPublicUser(user) });
});

app.get("/health", (_req, res) => {
  res.json({ status: "OK" });
});

// Everything below requires a valid token.
app.use(authenticate);

/** Current authenticated user's public profile. */
app.get("/me", (req, res) => {
  res.json(req.user);
});

// ---------------------------------------------------------------------------
// Accounts — Manager sees only assigned; User sees only related; Banker none.
// ---------------------------------------------------------------------------

app.get(
  "/accounts",
  requireRole("ADMIN", "MANAGER", "USER", "BANKER"),
  async (req, res) => {
    const user = req.user!;
    const scoped = scopeAccountsForUser(
      await accountService.findAll(),
      user,
      await eventService.findAll(),
      await auctionService.findAll()
    );
    const result = user.role === "BANKER" ? scoped.map(stripAccountPII) : scoped;
    res.json(result);
  }
);

app.get(
  "/accounts/:id",
  requireRole("ADMIN", "MANAGER", "USER", "BANKER"),
  async (req, res) => {
    const user = req.user!;
    const id = req.params.id as string;
    let account: Account;
    try {
      account = await accountService.findById(id);
    } catch {
      return res.status(404).json({ message: "Not found" });
    }
    const visible = scopeAccountsForUser(
      [account],
      user,
      await eventService.findAll(),
      await auctionService.findAll()
    );
    if (visible.length === 0) {
      return res.status(404).json({ message: "Not found" });
    }
    const result = user.role === "BANKER" ? stripAccountPII(visible[0]!) : visible[0]!;
    res.json(result);
  }
);

/** Create an account. A manager always owns the accounts they create. */
app.post(
  "/accounts",
  requireRole("ADMIN", "MANAGER"),
  async (req, res) => {
    const user = req.user!;
    const managerId =
      user.role === "MANAGER" ? user.id : req.body.managerId ?? user.id;

    const created = await accountService.create({
      customerName: req.body.customerName,
      phone: req.body.phone,
      email: req.body.email,
      status: req.body.status ?? "NEW",
      managerId,
      highActivity: Boolean(req.body.highActivity),
      ...(req.body.lastActivity ? { lastActivity: req.body.lastActivity } : {}),
      ...(req.body.salary !== undefined ? { salary: Number(req.body.salary) } : {}),
      ...(req.body.loanAmount !== undefined ? { loanAmount: Number(req.body.loanAmount) } : {}),
      ...(req.body.propertyValue !== undefined ? { propertyValue: Number(req.body.propertyValue) } : {}),
    });
    res.status(201).json(created);
  }
);

// ---------------------------------------------------------------------------
// Events — User can create; reads scoped by creator / assigned accounts.
// ---------------------------------------------------------------------------

app.get(
  "/events",
  requireRole("ADMIN", "MANAGER", "USER"),
  async (req, res) => {
    const user = req.user!;
    const scoped = scopeEventsForUser(
      await eventService.findAll(),
      user,
      await accountService.findAll()
    );
    res.json(scoped);
  }
);

/** Create an event. createdByUserId is always the authenticated user. */
app.post(
  "/events",
  requireRole("ADMIN", "MANAGER", "USER"),
  async (req, res) => {
    const user = req.user!;

    try {
      await accountService.findById(req.body.accountId);
    } catch {
      return res.status(404).json({ message: "Account not found" });
    }

    const created = await eventService.create({
      accountId: req.body.accountId,
      type: req.body.type,
      createdByUserId: user.id,
      createdAt: new Date().toISOString(),
      ...(req.body.description ? { description: req.body.description } : {}),
    });

    // Delegate event-driven business rules (high activity, document sync) to
    // the dedicated service rather than inlining them here.
    await applyEventRules(created, eventRuleDeps);

    res.status(201).json(created);
  }
);

/**
 * Banker can view only:
 * - open auctions
 * - auctions matching their bank eligibility
 *
 * Banker must NOT access personal customer data.
 */
app.get(
  "/auction-opportunities",
  requireRole("ADMIN", "MANAGER", "BANKER"),
  async (req, res) => {
    const currentUser = req.user!;

    // Lazy auto-close: settle any auction whose 3-day window has elapsed
    // before returning, applying account/CRM side effects via the service.
    let auctions = await auctionService.findAll();
    for (const auction of auctions) {
      await settleAndPersist(auction);
    }

    if (currentUser.role === "BANKER") {
      auctions = auctions.filter(
        (auction) =>
          auction.status === "OPEN" &&
          auction.eligibleBankIds.includes(currentUser.bankId ?? "")
      );
    } else if (currentUser.role === "MANAGER") {
      // A manager only runs auctions for their own accounts.
      const myAccountIds = new Set(
        (await accountService.findAll())
          .filter((a) => a.managerId === currentUser.id)
          .map((a) => a.id)
      );
      auctions = auctions.filter((a) => myAccountIds.has(a.accountId));
    }

    res.json(auctions);
  }
);

/**
 * Manager opens an auction. The server owns the lifecycle fields: the auction
 * always opens now, runs for a fixed 3-day window, starts OPEN with no winner,
 * and uses the SEALED model. Any client-supplied openedAt/expiresAt/status/
 * winningOfferId/model is ignored so the duration rule can't be bypassed.
 */
app.post(
  "/auction-opportunities",
  requireRole("ADMIN", "MANAGER"),
  async (req, res) => {
    const user = req.user!;

    // A manager may only open auctions on accounts assigned to them.
    let account: Account;
    try {
      account = await accountService.findById(req.body.accountId);
    } catch {
      return res.status(404).json({ message: "Account not found" });
    }
    if (!canManageAccount(account, user)) {
      return res
        .status(403)
        .json({ message: "You may only open auctions for your own accounts" });
    }

    const openedAt = new Date();
    const expiresAt = new Date(openedAt);
    expiresAt.setDate(expiresAt.getDate() + AUCTION_DURATION_DAYS);

    const created = await auctionService.create({
      accountId: req.body.accountId,
      eligibleBankIds: Array.isArray(req.body.eligibleBankIds)
        ? req.body.eligibleBankIds
        : [],
      model: "SEALED",
      status: "OPEN",
      openedAt: openedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    res.status(201).json(created);
  }
);

/**
 * Manager/admin closes an auction early and selects the winner (lowest rate).
 * Closing an already-settled (CLOSED/EXPIRED) auction is a no-op conflict.
 */
app.post(
  "/auction-opportunities/:id/close",
  requireRole("ADMIN", "MANAGER"),
  async (req, res) => {
    const id = req.params.id as string;

    let auction: AuctionOpportunity;
    try {
      auction = await auctionService.findById(id);
    } catch {
      return res.status(404).json({ message: "Auction not found" });
    }

    // A manager may only close auctions on accounts assigned to them.
    const user = req.user!;
    try {
      const account = await accountService.findById(auction.accountId);
      if (!canManageAccount(account, user)) {
        return res.status(403).json({
          message: "You may only close auctions for your own accounts",
        });
      }
    } catch {
      // Account gone; allow admins through, block managers.
      if (user.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    if (auction.status !== "OPEN") {
      return res
        .status(409)
        .json({ message: `Auction is already ${auction.status}` });
    }

    await settleAndPersist(auction, { force: true });

    res.json(auction);
  }
);

/**
 * Submit a bank offer. Sealed-auction rules, enforced for every submitter:
 * - auction must exist and be OPEN
 * - no offers after expiration (spec)
 * - the bank must be eligible for the auction
 * - one offer per bank per auction (sealed: a single blind submission)
 *
 * A banker always submits on behalf of their own bank (anti-forgery); an admin
 * must name the bank in the body.
 */
app.post(
  "/bank-offers",
  requireRole("ADMIN", "BANKER"),
  async (req, res) => {
    const currentUser = req.user!;
    const { auctionId } = req.body;

    let auction: AuctionOpportunity;
    try {
      auction = await auctionService.findById(auctionId);
    } catch {
      return res.status(404).json({ message: "Auction not found" });
    }

    // A banker can only ever act as their own bank; an admin names the bank.
    const bankId =
      currentUser.role === "BANKER" ? currentUser.bankId : req.body.bankId;

    if (!bankId) {
      return res.status(400).json({ message: "bankId is required" });
    }

    // Settle a lapsed auction first so an expired-but-still-OPEN auction is
    // rejected with the right reason below (and runs its side effects).
    await settleAndPersist(auction);

    if (isExpired(auction)) {
      return res
        .status(403)
        .json({ message: "No offers allowed after expiration" });
    }

    if (auction.status !== "OPEN") {
      return res.status(409).json({ message: "Auction is not open" });
    }

    if (!auction.eligibleBankIds.includes(bankId)) {
      return res
        .status(403)
        .json({ message: "This bank is not eligible for the auction" });
    }

    // Sealed model: a bank submits exactly once per auction.
    const alreadySubmitted = (await offersForAuction(auctionId)).some(
      (o) => o.bankId === bankId
    );
    if (alreadySubmitted) {
      return res.status(409).json({
        message:
          "This bank has already submitted an offer for this auction (sealed auction)",
      });
    }

    const created = await bankOfferService.create({
      auctionId,
      bankId,
      interestRate: Number(req.body.interestRate),
      createdAt: new Date().toISOString(),
    });

    res.status(201).json(created);
  }
);

app.get(
  "/bank-offers",
  requireRole("ADMIN", "BANKER"),
  async (req, res) => {
    const currentUser = req.user!;

    let offers = await bankOfferService.findAll();

    if (currentUser.role === "BANKER") {
      offers = offers.filter((offer) => offer.bankId === currentUser.bankId);
    }

    res.json(offers);
  }
);

/** Admin-only directory of users (password hashes stripped). */
app.get("/users", requireRole("ADMIN"), async (_req, res) => {
  res.json((await userService.findAll()).map(toPublicUser));
});

/** Admin-only view of the mock CRM activity log. */
app.get("/crm-log", requireRole("ADMIN"), (_req, res) => {
  res.json(getCrmLog());
});

// ---------------------------------------------------------------------------
// New REST-scoped routes — cleaner resource URLs added alongside the originals.
// ---------------------------------------------------------------------------

/** Open an auction scoped directly to an account's URL. */
app.post(
  "/accounts/:id/auctions",
  requireRole("ADMIN", "MANAGER"),
  async (req, res) => {
    const user = req.user!;
    const accountId = req.params.id as string;

    let account: Account;
    try {
      account = await accountService.findById(accountId);
    } catch {
      return res.status(404).json({ message: "Account not found" });
    }
    if (!canManageAccount(account, user)) {
      return res
        .status(403)
        .json({ message: "You may only open auctions for your own accounts" });
    }

    const openedAt = new Date();
    const expiresAt = new Date(openedAt);
    expiresAt.setDate(expiresAt.getDate() + AUCTION_DURATION_DAYS);

    const created = await auctionService.create({
      accountId,
      eligibleBankIds: Array.isArray(req.body.eligibleBankIds)
        ? req.body.eligibleBankIds
        : [],
      model: "SEALED",
      status: "OPEN",
      openedAt: openedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    res.status(201).json(created);
  }
);

/** Submit a bank offer scoped directly to an auction's URL. */
app.post(
  "/auctions/:id/offers",
  requireRole("ADMIN", "BANKER"),
  async (req, res) => {
    const currentUser = req.user!;
    const auctionId = req.params.id as string;

    let auction: AuctionOpportunity;
    try {
      auction = await auctionService.findById(auctionId);
    } catch {
      return res.status(404).json({ message: "Auction not found" });
    }

    const bankId =
      currentUser.role === "BANKER" ? currentUser.bankId : req.body.bankId;
    if (!bankId) {
      return res.status(400).json({ message: "bankId is required" });
    }

    await settleAndPersist(auction);

    if (isExpired(auction)) {
      return res
        .status(403)
        .json({ message: "No offers allowed after expiration" });
    }
    if (auction.status !== "OPEN") {
      return res.status(409).json({ message: "Auction is not open" });
    }
    if (!auction.eligibleBankIds.includes(bankId)) {
      return res
        .status(403)
        .json({ message: "This bank is not eligible for the auction" });
    }

    const alreadySubmitted = (await offersForAuction(auctionId)).some(
      (o) => o.bankId === bankId
    );
    if (alreadySubmitted) {
      return res.status(409).json({
        message:
          "This bank has already submitted an offer for this auction (sealed auction)",
      });
    }

    const created = await bankOfferService.create({
      auctionId,
      bankId,
      interestRate: Number(req.body.interestRate),
      createdAt: new Date().toISOString(),
    });

    res.status(201).json(created);
  }
);

/** Close an auction scoped directly to its URL (lowest rate wins). */
app.post(
  "/auctions/:id/close",
  requireRole("ADMIN", "MANAGER"),
  async (req, res) => {
    const id = req.params.id as string;

    let auction: AuctionOpportunity;
    try {
      auction = await auctionService.findById(id);
    } catch {
      return res.status(404).json({ message: "Auction not found" });
    }

    const user = req.user!;
    try {
      const account = await accountService.findById(auction.accountId);
      if (!canManageAccount(account, user)) {
        return res.status(403).json({
          message: "You may only close auctions for your own accounts",
        });
      }
    } catch {
      if (user.role !== "ADMIN") {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    if (auction.status !== "OPEN") {
      return res
        .status(409)
        .json({ message: `Auction is already ${auction.status}` });
    }

    await settleAndPersist(auction, { force: true });

    res.json(auction);
  }
);

/** Aggregate stats scoped to the caller's visibility (ADMIN sees all, MANAGER sees own). */
app.get(
  "/analytics/summary",
  requireRole("ADMIN", "MANAGER"),
  async (req, res) => {
    const user = req.user!;

    let accounts = await accountService.findAll();
    let events = await eventService.findAll();
    let auctions = await auctionService.findAll();
    let offers = await bankOfferService.findAll();

    if (user.role === "MANAGER") {
      accounts = accounts.filter((a) => a.managerId === user.id);
      const myAccountIds = new Set(accounts.map((a) => a.id));
      auctions = auctions.filter((a) => myAccountIds.has(a.accountId));
      events = events.filter((e) => myAccountIds.has(e.accountId));
      const myAuctionIds = new Set(auctions.map((a) => a.id));
      offers = offers.filter((o) => myAuctionIds.has(o.auctionId));
    }

    const countBy = <T>(arr: T[], key: (item: T) => string): Record<string, number> =>
      arr.reduce((acc, item) => {
        const k = key(item);
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    res.json({
      accounts: {
        total: accounts.length,
        byStatus: countBy(accounts, (a) => a.status),
        highActivity: accounts.filter((a) => a.highActivity).length,
      },
      auctions: {
        total: auctions.length,
        byStatus: countBy(auctions, (a) => a.status),
      },
      events: {
        total: events.length,
        byType: countBy(events, (e) => e.type),
      },
      bankOffers: {
        total: offers.length,
      },
    });
  }
);

const PORT = 3001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);

  // Actively close auctions once their 3-day window elapses, even if no one
  // reads or touches them. Mirrors the lazy settle on the request paths.
  startAuctionExpiryService({
    listAuctions: () => auctionService.findAll(),
    settle: (auction) => settleAndPersist(auction),
  });
});