import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { closeDatabase, getDatabase, getDatabaseConnection, getDatabaseMode, DatabaseUnavailableError } from "../src/db";
import { users, gameProgress, sessions } from "../src/db/schema";
import { getOrCreateProgress } from "../src/db/progress";
import { DEFAULT_INVENTORY_ITEMS, DEFAULT_SETTINGS } from "../src/lib/progress";

const env = process.env as Record<string, string | undefined>;
function localEnvironment(directory: string) {
  env.DATABASE_URL = "";
  env.POSTGRES_URL = "";
  env.VERCEL = "";
  env.AWS_LAMBDA_FUNCTION_NAME = "";
  env.NODE_ENV = "test";
  env.PGLITE_DATA_DIR = directory;
}

test("database policy is build-safe and never stores serverless saves on ephemeral disk", () => {
  const previous = { ...env };
  try {
    localEnvironment("");
    assert.equal(getDatabaseMode(), "embedded");
    env.NODE_ENV = "production";
    assert.equal(getDatabaseMode(), "unconfigured");
    env.PGLITE_DATA_DIR = "data/production";
    assert.equal(getDatabaseMode(), "embedded");
    env.VERCEL = "1";
    assert.equal(getDatabaseMode(), "unconfigured");
    env.POSTGRES_URL = "postgresql://integration.example.invalid/game";
    assert.equal(getDatabaseMode(), "postgresql");
    env.DATABASE_URL = "postgresql://example.invalid/game";
    assert.equal(getDatabaseMode(), "postgresql");
  } finally {
    for (const key of Object.keys(env)) if (!(key in previous)) delete env[key];
    Object.assign(env, previous);
  }
});

test("real database migrations, defaults, transactions, ownership and disk persistence", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "undead-slayer-db-"));
  const previous = { ...env };
  localEnvironment(directory);
  try {
    const [one, two, three] = await Promise.all([getDatabaseConnection(), getDatabaseConnection(), getDatabaseConnection()]);
    assert.strictEqual(one, two);
    assert.strictEqual(two, three);
    assert.equal(one.kind, "embedded");
    let db = await getDatabase();
    const [user] = await db.insert(users).values({ username: "slayer", passwordHash: "a-test-hash" }).returning();
    const initial = await getOrCreateProgress(db, user.id);

    await t.test("starter save is complete and initialization is idempotent", async () => {
      assert.equal(initial.coins, 600);
      assert.equal(initial.healthPotions, 5);
      assert.deepEqual(initial.completedLevels, []);
      assert.deepEqual(initial.unlockedHeroes, ["aiden", "luna"]);
      assert.deepEqual(initial.settings, DEFAULT_SETTINGS);
      assert.deepEqual(initial.inventory, DEFAULT_INVENTORY_ITEMS);
      assert.equal((await getOrCreateProgress(db, user.id)).id, initial.id);
      assert.equal((await db.select().from(gameProgress)).length, 1);
    });

    await t.test("failed account transactions roll back both user and progress", async () => {
      await assert.rejects(db.transaction(async (tx) => {
        const [created] = await tx.insert(users).values({ username: "rollback", passwordHash: "hash" }).returning();
        await tx.insert(gameProgress).values({ userId: created.id });
        throw new Error("intentional rollback");
      }), /intentional rollback/);
      assert.equal((await db.select().from(users)).length, 1);
      assert.equal((await db.select().from(gameProgress)).length, 1);
    });

    await db.update(gameProgress).set({ coins: 420, selectedHeroId: "luna", completedLevels: ["1-1"] }).where(eq(gameProgress.userId, user.id));
    await db.insert(sessions).values({ tokenHash: "test-token-hash", userId: user.id, expiresAt: new Date(Date.now() + 60_000) });
    await closeDatabase();
    db = await getDatabase();
    await t.test("saves and sessions survive closing and reopening the on-disk database", async () => {
      const restored = await getOrCreateProgress(db, user.id);
      assert.equal(restored.coins, 420);
      assert.equal(restored.selectedHeroId, "luna");
      assert.deepEqual(restored.completedLevels, ["1-1"]);
      assert.equal((await db.select().from(sessions))[0].userId, user.id);
    });

    await t.test("adopting an existing unversioned schema preserves player data", async () => {
      await db.execute(sql`DROP SCHEMA drizzle CASCADE`);
      await db.execute(sql`ALTER TABLE game_progress RENAME CONSTRAINT game_progress_user_id_users_id_fk TO legacy_progress_user_fk`);
      await db.execute(sql`ALTER TABLE game_progress ALTER COLUMN coins SET DEFAULT 500`);
      await closeDatabase();
      db = await getDatabase();
      assert.equal((await getOrCreateProgress(db, user.id)).coins, 420);
      const [newUser] = await db.insert(users).values({ username: "new-slayer", passwordHash: "hash" }).returning();
      assert.equal((await getOrCreateProgress(db, newUser.id)).coins, 600);
      await db.delete(users).where(eq(users.id, newUser.id));
    });

    await t.test("foreign keys cascade progress and sessions when their owner is deleted", async () => {
      await db.delete(users).where(eq(users.id, user.id));
      assert.equal((await db.select().from(gameProgress)).length, 0);
      assert.equal((await db.select().from(sessions)).length, 0);
    });
  } finally {
    await closeDatabase();
    await rm(directory, { recursive: true, force: true });
    for (const key of Object.keys(env)) if (!(key in previous)) delete env[key];
    Object.assign(env, previous);
  }
});

test("a failed database startup propagates and can be retried successfully", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "undead-slayer-retry-"));
  const invalidDirectory = path.join(directory, "not-a-directory");
  const previous = { ...env };
  localEnvironment(invalidDirectory);
  try {
    await writeFile(invalidDirectory, "invalid");
    await assert.rejects(getDatabase(), DatabaseUnavailableError);
    await rm(invalidDirectory);
    const db = await getDatabase();
    assert.deepEqual(await db.select().from(users), []);
  } finally {
    await closeDatabase();
    await rm(directory, { recursive: true, force: true });
    for (const key of Object.keys(env)) if (!(key in previous)) delete env[key];
    Object.assign(env, previous);
  }
});
