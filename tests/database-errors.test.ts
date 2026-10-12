import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectDatabaseFailure, safeServerErrorMessage, DATABASE_ERROR_MESSAGES } from "../src/lib/databaseErrors";
import { requestJson, RequestError } from "../src/lib/clientApi";
import { apiError, ApiError } from "../src/lib/api";
import { DatabaseUnavailableError } from "../src/db";

const rawSql = 'Failed query: select "id", "username", "password_hash" from "users" where "users"."username" = $1 limit $2 params: private-user,1';

for (const [driverCode, publicCode] of [
  ["42P01", "DATABASE_SCHEMA_NOT_READY"], ["42703", "DATABASE_SCHEMA_NOT_READY"],
  ["42501", "DATABASE_PERMISSION_DENIED"], ["28P01", "DATABASE_CREDENTIALS_REJECTED"],
  ["ECONNREFUSED", "DATABASE_CONNECTION_FAILED"], ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "DATABASE_TLS_ERROR"],
] as const) {
  test(`nested ${driverCode} errors have safe, actionable diagnostics`, () => {
    const original = Object.assign(new Error("postgresql://private:secret@private-host/game"), { code: driverCode });
    const wrapped = new Error(rawSql, { cause: new Error("another private exception", { cause: original }) });
    const failure = inspectDatabaseFailure(wrapped)!;
    assert.equal(failure.code, publicCode);
    assert.equal(failure.message, DATABASE_ERROR_MESSAGES[publicCode]);
    assert.doesNotMatch(failure.message, /private|secret|password_hash|select|params:/i);
    const startup = new DatabaseUnavailableError(undefined, { cause: wrapped });
    assert.equal(startup.code, publicCode);
    assert.equal(startup.message, failure.message);
  });
}

test("cyclic and aggregate causes cannot leak SQL or hang diagnostic inspection", () => {
  const cycle: { cause?: unknown; code?: string } = {};
  cycle.cause = cycle;
  assert.equal(inspectDatabaseFailure(cycle), undefined);
  assert.equal(inspectDatabaseFailure({ code: "constructor" }), undefined);
  assert.equal(inspectDatabaseFailure(new AggregateError([cycle, { code: "ECONNRESET" }]))?.code, "DATABASE_CONNECTION_FAILED");
});

test("public API responses and logs never contain the underlying query or credentials", async (t) => {
  const logger = t.mock.method(console, "error", () => {});
  const cause = Object.assign(new Error("database secret: postgresql://private:secret@host/game"), { code: "42P01" });
  const response = apiError(new Error(rawSql, { cause }), "login");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.text();
  assert.match(body, /DATABASE_SCHEMA_NOT_READY/);
  assert.doesNotMatch(body, /private-user|secret|password_hash|params:|select|postgresql:/i);
  assert.doesNotMatch(JSON.stringify(logger.mock.calls), /private-user|secret|password_hash|params:|select|postgresql:/i);
  assert.equal((await apiError(new ApiError(401, "Invalid username or password."), "login").json()).error, "Invalid username or password.");
});

test("client defence redacts the exact older-deployment error from the screenshot", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ error: rawSql }, { status: 500 }));
  await assert.rejects(requestJson("/api/auth/login", { method: "POST" }), (error: unknown) => {
    assert.ok(error instanceof RequestError);
    assert.equal(error.status, 500);
    assert.equal(error.message, DATABASE_ERROR_MESSAGES.DATABASE_UNAVAILABLE);
    return true;
  });
});

test("controlled validation and sign-in errors remain readable", () => {
  assert.equal(safeServerErrorMessage("Invalid username or password."), "Invalid username or password.");
  assert.equal(safeServerErrorMessage("Please send a valid JSON request."), "Please send a valid JSON request.");
  assert.equal(safeServerErrorMessage("postgresql://username:password@host/database"), DATABASE_ERROR_MESSAGES.DATABASE_UNAVAILABLE);
});
