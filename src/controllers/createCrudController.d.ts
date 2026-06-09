/**
 * Generic CRUD controller factory.
 *
 * Produces a set of Express request-handler functions wired to a
 * {@link CrudService}. The factory pattern avoids duplicating route handler
 * boilerplate across all entity types (users, accounts, events, auctions,
 * bank offers).
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import type { Request, Response } from "express";
import { CrudService } from "../services/crudService.js";
/**
 * Create a standard set of CRUD Express handlers backed by the given service.
 *
 * Returned handlers:
 * - `getAll`  – `GET /`           → 200 with entity array.
 * - `getById` – `GET /:id`        → 200 with entity, or 404.
 * - `create`  – `POST /`          → 201 with created entity.
 * - `update`  – `PUT /:id`        → 200 with updated entity, or 404.
 * - `delete`  – `DELETE /:id`     → 204 No Content, or 404.
 *
 * @template T - Entity type; must carry a string `id` field.
 * @param service - The service instance that handles persistence.
 * @returns An object mapping handler names to Express request handlers.
 */
export declare function createCrudController<T extends {
    id: string;
}>(service: CrudService<T>): {
    /** Handle `GET /` — return all entities. */
    getAll: (_req: Request, res: Response) => Promise<void>;
    /**
     * Handle `GET /:id` — return a single entity by UUID.
     * Responds with 404 when the entity does not exist.
     */
    getById: (req: Request, res: Response) => Promise<void>;
    /**
     * Handle `POST /` — create a new entity from the request body.
     * Responds with 201 and the created entity (including its generated UUID).
     */
    create: (req: Request, res: Response) => Promise<void>;
    /**
     * Handle `PUT /:id` — partially update an existing entity.
     * Responds with 404 when the entity does not exist.
     */
    update: (req: Request, res: Response) => Promise<void>;
    /**
     * Handle `DELETE /:id` — remove an entity by UUID.
     * Responds with 204 on success, or 404 if the entity does not exist.
     */
    delete: (req: Request, res: Response) => Promise<void>;
};
//# sourceMappingURL=createCrudController.d.ts.map