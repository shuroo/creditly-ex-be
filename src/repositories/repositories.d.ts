/**
 * Repository singletons.
 *
 * Each named export is a {@link MongoRepository} wired to its corresponding
 * MongoDB collection. The connection is established once via a top-level
 * `await` so all repositories share the same `MongoClient` instance.
 *
 * Import the specific repository you need rather than this whole module to
 * keep dependency graphs readable.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import { MongoRepository } from "./MongoRepository.js";
import type { User, Account, Event, AuctionOpportunity, BankOffer } from "../models/types.js";
/** Repository for {@link User} documents (collection: `"users"`). */
declare const userRepository: MongoRepository<User>;
/** Repository for {@link Account} documents (collection: `"accounts"`). */
declare const accountRepository: MongoRepository<Account>;
/** Repository for {@link Event} documents (collection: `"events"`). */
declare const eventRepository: MongoRepository<Event>;
/** Repository for {@link AuctionOpportunity} documents (collection: `"auctions"`). */
declare const auctionRepository: MongoRepository<AuctionOpportunity>;
/** Repository for {@link BankOffer} documents (collection: `"bankOffers"`). */
declare const bankOfferRepository: MongoRepository<BankOffer>;
export { userRepository, accountRepository, eventRepository, auctionRepository, bankOfferRepository };
//# sourceMappingURL=repositories.d.ts.map