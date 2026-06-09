/**
 * In-memory repository — kept for reference and local development without MongoDB.
 *
 * This implementation was the original persistence layer before the migration to
 * {@link MongoRepository}. It is commented out to prevent accidental use in
 * production but preserved here as documentation of the repository interface.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */

/*
export class InMemoryRepository<T extends { id: string }> {
  private items = new Map<string, T>();

  findAll(): T[] {
    return Array.from(this.items.values());
  }

  findById(id: string): T | undefined {
    return this.items.get(id);
  }

  create(item: T): T {
    this.items.set(item.id, item);
    return item;
  }

  update(id: string, item: T): T | undefined {
    if (!this.items.has(id)) {
      return undefined;
    }

    this.items.set(id, item);
    return item;
  }

  delete(id: string): boolean {
    return this.items.delete(id);
  }
}

*/
