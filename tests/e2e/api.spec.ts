import { test, expect, request as requestFactory } from "@playwright/test";
import { randomUUID } from "node:crypto";

const credentials = () => ({ username: `api_${randomUUID().slice(0, 12)}`, password: "testpass123" });

test("health actually checks the initialized save database", async ({ request }) => {
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ ok: true, persistent: true });
  expect(health.headers()["cache-control"]).toBe("no-store");
});

test("accounts reject invalid input, duplicates and wrong passwords without exposing hashes", async ({ request }) => {
  expect((await request.post("/api/auth/register", { data: { username: 10, password: "12345" } })).status()).toBe(400);
  expect((await request.post("/api/auth/login", { data: { username: [], password: 10 } })).status()).toBe(400);
  expect((await request.post("/api/auth/register", { data: "not json", headers: { "Content-Type": "application/json" } })).status()).toBe(400);
  const account = credentials();
  const registration = await request.post("/api/auth/register", { data: account });
  expect(registration.status()).toBe(201);
  expect((await registration.json()).user).toEqual({ id: expect.any(Number), username: account.username });
  expect(await registration.text()).not.toContain("passwordHash");
  expect((await request.post("/api/auth/register", { data: account })).status()).toBe(409);
  expect((await request.post("/api/auth/login", { data: { ...account, password: "wrong-password" } })).status()).toBe(401);
});

test("save ownership comes only from a valid database-backed session", async ({ request, baseURL }) => {
  const anonymous = await requestFactory.newContext({ baseURL });
  const second = await requestFactory.newContext({ baseURL });
  try {
    expect((await anonymous.get("/api/game/progress")).status()).toBe(401);
    expect((await anonymous.post("/api/game/progress", { data: { coins: 1 } })).status()).toBe(401);
    const firstAccount = credentials();
    const first = await (await request.post("/api/auth/register", { data: firstAccount })).json();
    const other = await (await second.post("/api/auth/register", { data: credentials() })).json();
    const update = await request.post("/api/game/progress", { data: { userId: other.user.id, id: other.progress.id, coins: 123 } });
    expect(update.status()).toBe(200);
    expect((await update.json()).progress.userId).toBe(first.user.id);
    expect((await (await second.get("/api/game/progress")).json()).progress.coins).toBe(600);
    expect((await request.post("/api/game/progress", { data: { coins: -1 } })).status()).toBe(400);
    expect((await request.post("/api/game/progress", { data: { selectedHeroId: "ronan" } })).status()).toBe(400);

    const originalCookie = (await request.storageState()).cookies.find((cookie) => cookie.name === "undead_slayer_session")!;
    expect(originalCookie.httpOnly).toBe(true);
    expect(originalCookie.value).toMatch(/^[a-f0-9]{64}$/);
    const forged = Buffer.from(JSON.stringify({ userId: first.user.id, username: firstAccount.username })).toString("base64");
    expect((await anonymous.get("/api/game/progress", { headers: { Cookie: `undead_slayer_session=${forged}` } })).status()).toBe(401);
    expect((await request.post("/api/auth/logout")).status()).toBe(200);
    expect((await anonymous.get("/api/game/progress", { headers: { Cookie: `undead_slayer_session=${originalCookie.value}` } })).status()).toBe(401);
    const login = await request.post("/api/auth/login", { data: firstAccount });
    expect(login.status()).toBe(200);
    expect((await login.json()).progress.coins).toBe(123);
  } finally {
    await anonymous.dispose();
    await second.dispose();
  }
});

test("health only declares readiness after verifying the account/save schema", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, persistent: true, schemaReady: true });
});
