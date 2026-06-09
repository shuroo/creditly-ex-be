/**
 * Tests for the CRM notification service.
 *
 * Focus: every outbound sync attempt is logged immediately as "pending", then
 * updated to "success" or "failed" once the async CRM call settles. The tests
 * mock the CRM integration adapter so the 20 % random failure is controlled.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above imports — the mock is in place before crmService loads.
vi.mock("../../integration/crm-integration.js", () => ({
  crmIntegration: { sync: vi.fn() },
}));

import {
  syncAccount,
  notifyAccountWon,
  getCrmLog,
  clearLog,
} from "../crmService.js";
import { crmIntegration } from "../../integration/crm-integration.js";
import type { Account, BankOffer } from "../../models/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeAccount = (o: Partial<Account> = {}): Account => ({
  id: "acc1",
  customerName: "John Smith",
  phone: "050-1234567",
  email: "john@example.com",
  status: "ELIGIBLE",
  managerId: "mgr1",
  highActivity: false,
  ...o,
});

const makeOffer = (o: Partial<BankOffer> = {}): BankOffer => ({
  id: "offer1",
  auctionId: "auc1",
  bankId: "bank1",
  interestRate: 3.5,
  createdAt: new Date().toISOString(),
  ...o,
});

/** Flush all pending microtasks so async .then()/.catch() handlers run. */
const flush = () => new Promise<void>((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  clearLog();
});

// ---------------------------------------------------------------------------
// syncAccount — trigger: document_uploaded
// ---------------------------------------------------------------------------

describe("syncAccount — on success", () => {
  it("adds a log entry with syncStatus='pending' before the CRM responds", () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      syncedAt: "2026-06-09T10:00:00Z",
    });

    syncAccount(makeAccount(), "document_uploaded");

    const [entry] = getCrmLog();
    expect(entry!.syncStatus).toBe("pending");
  });

  it("updates syncStatus to 'success' after the CRM responds OK", async () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      syncedAt: "2026-06-09T10:00:00Z",
    });

    syncAccount(makeAccount(), "document_uploaded");
    await flush();

    const [entry] = getCrmLog();
    expect(entry!.syncStatus).toBe("success");
  });

  it("stores the syncedAt timestamp returned by the CRM", async () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      syncedAt: "2026-06-09T10:00:00Z",
    });

    syncAccount(makeAccount(), "document_uploaded");
    await flush();

    const [entry] = getCrmLog();
    expect(entry!.syncedAt).toBe("2026-06-09T10:00:00Z");
  });

  it("records the correct trigger on the log entry", async () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      syncedAt: "",
    });

    syncAccount(makeAccount(), "status_changed");
    await flush();

    const [entry] = getCrmLog();
    expect(entry!.trigger).toBe("status_changed");
  });
});

describe("syncAccount — on failure (success: false)", () => {
  it("updates syncStatus to 'failed'", async () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      failureReason: "Mock CRM unavailable",
    });

    syncAccount(makeAccount(), "document_uploaded");
    await flush();

    const [entry] = getCrmLog();
    expect(entry!.syncStatus).toBe("failed");
  });

  it("stores the failureReason returned by the CRM", async () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      failureReason: "Mock CRM unavailable",
    });

    syncAccount(makeAccount(), "document_uploaded");
    await flush();

    const [entry] = getCrmLog();
    expect(entry!.failureReason).toBe("Mock CRM unavailable");
  });

  it("does not set syncedAt when the sync fails", async () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      failureReason: "Timeout",
    });

    syncAccount(makeAccount(), "document_uploaded");
    await flush();

    const [entry] = getCrmLog();
    expect(entry!.syncedAt).toBeUndefined();
  });
});

describe("syncAccount — on network error (thrown exception)", () => {
  it("updates syncStatus to 'failed'", async () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("ECONNREFUSED")
    );

    syncAccount(makeAccount(), "document_uploaded");
    await flush();

    const [entry] = getCrmLog();
    expect(entry!.syncStatus).toBe("failed");
  });

  it("stores the error message as failureReason", async () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("ECONNREFUSED")
    );

    syncAccount(makeAccount(), "document_uploaded");
    await flush();

    const [entry] = getCrmLog();
    expect(entry!.failureReason).toBe("ECONNREFUSED");
  });
});

// ---------------------------------------------------------------------------
// notifyAccountWon
// ---------------------------------------------------------------------------

describe("notifyAccountWon — on success", () => {
  it("logs kind='won' with syncStatus='pending' immediately", () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      syncedAt: "2026-06-09T10:00:00Z",
    });

    notifyAccountWon(makeAccount(), makeOffer());

    const [entry] = getCrmLog();
    expect(entry!.kind).toBe("won");
    expect(entry!.syncStatus).toBe("pending");
  });

  it("updates syncStatus to 'success' after the CRM responds OK", async () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      syncedAt: "2026-06-09T10:00:00Z",
    });

    notifyAccountWon(makeAccount(), makeOffer());
    await flush();

    const [entry] = getCrmLog();
    expect(entry!.syncStatus).toBe("success");
  });

  it("uses trigger 'winning_offer_selected'", async () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      syncedAt: "",
    });

    notifyAccountWon(makeAccount(), makeOffer());
    await flush();

    const [entry] = getCrmLog();
    expect(entry!.trigger).toBe("winning_offer_selected");
  });
});

describe("notifyAccountWon — on failure", () => {
  it("updates syncStatus to 'failed' and stores failureReason", async () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      failureReason: "Mock CRM unavailable",
    });

    notifyAccountWon(makeAccount(), makeOffer());
    await flush();

    const [entry] = getCrmLog();
    expect(entry!.syncStatus).toBe("failed");
    expect(entry!.failureReason).toBe("Mock CRM unavailable");
  });
});

// ---------------------------------------------------------------------------
// getCrmLog / clearLog
// ---------------------------------------------------------------------------

describe("getCrmLog", () => {
  it("returns a copy — mutations do not affect the internal log", async () => {
    (crmIntegration.sync as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      syncedAt: "",
    });

    syncAccount(makeAccount(), "document_uploaded");
    const snapshot = getCrmLog();
    snapshot.pop(); // mutate the copy

    expect(getCrmLog()).toHaveLength(1); // internal log unchanged
  });
});
