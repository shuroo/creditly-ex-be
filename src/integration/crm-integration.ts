/**
 * Mock CRM integration adapter.
 *
 * Simulates a real external CRM API by logging requests and randomly returning
 * a failure response 20 % of the time (to demonstrate error-handling without
 * a real external dependency). In production this class would be replaced with
 * an HTTP client pointing at the actual CRM endpoint.
 *
 * Accepted trigger types mirror the domain events that can cause a CRM sync:
 * `status_changed`, `document_uploaded`, `auction_opened`,
 * `winning_offer_selected`.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */

/** The set of domain events that can trigger a CRM sync. */
export type CrmTrigger =
  | "status_changed"
  | "document_uploaded"
  | "auction_opened"
  | "winning_offer_selected";

/** The request payload sent to the CRM for every sync operation. */
export interface CrmSyncRequest {
  /** Which domain event triggered the sync. */
  trigger: CrmTrigger;
  /** UUID of the primary entity being synced. */
  entityId: string;
  /** Arbitrary body forwarded to the CRM (entity snapshot or event data). */
  payload: unknown;
}

/** The CRM's response to a sync request. */
export interface CrmSyncResponse {
  /** True when the sync was accepted by the CRM. */
  success: boolean;
  /** ISO-8601 timestamp of the sync, present only on success. */
  syncedAt?: string;
  /** Human-readable reason for failure, present only on failure. */
  failureReason?: string;
}

/** Mock implementation of the CRM integration client. */
export class CrmIntegration {
  /**
   * Send a sync request to the CRM.
   *
   * Logs the trigger and entity id, then simulates an 80 % success rate.
   * 20 % of calls return a synthetic failure to exercise error paths.
   *
   * @param request - The sync request to forward.
   * @returns A promise that resolves with the CRM response.
   */
  async sync(
    request: CrmSyncRequest
  ): Promise<CrmSyncResponse> {

    console.log(
      `[CRM] Trigger=${request.trigger} Entity=${request.entityId}`
    );

    const shouldFail = Math.random() < 0.2;

    if (shouldFail) {
      return {
        success: false,
        failureReason: "Mock CRM unavailable"
      };
    }

    return {
      success: true,
      syncedAt: new Date().toISOString()
    };
  }
}

/** Singleton CRM integration client used throughout the application. */
export const crmIntegration = new CrmIntegration();
