/**
 * Remove personally-identifiable and internally-sensitive fields from an account
 * before sending it to a BANKER.
 *
 * Stripped: `customerName`, `phone`, `email` (PII) and `status`, `managerId`
 * (internal operational data bankers have no need to see).
 * Kept: `id`, `highActivity`, `lastActivity`, `salary`, `loanAmount`, `propertyValue`.
 *
 * @param account - The full account record.
 * @returns The account with sensitive fields stripped.
 */
export function stripAccountPII(account) {
    const { customerName, phone, email, status, managerId, ...safe } = account;
    return safe;
}
/**
 * Return true when the requesting user is allowed to mutate the account.
 *
 * - ADMIN: always permitted.
 * - MANAGER: permitted only for accounts assigned to them (`managerId === user.id`).
 * - All other roles: denied.
 *
 * @param account - The account being accessed.
 * @param user    - The authenticated requesting user.
 */
export function canManageAccount(account, user) {
    if (user.role === "ADMIN")
        return true;
    if (user.role === "MANAGER")
        return account.managerId === user.id;
    return false;
}
/**
 * Filter the accounts list down to those visible to the requesting user.
 *
 * Visibility matrix:
 * - ADMIN:   all accounts.
 * - MANAGER: accounts where `managerId === user.id`.
 * - USER:    accounts referenced by at least one event the user created.
 * - BANKER:  accounts that have an OPEN auction where the banker's bank is in
 *            `eligibleBankIds`. PII fields must be stripped by the caller via
 *            {@link stripAccountPII} before sending the response.
 *
 * @param accounts   - Full list of all accounts in the system.
 * @param user       - The authenticated requesting user.
 * @param userEvents - All events (used to derive USER-scope account ids).
 * @param auctions   - All auctions (used to derive BANKER-scope account ids).
 * @returns The filtered subset of accounts.
 */
export function scopeAccountsForUser(accounts, user, userEvents, auctions = []) {
    switch (user.role) {
        case "ADMIN":
            return accounts;
        case "MANAGER":
            return accounts.filter((a) => a.managerId === user.id);
        case "USER": {
            const relatedIds = new Set(userEvents
                .filter((e) => e.createdByUserId === user.id)
                .map((e) => e.accountId));
            return accounts.filter((a) => relatedIds.has(a.id));
        }
        case "BANKER": {
            if (!user.bankId)
                return [];
            const bankId = user.bankId;
            const eligibleAccountIds = new Set(auctions
                .filter((a) => a.status === "OPEN" && a.eligibleBankIds.includes(bankId))
                .map((a) => a.accountId));
            return accounts.filter((a) => eligibleAccountIds.has(a.id));
        }
        default:
            return [];
    }
}
/**
 * Filter the events list down to those visible to the requesting user.
 *
 * Visibility matrix:
 * - ADMIN:   all events.
 * - MANAGER: events on accounts assigned to them.
 * - USER:    only events they created.
 * - BANKER:  none.
 *
 * @param events   - Full list of all events in the system.
 * @param user     - The authenticated requesting user.
 * @param accounts - All accounts (used to derive MANAGER-scope event ids).
 * @returns The filtered subset of events.
 */
export function scopeEventsForUser(events, user, accounts) {
    switch (user.role) {
        case "ADMIN":
            return events;
        case "MANAGER": {
            const myAccountIds = new Set(accounts.filter((a) => a.managerId === user.id).map((a) => a.id));
            return events.filter((e) => myAccountIds.has(e.accountId));
        }
        case "USER":
            return events.filter((e) => e.createdByUserId === user.id);
        default:
            return [];
    }
}
/**
 * Return the public (no password hash) projection of a user record.
 *
 * @param user - A full user record including `passwordHash`.
 * @returns {@link PublicUser} with `passwordHash` omitted.
 */
export function toPublicUser(user) {
    const { passwordHash, ...rest } = user;
    return rest;
}
//# sourceMappingURL=rbac.js.map