/**
 * MongoDB client bootstrap.
 *
 * Reads `MONGO_URI` from the `.env` file via Node's built-in
 * `process.loadEnvFile()` (Node 22+, no `dotenv` dependency required) and
 * exports a `connectDb` helper that the repository module calls once at
 * startup via a top-level `await`.
 *
 * @author Shiri Rave
 * @since 09/06/26
 */
import { MongoClient } from "mongodb";

process.loadEnvFile();

const client = new MongoClient(process.env.MONGO_URI!);

/**
 * Open the MongoDB connection and return the application database handle.
 *
 * Called once at module load time from {@link repositories.ts}. The returned
 * `Db` instance is shared across all collections.
 *
 * @returns A promise that resolves with the `"mydb"` database handle.
 */
export async function connectDb() {
  await client.connect();
  return client.db("mydb");
}
