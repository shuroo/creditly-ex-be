/**
 * Generic CRUD service backed by a {@link MongoRepository}.
 *
 * Wraps the repository to add UUID generation on creation and a consistent
 * "not found" error so callers don't have to handle `null` returns.
 *
 * @template T - Entity type; must carry a string `id` field.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import { v4 as uuid } from "uuid";
import { MongoRepository } from "../repositories/MongoRepository.js";

/** Generic CRUD service that delegates persistence to a {@link MongoRepository}. */
export class CrudService<T extends { id: string }> {
  /**
   * @param repository - The MongoDB-backed repository for entity `T`.
   */
  constructor(private repository: MongoRepository<T>) {}

  /**
   * Return all entities of type `T`.
   *
   * @returns A promise that resolves with the full list.
   */
  findAll(): Promise<T[]> {
    return this.repository.findAll();
  }

  /**
   * Find a single entity by its UUID.
   *
   * @param id - The UUID to look up.
   * @returns A promise that resolves with the entity.
   * @throws {Error} `"Entity not found"` when no document matches `id`.
   */
  async findById(id: string): Promise<T> {
    const item = await this.repository.findById(id);

    if (!item) {
      throw new Error("Entity not found");
    }

    return item;
  }

  /**
   * Create a new entity. A UUID v4 `id` is generated here; the caller must
   * not provide one (it is excluded from the input type via `Omit<T, "id">`).
   *
   * @param data - The entity fields, excluding `id`.
   * @returns A promise that resolves with the created entity including its new `id`.
   */
  create(data: Omit<T, "id">): Promise<T> {
    const item = {
      id: uuid(),
      ...data
    } as T;

    return this.repository.create(item);
  }

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
  async update(id: string, data: Partial<T>): Promise<T> {
    const existing = await this.findById(id);

    const updated = {
      ...existing,
      ...data,
      id
    };

    const updatedItem = await this.repository.update(id, updated);
    return updatedItem!;
  }

  /**
   * Delete an entity by its UUID.
   *
   * @param id - UUID of the entity to delete.
   * @returns A promise that resolves when deletion is complete.
   * @throws {Error} `"Entity not found"` when no document matches `id`.
   */
  async delete(id: string): Promise<void> {
    const deleted = await this.repository.delete(id);

    if (!deleted) {
      throw new Error("Entity not found");
    }
  }
}
