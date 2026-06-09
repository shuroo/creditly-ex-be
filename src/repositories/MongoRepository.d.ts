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
export declare class MongoRepository<T extends {
    id?: string;
}> {
    private collection;
    /**
     * @param collection - The MongoDB collection this repository operates on.
     */
    constructor(collection: Collection<T>);
    /**
     * Return all documents in the collection.
     *
     * @returns A promise that resolves with an array of all stored entities.
     */
    findAll(): Promise<T[]>;
    /**
     * Find a single document by its application-level UUID.
     *
     * @param id - The UUID to look up (matches the `id` field, not `_id`).
     * @returns A promise that resolves with the entity, or `null` if not found.
     */
    findById(id: string): Promise<T | null>;
    /**
     * Insert a new document. The `id` field must already be set by the caller
     * (the service layer generates a UUID before calling this method).
     *
     * @param item - The entity to insert (must include a UUID `id`).
     * @returns A promise that resolves with the inserted entity unchanged.
     */
    create(item: T): Promise<T>;
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
    update(id: string, item: Partial<T>): Promise<T | null>;
    /**
     * Delete the document matching `id`.
     *
     * @param id - UUID of the document to delete.
     * @returns A promise that resolves with `true` if a document was deleted,
     *          `false` if no matching document was found.
     */
    delete(id: string): Promise<boolean>;
}
//# sourceMappingURL=MongoRepository.d.ts.map