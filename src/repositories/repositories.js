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
import { connectDb } from "./db.js";
const db = await connectDb();
/** Repository for {@link User} documents (collection: `"users"`). */
const userRepository = new MongoRepository(db.collection("users"));
/** Repository for {@link Account} documents (collection: `"accounts"`). */
const accountRepository = new MongoRepository(db.collection("accounts"));
/** Repository for {@link Event} documents (collection: `"events"`). */
const eventRepository = new MongoRepository(db.collection("events"));
/** Repository for {@link AuctionOpportunity} documents (collection: `"auctions"`). */
const auctionRepository = new MongoRepository(db.collection("auctions"));
/** Repository for {@link BankOffer} documents (collection: `"bankOffers"`). */
const bankOfferRepository = new MongoRepository(db.collection("bankOffers"));
export { userRepository, accountRepository, eventRepository, auctionRepository, bankOfferRepository };
//# sourceMappingURL=repositories.js.map