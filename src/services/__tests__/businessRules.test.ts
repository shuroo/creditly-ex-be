import { describe, it, expect, vi, beforeEach } from "vitest";
import { applyEventRules } from "../businessRules.js";
import type { EventRuleDeps } from "../businessRules.js";
import type { Account, Event } from "../../models/types.js";

const NOW = Date.now();
const DAY_MS = 24 * 60 * 60 * 1000;

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
  id: "e1",
  accountId: "acc1",
  type: "note_added",
  createdByUserId: "u1",
  createdAt: new Date(NOW).toISOString(),
  ...o,
});

const makeRecentEvents = (count: number): Event[] =>
  Array.from({ length: count }, (_, i) =>
    makeEvent({ id: `e${i}`, createdAt: new Date(NOW - i * 1000).toISOString() })
  );

let account: Account;
let deps: EventRuleDeps;

beforeEach(() => {
  account = makeAccount();
  deps = {
    listEvents: vi.fn().mockResolvedValue([]),
    findAccount: vi.fn().mockResolvedValue(account),
    persistAccount: vi.fn().mockResolvedValue(undefined),
  };
});

describe("applyEventRules", () => {
  it("is a no-op when the account does not exist", async () => {
    (deps.findAccount as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await applyEventRules(makeEvent(), deps, NOW);
    expect(deps.persistAccount).not.toHaveBeenCalled();
  });

  it("does not mark highActivity for 3 or fewer recent events", async () => {
    (deps.listEvents as ReturnType<typeof vi.fn>).mockResolvedValue(makeRecentEvents(3));
    await applyEventRules(makeEvent(), deps, NOW);
    expect(account.highActivity).toBe(false);
    expect(deps.persistAccount).not.toHaveBeenCalled();
  });

  it("marks highActivity when there are more than 3 recent events", async () => {
    (deps.listEvents as ReturnType<typeof vi.fn>).mockResolvedValue(makeRecentEvents(4));
    await applyEventRules(makeEvent(), deps, NOW);
    expect(account.highActivity).toBe(true);
    expect(deps.persistAccount).toHaveBeenCalledWith(account);
  });

  it("does not re-mark highActivity when already true", async () => {
    account.highActivity = true;
    (deps.listEvents as ReturnType<typeof vi.fn>).mockResolvedValue(makeRecentEvents(5));
    await applyEventRules(makeEvent(), deps, NOW);
    expect(deps.persistAccount).not.toHaveBeenCalled();
  });

  it("ignores events outside the 24-hour window when counting activity", async () => {
    const old = makeEvent({ id: "old", createdAt: new Date(NOW - DAY_MS - 1000).toISOString() });
    const recent = makeRecentEvents(3);
    (deps.listEvents as ReturnType<typeof vi.fn>).mockResolvedValue([...recent, old]);
    await applyEventRules(makeEvent(), deps, NOW);
    expect(account.highActivity).toBe(false);
  });

  it("updates lastActivity on document_uploaded and persists", async () => {
    const event = makeEvent({ type: "document_uploaded" });
    await applyEventRules(event, deps, NOW);
    expect(account.lastActivity).toBe(event.createdAt);
    expect(deps.persistAccount).toHaveBeenCalledWith(account);
  });

  it("does not persist when nothing changed", async () => {
    (deps.listEvents as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    await applyEventRules(makeEvent({ type: "note_added" }), deps, NOW);
    expect(deps.persistAccount).not.toHaveBeenCalled();
  });
});
