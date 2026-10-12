import path from "node:path";
import { mkdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as postgresDrizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { drizzle as embeddedDrizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "./schema";
import { ensureSchema } from "./ensureSchema";
import { getPostgresConnectionString } from "./config";

export type AppDatabase = NodePgDatabase<typeof schema> | PgliteDatabase<typeof schema>;
export type DatabaseConnection =
  | { kind: "postgresql"; db: NodePgDatabase<typeof schema>; client: Pool }
  | { kind: "embedded"; db: PgliteDatabase<typeof schema>; client: PGlite };

export class DatabaseUnavailableError extends Error {
  constructor(message = "The save database is unavailable. Please try again in a moment.", options?: ErrorOptions) {
    super(message, options);
    this.name = "DatabaseUnavailableError";
  }
}

const globalForDb = globalThis as typeof globalThis & {
  __undeadSlayerDatabase?: Promise<DatabaseConnection>;
};

/** Never create a connection at import time: builds do not need a database. */
export function getDatabaseMode(): DatabaseConnection["kind"] | "unconfigured" {
  if (getPostgresConnectionString()) return "postgresql";
  // Serverless filesystems are ephemeral. Never silently use them for player saves.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return "unconfigured";
  if (process.env.PGLITE_DATA_DIR || process.env.NODE_ENV !== "production") return "embedded";
  return "unconfigured";
}

async function connectDatabase(): Promise<DatabaseConnection> {
  const mode = getDatabaseMode();
  if (mode === "unconfigured") {
    throw new DatabaseUnavailableError(
      "The production save database is not connected. Connect PostgreSQL in your hosting project, set DATABASE_URL or POSTGRES_URL for this deployment, and redeploy. For a single-server installation, set PGLITE_DATA_DIR to a persistent directory.",
    );
  }

  let connection: DatabaseConnection | undefined;
  try {
    if (mode === "postgresql") {
      const pool = new Pool({
        connectionString: getPostgresConnectionString()!,
        max: 5,
        connectionTimeoutMillis: 8_000,
        idleTimeoutMillis: 30_000,
        statement_timeout: 15_000,
        query_timeout: 20_000,
      });
      // An idle socket failure must not take down the game server.
      pool.on("error", () => console.error("[database] An idle PostgreSQL connection failed."));
      connection = { kind: mode, db: postgresDrizzle(pool, { schema }), client: pool };
    } else {
      // Runtime player data is never a deployable/build-traced asset.
      const dataDir = path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.PGLITE_DATA_DIR || "data/undead-slayer");
      await mkdir(dataDir, { recursive: true });
      const client = new PGlite(dataDir);
      connection = { kind: mode, db: embeddedDrizzle(client, { schema }), client };
      await client.waitReady;
    }
    // Both drivers use the same versioned PostgreSQL migrations.
    await ensureSchema(connection);
    return connection;
  } catch (error) {
    if (connection?.kind === "postgresql") await connection.client.end().catch(() => {});
    if (connection?.kind === "embedded") await connection.client.close().catch(() => {});
    throw new DatabaseUnavailableError(undefined, { cause: error });
  }
}

/** One connection AND one initialization promise across all routes and dev reloads. */
export async function getDatabaseConnection(): Promise<DatabaseConnection> {
  if (!globalForDb.__undeadSlayerDatabase) {
    const pending = connectDatabase();
    globalForDb.__undeadSlayerDatabase = pending;
    // A failed startup must be retryable, not cached forever.
    void pending.catch(() => {
      if (globalForDb.__undeadSlayerDatabase === pending) {
        delete globalForDb.__undeadSlayerDatabase;
      }
    });
  }
  return globalForDb.__undeadSlayerDatabase;
}

export async function getDatabase(): Promise<AppDatabase> {
  return (await getDatabaseConnection()).db;
}

// Used by the setup CLI and tests; request handlers keep their shared client open.
export async function closeDatabase(): Promise<void> {
  const pending = globalForDb.__undeadSlayerDatabase;
  delete globalForDb.__undeadSlayerDatabase;
  if (!pending) return;
  const connection = await pending;
  if (connection.kind === "postgresql") await connection.client.end();
  else await connection.client.close();
}
