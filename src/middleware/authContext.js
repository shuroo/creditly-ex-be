import jwt from "jsonwebtoken";
/** Dev fallback — override with `JWT_SECRET` env var for production. */
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
/** Tokens expire after 12 hours. */
const TOKEN_TTL = "12h";
/**
 * Sign a JWT carrying the identity bits the RBAC layer needs.
 *
 * Only `id`, `role`, and (for BANKERs) `bankId` are embedded — no PII.
 * The token is valid for `TOKEN_TTL` (12 hours).
 *
 * @param user - The authenticated user whose identity is being signed.
 * @returns A signed JWT string.
 */
export function signToken(user) {
    const payload = {
        id: user.id,
        role: user.role,
        ...(user.bankId ? { bankId: user.bankId } : {}),
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}
/**
 * Express middleware — verify the Bearer token and attach `req.user`.
 *
 * Returns `401` when the `Authorization` header is missing, malformed, or
 * contains an invalid / expired token.
 */
export function authenticate(req, res, next) {
    const header = req.header("authorization") || "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ message: "Missing or malformed token" });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: decoded.id,
            role: decoded.role,
            ...(decoded.bankId ? { bankId: decoded.bankId } : {}),
        };
        next();
    }
    catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}
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
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }
        next();
    };
}
//# sourceMappingURL=authContext.js.map