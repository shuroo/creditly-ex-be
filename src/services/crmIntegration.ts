/**
 * High-level CRM integration service.
 *
 * Wraps the low-level {@link CrmIntegration} adapter and exposes one method
 * per trigger type so callers don't need to know about the underlying
 * `CrmSyncRequest` structure.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import { crmIntegration } from "../integration/crm-integration.js";

/** Application-level CRM service that maps domain events to CRM sync calls. */
export class CrmService {

  /**
   * Notify the CRM that a document was uploaded for an account.
   *
   * @param event - The event payload to forward.
   * @returns The CRM sync response.
   */
  async syncDocumentUploaded(event: unknown) {
    return crmIntegration.sync({ trigger: "document_uploaded", entityId: "", payload: event });
  }

  /**
   * Notify the CRM that an account's status changed.
   *
   * @param account - The updated account record.
   * @returns The CRM sync response.
   */
  async syncStatusChanged(account: unknown) {
    return crmIntegration.sync({ trigger: "status_changed", entityId: "", payload: account });
  }

  /**
   * Notify the CRM that a new auction was opened.
   *
   * @param auction - The newly opened auction.
   * @returns The CRM sync response.
   */
  async syncAuctionOpened(auction: unknown) {
    return crmIntegration.sync({ trigger: "auction_opened", entityId: "", payload: auction });
  }

  /**
   * Notify the CRM that a winning offer was selected for an auction.
   *
   * @param payload - Auction id, winning offer id, and the winning interest rate.
   * @returns The CRM sync response.
   */
  async syncWinningOfferSelected(payload: {
    auctionId: string;
    winningOfferId: string;
    interestRate: number;
  }) {
    return crmIntegration.sync({
      trigger: "winning_offer_selected",
      entityId: payload.auctionId,
      payload,
    });
  }
}

/** Singleton instance used throughout the application. */
export const crmService = new CrmService();
