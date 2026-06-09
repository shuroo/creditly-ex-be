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
    async sync(request) {
        console.log(`[CRM] Trigger=${request.trigger} Entity=${request.entityId}`);
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
//# sourceMappingURL=crm-integration.js.map