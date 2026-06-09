/**
 * JWT authentication middleware and token utilities.
 *
 * - `signToken`    – creates a signed JWT from a user record.
 * - `authenticate` – Express middleware that verifies the Bearer token and
 *                    populates `req.user`.
 * - `requireRole`  – Express middleware factory that enforces RBAC roles.
 *
 * The secret defaults to `"dev-secret-change-me"` and must be overridden via
 * `JWT_SECRET` in the environment for any non-local deployment.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import type { Request, Response, NextFunction } from "express";
import type { Role, User } from "../models/types.js";
/**
 * The minimal identity payload embedded in every JWT.
 * Contains only what the RBAC layer needs; no PII.
 */
export type AuthUser = {
    /** User's UUID. */
    id: string;
    /** RBAC role. */
    role: Role;
    /** Bank affiliation — present only for BANKER users. */
    bankId?: string;
};
declare global {
    namespace Express {
        interface Request {
            /** Populated by {@link authenticate} after successful token verification. */
            user?: AuthUser;
        }
    }
}
/**
 * Sign a JWT carrying the identity bits the RBAC layer needs.
 *
 * Only `id`, `role`, and (for BANKERs) `bankId` are embedded — no PII.
 * The token is valid for `TOKEN_TTL` (12 hours).
 *
 * @param user - The authenticated user whose identity is being signed.
 * @returns A signed JWT string.
 */
export declare function signToken(user: User): string;
/**
 * Express middleware — verify the Bearer token and attach `req.user`.
 *
 * Returns `401` when the `Authorization` header is missing, malformed, or
 * contains an invalid / expired token.
 */
export declare function authenticate(req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
/**
 * Express middleware factory — enforce that the authenticated user holds one
 * of the specified roles. Must be used after {@link authenticate}.
 *
 * Returns `403` when `req.user` is absent or the user's role is not in the
 * allowed list.
 *
 * @param roles - One or more roles that are permitted for the route.
 * @returns An Express middleware function.
 */
export declare function requireRole(...roles: Role[]): (req: Request, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
//# sourceMappingURL=authContext.d.ts.map