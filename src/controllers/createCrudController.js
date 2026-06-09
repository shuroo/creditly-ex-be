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
export function createCrudController(service) {
    return {
        /** Handle `GET /` — return all entities. */
        getAll: async (_req, res) => {
            res.json(await service.findAll());
        },
        /**
         * Handle `GET /:id` — return a single entity by UUID.
         * Responds with 404 when the entity does not exist.
         */
        getById: async (req, res) => {
            const id = req.params.id;
            try {
                res.json(await service.findById(id));
            }
            catch (error) {
                res.status(404).json({ message: "Not found" });
            }
        },
        /**
         * Handle `POST /` — create a new entity from the request body.
         * Responds with 201 and the created entity (including its generated UUID).
         */
        create: async (req, res) => {
            const created = await service.create(req.body);
            res.status(201).json(created);
        },
        /**
         * Handle `PUT /:id` — partially update an existing entity.
         * Responds with 404 when the entity does not exist.
         */
        update: async (req, res) => {
            const id = req.params.id;
            try {
                const updated = await service.update(id, req.body);
                res.json(updated);
            }
            catch (error) {
                res.status(404).json({ message: "Not found" });
            }
        },
        /**
         * Handle `DELETE /:id` — remove an entity by UUID.
         * Responds with 204 on success, or 404 if the entity does not exist.
         */
        delete: async (req, res) => {
            const id = req.params.id;
            try {
                await service.delete(id);
                res.status(204).send();
            }
            catch (error) {
                res.status(404).json({ message: "Not found" });
            }
        }
    };
}
//# sourceMappingURL=createCrudController.js.map