import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer, type AddressInfo } from "node:net";
import EmbeddedPostgres from "embedded-postgres";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../src/db/schema";
import { ensureSchema } from "../src/db/ensureSchema";
import { getDatabaseConnection, closeDatabase, DatabaseUnavailableError } from "../src/db";
import { getOrCreateProgress } from "../src/db/progress";
import journal from "../drizzle/meta/_journal.json";

async function unusedLocalPort() {
  const socket = createServer();
  await new Promise<void>((resolve, reject) => { socket.once("error", reject); socket.listen(0, "127.0.0.1", resolve); });
  const port = (socket.address() as AddressInfo).port;
  await new Promise<void>((resolve, reject) => socket.close((error) => error ? reject(error) : resolve()));
  return port;
}

test("native PostgreSQL initialization, pooled-safe locking, legacy accounts and connection diagnostics", { timeout: 90_000 }, async (t) => {
  // Always start our own isolated cluster. Never read or mutate a hosted database.
  const previous = { ...process.env };
  const directory = await mkdtemp(path.join(tmpdir(), "undead-native-pg-"));
  const port = await unusedLocalPort();
  const password = "throwaway-native-test-password";
  const server = new EmbeddedPostgres({
    databaseDir: path.join(directory, "cluster"), port, user: "test_slayer", password,
    persistent: false, createPostgresUser: false, authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"], postgresFlags: ["-h", "127.0.0.1", "-k", directory],
    onLog: () => {}, onError: () => {},
  });
  let started = false;
  try {
    await server.initialise();
    await server.start(); started = true;
    await server.createDatabase("undead_native_test");
    const url = `postgresql://test_slayer:${password}@127.0.0.1:${port}/undead_native_test`;
    process.env.DATABASE_URL = url;
    process.env.POSTGRES_URL = "";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "preview";
    let connection = await getDatabaseConnection();
    assert.equal(connection.kind, "postgresql");
    if (connection.kind !== "postgresql") throw new Error("Native PostgreSQL was not selected.");
    const passwordHash = await bcrypt.hash("legacy-game-passphrase", 4);
    const [user] = await connection.db.insert(schema.users).values({ username: "legacy-slayer", passwordHash }).returning();
    await getOrCreateProgress(connection.db, user.id);
    await connection.db.update(schema.gameProgress).set({ coins: 543, selectedHeroId: "luna" }).where(eq(schema.gameProgress.userId, user.id));

    await t.test("empty PostgreSQL receives both migrations and complete starter saves", async () => {
      const history = await connection.db.execute(sql`SELECT count(*) AS count FROM drizzle.__drizzle_migrations`);
      assert.equal(Number(history.rows[0].count), journal.entries.length);
      const save = await getOrCreateProgress(connection.db, user.id);
      assert.equal(save.coins, 543);
      assert.equal(save.inventory.length, 3);
      assert.deepEqual(save.unlockedHeroes, ["aiden", "luna"]);
    });

    await t.test("independent connections serialize migrations without leaving session locks", async () => {
      const left = new Pool({ connectionString: url, max: 2 });
      const right = new Pool({ connectionString: url, max: 2 });
      try {
        await Promise.all([
          ensureSchema({ kind: "postgresql", client: left, db: drizzle(left, { schema }) }),
          ensureSchema({ kind: "postgresql", client: right, db: drizzle(right, { schema }) }),
        ]);
        const history = await left.query("SELECT created_at FROM drizzle.__drizzle_migrations");
        assert.equal(history.rowCount, journal.entries.length);
        assert.equal(new Set(history.rows.map((row) => row.created_at)).size, journal.entries.length);
        const locks = await left.query("SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' AND objid = 73519428");
        assert.equal(Number(locks.rows[0].count), 0);
      } finally { await left.end(); await right.end(); }
    });

    await t.test("legacy users missing timestamps are repaired without changing credentials or saves", async () => {
      await connection.db.execute(sql`ALTER TABLE users DROP COLUMN created_at`);
      await connection.db.execute(sql`ALTER TABLE users DROP COLUMN updated_at`);
      await connection.db.execute(sql`DELETE FROM drizzle.__drizzle_migrations WHERE created_at = ${journal.entries[1].when}`);
      await closeDatabase();
      connection = await getDatabaseConnection();
      const [restored] = await connection.db.select().from(schema.users).where(eq(schema.users.id, user.id));
      assert.equal(restored.passwordHash, passwordHash);
      assert.equal(await bcrypt.compare("legacy-game-passphrase", restored.passwordHash), true);
      assert.ok(restored.createdAt instanceof Date);
      assert.ok(restored.updatedAt instanceof Date);
      const save = await getOrCreateProgress(connection.db, user.id);
      assert.equal(save.coins, 543);
      assert.equal(save.selectedHeroId, "luna");
    });

    await t.test("rejected PostgreSQL credentials fail safely and can be retried", async () => {
      await closeDatabase();
      process.env.DATABASE_URL = url.replace(password, "incorrect-test-password");
      await assert.rejects(getDatabaseConnection(), (error: unknown) => {
        assert.ok(error instanceof DatabaseUnavailableError);
        assert.equal(error.code, "DATABASE_CREDENTIALS_REJECTED");
        assert.doesNotMatch(error.message, /incorrect-test-password|throwaway-native-test-password|postgresql:\/\//);
        return true;
      });
      process.env.DATABASE_URL = url;
      connection = await getDatabaseConnection();
      assert.equal((await getOrCreateProgress(connection.db, user.id)).coins, 543);
    });

    await t.test("database permission failures stop setup before any sign-in query", async () => {
      await connection.db.execute(sql.raw("CREATE ROLE limited_slayer LOGIN PASSWORD 'temporary-permission-test'"));
      await closeDatabase();
      process.env.DATABASE_URL = `postgresql://limited_slayer:temporary-permission-test@127.0.0.1:${port}/undead_native_test`;
      await assert.rejects(getDatabaseConnection(), (error: unknown) => {
        assert.ok(error instanceof DatabaseUnavailableError);
        assert.equal(error.code, "DATABASE_PERMISSION_DENIED");
        return true;
      });
      process.env.DATABASE_URL = url;
      connection = await getDatabaseConnection();
    });

    await t.test("an incompatible legacy table is rejected instead of failing SELECT users or declaring health ready", async () => {
      await connection.db.execute(sql`ALTER TABLE users DROP COLUMN password_hash`);
      await closeDatabase();
      await assert.rejects(getDatabaseConnection(), (error: unknown) => {
        assert.ok(error instanceof DatabaseUnavailableError);
        assert.equal(error.code, "DATABASE_SCHEMA_NOT_READY");
        assert.doesNotMatch(error.message, /password_hash|select|params:/i);
        return true;
      });
    });
  } finally {
    await closeDatabase().catch(() => {});
    if (started) await server.stop();
    await rm(directory, { recursive: true, force: true });
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
