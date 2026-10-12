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
