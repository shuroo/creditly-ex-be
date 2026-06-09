import { MongoRepository } from "../repositories/MongoRepository.js";
/** Generic CRUD service that delegates persistence to a {@link MongoRepository}. */
export declare class CrudService<T extends {
    id: string;
}> {
    private repository;
    /**
     * @param repository - The MongoDB-backed repository for entity `T`.
     */
    constructor(repository: MongoRepository<T>);
    /**
     * Return all entities of type `T`.
     *
     * @returns A promise that resolves with the full list.
     */
    findAll(): Promise<T[]>;
    /**
     * Find a single entity by its UUID.
     *
     * @param id - The UUID to look up.
     * @returns A promise that resolves with the entity.
     * @throws {Error} `"Entity not found"` when no document matches `id`.
     */
    findById(id: string): Promise<T>;
    /**
     * Create a new entity. A UUID v4 `id` is generated here; the caller must
     * not provide one (it is excluded from the input type via `Omit<T, "id">`).
     *
     * @param data - The entity fields, excluding `id`.
     * @returns A promise that resolves with the created entity including its new `id`.
     */
    create(data: Omit<T, "id">): Promise<T>;
    /**
     * Partially update an existing entity. Fields not present in `data` are
     * preserved from the current stored document. The `id` is always kept from
     * the path parameter and cannot be overwritten.
     *
     * @param id   - UUID of the entity to update.
     * @param data - Partial set of fields to merge.
     * @returns A promise that resolves with the fully merged, updated entity.
     * @throws {Error} `"Entity not found"` when no document matches `id`.
     */
    update(id: string, data: Partial<T>): Promise<T>;
    /**
     * Delete an entity by its UUID.
     *
     * @param id - UUID of the entity to delete.
     * @returns A promise that resolves when deletion is complete.
     * @throws {Error} `"Entity not found"` when no document matches `id`.
     */
    delete(id: string): Promise<void>;
}
//# sourceMappingURL=crudService.d.ts.map