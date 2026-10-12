import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate as migratePostgres } from "drizzle-orm/node-postgres/migrator";
import { migrate as migrateEmbedded } from "drizzle-orm/pglite/migrator";
import type { DatabaseConnection } from "./index";

/** Migration errors propagate to the caller. A save must never report success
 * against a missing schema. getDatabaseConnection resets failed initialization. */
export async function ensureSchema(connection: DatabaseConnection): Promise<void> {
  const config = { migrationsFolder: path.join(process.cwd(), "drizzle") };
  if (connection.kind === "embedded") {
    await migrateEmbedded(connection.db, config);
    return;
  }

  // Serialize migrations across serverless instances, not just inside one process.
  const client = await connection.client.connect();
  try {
    await client.query("SELECT pg_advisory_lock(73519428)");
    await migratePostgres(drizzle(client), config);
  } finally {
    await client.query("SELECT pg_advisory_unlock(73519428)").catch(() => {});
    client.release();
  }
}
