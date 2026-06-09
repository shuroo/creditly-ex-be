import { describe, it, expect } from "vitest";
import {
  canManageAccount,
  scopeAccountsForUser,
  scopeEventsForUser,
  stripAccountPII,
  toPublicUser,
} from "../rbac.js";
import type { Account, AuctionOpportunity, Event } from "../../models/types.js";
import type { AuthUser } from "../../middleware/authContext.js";

const makeAccount = (o: Partial<Account> = {}): Account => ({
  id: "acc1",
  customerName: "Acme",
  phone: "123",
  email: "acme@test.com",
  status: "ELIGIBLE",
  managerId: "mgr1",
  highActivity: false,
  ...o,
});

const makeEvent = (o: Partial<Event> = {}): Event => ({
  id: "ev1",
  accountId: "acc1",
  type: "note_added",
  createdByUserId: "u1",
  createdAt: new Date().toISOString(),
  ...o,
});

const user = (role: AuthUser["role"], id = "u1"): AuthUser => ({
  id,
  role,
});

describe("canManageAccount", () => {
  it("ADMIN can manage any account", () => {
    expect(canManageAccount(makeAccount({ managerId: "other" }), user("ADMIN"))).toBe(true);
  });

  it("MANAGER can manage their own account", () => {
    expect(canManageAccount(makeAccount({ managerId: "mgr1" }), user("MANAGER", "mgr1"))).toBe(true);
  });

  it("MANAGER cannot manage another manager's account", () => {
    expect(canManageAccount(makeAccount({ managerId: "mgr2" }), user("MANAGER", "mgr1"))).toBe(false);
  });

  it("USER cannot manage accounts", () => {
    expect(canManageAccount(makeAccount(), user("USER"))).toBe(false);
  });
});

describe("scopeAccountsForUser", () => {
  const accounts = [
    makeAccount({ id: "a1", managerId: "mgr1" }),
    makeAccount({ id: "a2", managerId: "mgr2" }),
  ];

  it("ADMIN sees all accounts", () => {
    expect(scopeAccountsForUser(accounts, user("ADMIN"), [])).toEqual(accounts);
  });

  it("MANAGER sees only their accounts", () => {
    const result = scopeAccountsForUser(accounts, user("MANAGER", "mgr1"), []);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("a1");
  });

  it("USER sees accounts related to their events", () => {
    const events = [makeEvent({ accountId: "a2", createdByUserId: "usr1" })];
    const result = scopeAccountsForUser(accounts, user("USER", "usr1"), events);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("a2");
  });

  it("USER sees no accounts when they have no events", () => {
    expect(scopeAccountsForUser(accounts, user("USER"), [])).toHaveLength(0);
  });

  it("BANKER sees no accounts when auctions list is empty", () => {
    expect(scopeAccountsForUser(accounts, user("BANKER"), [], [])).toHaveLength(0);
  });

  it("BANKER sees accounts that have an open auction they are eligible for", () => {
    const auction: AuctionOpportunity = {
      id: "auc1",
      accountId: "a1",
      model: "SEALED",
      status: "OPEN",
      eligibleBankIds: ["bank1"],
      openedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    };
    const banker: AuthUser = { id: "b1", role: "BANKER", bankId: "bank1" };
    const result = scopeAccountsForUser(accounts, banker, [], [auction]);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("a1");
  });

  it("BANKER does not see accounts for closed auctions", () => {
    const auction: AuctionOpportunity = {
      id: "auc2",
      accountId: "a1",
      model: "SEALED",
      status: "CLOSED",
      eligibleBankIds: ["bank1"],
      openedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() - 86_400_000).toISOString(),
    };
    const banker: AuthUser = { id: "b1", role: "BANKER", bankId: "bank1" };
    expect(scopeAccountsForUser(accounts, banker, [], [auction])).toHaveLength(0);
  });
});

describe("scopeEventsForUser", () => {
  const events = [
    makeEvent({ id: "e1", accountId: "a1", createdByUserId: "usr1" }),
    makeEvent({ id: "e2", accountId: "a2", createdByUserId: "usr2" }),
  ];
  const accounts = [
    makeAccount({ id: "a1", managerId: "mgr1" }),
    makeAccount({ id: "a2", managerId: "mgr2" }),
  ];

  it("ADMIN sees all events", () => {
    expect(scopeEventsForUser(events, user("ADMIN"), accounts)).toEqual(events);
  });

  it("MANAGER sees events on their accounts only", () => {
    const result = scopeEventsForUser(events, user("MANAGER", "mgr1"), accounts);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("e1");
  });

  it("USER sees only their own events", () => {
    const result = scopeEventsForUser(events, user("USER", "usr2"), accounts);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("e2");
  });

  it("BANKER sees no events", () => {
    expect(scopeEventsForUser(events, user("BANKER"), accounts)).toHaveLength(0);
  });
});

describe("stripAccountPII", () => {
  it("removes PII and internal fields, keeps financial and identity fields", () => {
    const account = makeAccount({
      salary: 25000,
      loanAmount: 800000,
      propertyValue: 1200000,
    });
    const stripped = stripAccountPII(account);
    // PII — must be absent
    expect("customerName" in stripped).toBe(false);
    expect("phone" in stripped).toBe(false);
    expect("email" in stripped).toBe(false);
    // Internal operational — must be absent
    expect("status" in stripped).toBe(false);
    expect("managerId" in stripped).toBe(false);
    // Financial — must remain
    expect(stripped.salary).toBe(25000);
    expect(stripped.loanAmount).toBe(800000);
    expect(stripped.propertyValue).toBe(1200000);
    expect(stripped.id).toBe(account.id);
  });
});

// ---------------------------------------------------------------------------
// BANKER account visibility — mirrors exactly what GET /accounts does:
//   1. scopeAccountsForUser  — which accounts the BANKER may see
//   2. .map(stripAccountPII) — remove PII before sending the response
// ---------------------------------------------------------------------------

/** Simulate the full route pipeline a BANKER request goes through. */
function bankerView(
  accounts: Account[],
  banker: AuthUser,
  auctions: AuctionOpportunity[]
) {
  const scoped = scopeAccountsForUser(accounts, banker, [], auctions);
  return scoped.map(stripAccountPII);
}

describe("BANKER account visibility — PII is never exposed", () => {
  const openAuction: AuctionOpportunity = {
    id: "auc1",
    accountId: "acc1",
    model: "SEALED",
    status: "OPEN",
    eligibleBankIds: ["bank1"],
    openedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  };

  const richAccount = makeAccount({
    id: "acc1",
    customerName: "John Smith",
    phone: "050-1234567",
    email: "john@example.com",
    salary: 25000,
    loanAmount: 800000,
    propertyValue: 1200000,
  });

  const banker: AuthUser = { id: "b1", role: "BANKER", bankId: "bank1" };

  it("customerName is absent from the BANKER response", () => {
    const [result] = bankerView([richAccount], banker, [openAuction]);
    expect("customerName" in result!).toBe(false);
  });

  it("phone is absent from the BANKER response", () => {
    const [result] = bankerView([richAccount], banker, [openAuction]);
    expect("phone" in result!).toBe(false);
  });

  it("email is absent from the BANKER response", () => {
    const [result] = bankerView([richAccount], banker, [openAuction]);
    expect("email" in result!).toBe(false);
  });

  it("financial fields (salary, loanAmount, propertyValue) remain visible", () => {
    const [result] = bankerView([richAccount], banker, [openAuction]);
    expect(result!.salary).toBe(25000);
    expect(result!.loanAmount).toBe(800000);
    expect(result!.propertyValue).toBe(1200000);
  });

  it("safe fields (id, highActivity, financial) remain visible", () => {
    const [result] = bankerView([richAccount], banker, [openAuction]);
    expect(result!.id).toBe("acc1");
    expect(result!.highActivity).toBe(false);
    expect(result!.salary).toBe(25000);
  });

  it("status is absent from the BANKER response", () => {
    const [result] = bankerView([richAccount], banker, [openAuction]);
    expect("status" in result!).toBe(false);
  });

  it("managerId is absent from the BANKER response", () => {
    const [result] = bankerView([richAccount], banker, [openAuction]);
    expect("managerId" in result!).toBe(false);
  });

  it("BANKER sees no accounts when their bank is not in eligibleBankIds", () => {
    const otherBanker: AuthUser = { id: "b2", role: "BANKER", bankId: "bank99" };
    expect(bankerView([richAccount], otherBanker, [openAuction])).toHaveLength(0);
  });

  it("BANKER sees no accounts when the auction is CLOSED", () => {
    const closedAuction: AuctionOpportunity = { ...openAuction, status: "CLOSED" };
    expect(bankerView([richAccount], banker, [closedAuction])).toHaveLength(0);
  });

  it("BANKER sees no accounts when the auction is EXPIRED", () => {
    const expiredAuction: AuctionOpportunity = { ...openAuction, status: "EXPIRED" };
    expect(bankerView([richAccount], banker, [expiredAuction])).toHaveLength(0);
  });

  it("MANAGER still receives full PII — stripping applies only to BANKERs", () => {
    const manager: AuthUser = { id: "mgr1", role: "MANAGER" };
    const managerAccount = makeAccount({
      id: "acc1",
      managerId: "mgr1",
      customerName: "John Smith",
      phone: "050-1234567",
      email: "john@example.com",
    });
    const [result] = scopeAccountsForUser([managerAccount], manager, []);
    expect(result!.customerName).toBe("John Smith");
    expect(result!.phone).toBe("050-1234567");
    expect(result!.email).toBe("john@example.com");
  });
});

describe("toPublicUser", () => {
  it("strips the passwordHash field", () => {
    const full = {
      id: "u1",
      name: "Alice",
      email: "a@a.com",
      role: "ADMIN" as const,
      passwordHash: "secret",
    };
    const pub = toPublicUser(full);
    expect("passwordHash" in pub).toBe(false);
    expect(pub.id).toBe("u1");
  });
});
