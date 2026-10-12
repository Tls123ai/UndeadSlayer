import { test } from "node:test";
import assert from "node:assert/strict";
import { getPostgresConnectionString } from "../src/db/config";

test("DATABASE_URL is preferred when both PostgreSQL variables are set", () => {
  assert.equal(getPostgresConnectionString({ DATABASE_URL: " postgresql://primary/game ", POSTGRES_URL: "postgresql://integration/game" }), "postgresql://primary/game");
});

test("Vercel POSTGRES_URL is recognized without DATABASE_URL", () => {
  assert.equal(getPostgresConnectionString({ POSTGRES_URL: " postgresql://integration/game " }), "postgresql://integration/game");
  assert.equal(getPostgresConnectionString({ DATABASE_URL: "   ", POSTGRES_URL: "postgresql://integration/game" }), "postgresql://integration/game");
});

test("missing database configuration does not invent a connection", () => {
  assert.equal(getPostgresConnectionString({}), undefined);
  assert.equal(getPostgresConnectionString({ DATABASE_URL: "", POSTGRES_URL: " " }), undefined);
});

test("unconfigured Vercel previews name the Preview environment, not Production", async () => {
  const { getDatabaseSetupMessage } = await import("../src/db/config");
  assert.match(getDatabaseSetupMessage({ VERCEL: "1", VERCEL_ENV: "preview" }), /Preview environment/);
  assert.match(getDatabaseSetupMessage({ VERCEL: "1", VERCEL_ENV: "production" }), /Production environment/);
  assert.doesNotMatch(getDatabaseSetupMessage({ VERCEL: "1", VERCEL_ENV: "preview" }), /PGLITE_DATA_DIR/);
  assert.match(getDatabaseSetupMessage({ NODE_ENV: "production" }), /persistent directory/);
});
