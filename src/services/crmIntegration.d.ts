/** Application-level CRM service that maps domain events to CRM sync calls. */
export declare class CrmService {
    /**
     * Notify the CRM that a document was uploaded for an account.
     *
     * @param event - The event payload to forward.
     * @returns The CRM sync response.
     */
    syncDocumentUploaded(event: unknown): Promise<import("../integration/crm-integration.js").CrmSyncResponse>;
    /**
     * Notify the CRM that an account's status changed.
     *
     * @param account - The updated account record.
     * @returns The CRM sync response.
     */
    syncStatusChanged(account: unknown): Promise<import("../integration/crm-integration.js").CrmSyncResponse>;
    /**
     * Notify the CRM that a new auction was opened.
     *
     * @param auction - The newly opened auction.
     * @returns The CRM sync response.
     */
    syncAuctionOpened(auction: unknown): Promise<import("../integration/crm-integration.js").CrmSyncResponse>;
    /**
     * Notify the CRM that a winning offer was selected for an auction.
     *
     * @param payload - Auction id, winning offer id, and the winning interest rate.
     * @returns The CRM sync response.
     */
    syncWinningOfferSelected(payload: {
        auctionId: string;
        winningOfferId: string;
        interestRate: number;
    }): Promise<import("../integration/crm-integration.js").CrmSyncResponse>;
}
/** Singleton instance used throughout the application. */
export declare const crmService: CrmService;
//# sourceMappingURL=crmIntegration.d.ts.map