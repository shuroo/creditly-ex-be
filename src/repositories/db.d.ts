/**
 * Open the MongoDB connection and return the application database handle.
 *
 * Called once at module load time from {@link repositories.ts}. The returned
 * `Db` instance is shared across all collections.
 *
 * @returns A promise that resolves with the `"mydb"` database handle.
 */
export declare function connectDb(): Promise<import("mongodb").Db>;
//# sourceMappingURL=db.d.ts.map