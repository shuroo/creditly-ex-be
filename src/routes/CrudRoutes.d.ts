/**
 * Generic CRUD router factory.
 *
 * Mounts the standard five routes (`GET /`, `GET /:id`, `POST /`, `PUT /:id`,
 * `DELETE /:id`) on a new Express `Router` and wires them to the handlers
 * produced by {@link createCrudController}.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import { Router } from "express";
import { CrudService } from "../services/crudService.js";
/**
 * Create an Express router with full CRUD routes for entity type `T`.
 *
 * Usage:
 * ```ts
 * app.use("/accounts", createCrudRoutes(accountService));
 * ```
 *
 * @template T - Entity type; must carry a string `id` field.
 * @param service - The service instance that handles persistence.
 * @returns A configured Express `Router`.
 */
export declare function createCrudRoutes<T extends {
    id: string;
}>(service: CrudService<T>): Router;
//# sourceMappingURL=CrudRoutes.d.ts.map