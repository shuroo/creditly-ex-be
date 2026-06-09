/**
 * Generic MongoDB repository.
 *
 * All CRUD operations query by the application-level `id` field (UUID v4),
 * never by MongoDB's own `_id` (ObjectId). This keeps all inter-entity
 * relations, JWT payloads, and URL params consistent with one id space.
 *
 * @template T - Entity type; must carry an optional string `id` field (the
 *               service layer always provides one before calling `create`).
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import { Collection } from "mongodb";
/** MongoDB-backed repository providing generic CRUD operations. */
export class MongoRepository {
    collection;
    /**
     * @param collection - The MongoDB collection this repository operates on.
     */
    constructor(collection) {
        this.collection = collection;
    }
    /**
     * Return all documents in the collection.
     *
     * @returns A promise that resolves with an array of all stored entities.
     */
    async findAll() {
        return this.collection.find({}).toArray();
    }
    /**
     * Find a single document by its application-level UUID.
     *
     * @param id - The UUID to look up (matches the `id` field, not `_id`).
     * @returns A promise that resolves with the entity, or `null` if not found.
     */
    async findById(id) {
        return this.collection.findOne({ id });
    }
    /**
     * Insert a new document. The `id` field must already be set by the caller
     * (the service layer generates a UUID before calling this method).
     *
     * @param item - The entity to insert (must include a UUID `id`).
     * @returns A promise that resolves with the inserted entity unchanged.
     */
    async create(item) {
        await this.collection.insertOne(item);
        return item;
    }
    /**
     * Apply a partial update to the document matching `id`.
     *
     * Uses MongoDB's `$set` operator so only the provided fields are overwritten;
     * all other fields are preserved.
     *
     * @param id   - UUID of the document to update.
     * @param item - Partial set of fields to merge via `$set`.
     * @returns A promise that resolves with the updated entity, or `null` if not found.
     */
    async update(id, item) {
        await this.collection.findOneAndUpdate({ id }, { $set: item });
        return this.findById(id);
    }
    /**
     * Delete the document matching `id`.
     *
     * @param id - UUID of the document to delete.
     * @returns A promise that resolves with `true` if a document was deleted,
     *          `false` if no matching document was found.
     */
    async delete(id) {
        const result = await this.collection.deleteOne({ id });
        return result.deletedCount > 0;
    }
}
//# sourceMappingURL=MongoRepository.js.map