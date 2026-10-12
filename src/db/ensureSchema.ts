import path from "node:path";
import { sql, getTableColumns, getTableName } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { users, sessions, gameProgress } from "./schema";
import type { DatabaseConnection, AppDatabase } from "./index";

export class DatabaseSchemaError extends Error {
  readonly code = "DATABASE_SCHEMA_NOT_READY";
  constructor(options?: ErrorOptions) {
    super("The database schema could not be initialized.", options);
    this.name = "DatabaseSchemaError";
  }
}

const MIGRATION_LOCK = 73519428;
const requiredColumns = [users, sessions, gameProgress].flatMap((table) =>
  Object.values(getTableColumns(table)).map((column) => `${getTableName(table)}.${column.name}`),
);

/** Fail before authentication when a table/column is missing, not in SELECT users.
 * Only names are checked; no account data is read or returned. */
async function verifySchema(db: AppDatabase) {
  const result = await db.execute(sql`
    SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name IN ('users', 'sessions', 'game_progress')
  `);
  const found = new Set(result.rows.map((row) => `${row.table_name}.${row.column_name}`));
  if (requiredColumns.some((column) => !found.has(column))) throw new DatabaseSchemaError();
}

/** One transaction includes the lock, journal, DDL, and schema verification.
 * A transaction-scoped lock is safe with Neon/PgBouncer transaction pooling;
 * session-level pg_advisory_lock can leak or unlock a different pooled session.
 * Failed setup rolls back, propagates, and can be retried by getDatabaseConnection. */
export async function ensureSchema(connection: DatabaseConnection): Promise<void> {
  let migrations: ReturnType<typeof readMigrationFiles>;
  try {
    migrations = readMigrationFiles({ migrationsFolder: path.join(process.cwd(), "drizzle") });
  } catch (cause) {
    throw new DatabaseSchemaError({ cause });
  }

  await connection.db.transaction(async (tx) => {
    if (connection.kind === "postgresql") await tx.execute(sql`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK})`);
    await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
    await tx.execute(sql`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at BIGINT
      )
    `);
    const history = await tx.execute(sql`
      SELECT created_at FROM "drizzle"."__drizzle_migrations" ORDER BY created_at DESC LIMIT 1
    `);
    const latest = Number(history.rows[0]?.created_at ?? -1);
    for (const migration of migrations) {
      if (migration.folderMillis <= latest) continue;
      for (const statement of migration.sql) {
        if (statement.trim()) await tx.execute(sql.raw(statement));
      }
      await tx.execute(sql`
        INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at)
        VALUES (${migration.hash}, ${migration.folderMillis})
      `);
    }
    await verifySchema(tx as AppDatabase);
  });
}
