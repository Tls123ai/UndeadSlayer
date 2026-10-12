import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const password = "testpass123";
const username = () => `test_${randomUUID().slice(0, 12)}`;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function enterRealm(page: Page) {
  const name = username();
  const response = await page.request.post("/api/auth/register", { data: { username: name, password } });
  expect(response.status()).toBe(201);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Continue Adventure", exact: true })).toBeVisible();
  return name;
}

async function openArmory(page: Page) {
  await page.getByRole("button", { name: /Armory.*Items/ }).click();
  await expect(page.getByRole("button", { name: "Buy (60 C)" })).toBeVisible();
}

async function savedProgress(page: Page) {
  const response = await page.request.get("/api/game/progress");
  expect(response.status()).toBe(200);
  return (await response.json()).progress;
}

// Next streaming temporarily retains a hidden copy of the route fallback.
// Loading assertions must target the screen actually shown to the player.
test("startup displays a branded accessible loader while the session/database is checked", async ({ page }) => {
  await page.route("**/api/auth/me", async (route) => { await pause(900); await route.continue(); });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("loading-screen").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "UNDEAD SLAYER", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Loading your adventure", exact: true })).toBeVisible();
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByText("Connecting to the save database…", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Account", exact: true })).toBeVisible();
  await expect(page.getByTestId("loading-screen").filter({ visible: true })).toHaveCount(0);
});

test("fast cached startup still shows the loading screen for the eight-second intro", async ({ page }) => {
  await page.addInitScript(() => {
    const measurements: { started?: number; finished?: number } = {};
    Object.defineProperty(window, "loadingMeasurements", { value: measurements });
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/api/auth/me")) measurements.started = performance.now();
      return originalFetch(input, init);
    };
    const observer = new MutationObserver(() => {
      if (measurements.started !== undefined && !document.querySelector('[data-testid="loading-screen"]')) {
        measurements.finished = performance.now();
        observer.disconnect();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { authenticated: false, database: "embedded" } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("loading-screen").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create Account", exact: true })).toBeVisible();
  const duration = await page.evaluate(() => {
    const timing = (window as unknown as { loadingMeasurements: { started?: number; finished?: number } }).loadingMeasurements;
    if (timing.started === undefined || timing.finished === undefined) throw new Error("Loading timing was not recorded.");
    return timing.finished - timing.started;
  });
  expect(duration).toBeGreaterThanOrEqual(7_900);
});

test("database/startup failures have a retry screen instead of silently falling through to login", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/auth/me", async (route) => {
    if (++attempts === 1) await route.fulfill({ status: 503, json: { error: "The save database is unavailable. Please try again." } });
    else await route.continue();
  });
  await page.goto("/");
  await expect(page.getByTestId("loading-screen").filter({ visible: true }).getByRole("alert")).toContainText("save database is unavailable");
  await expect(page.getByRole("button", { name: "Create Account", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("button", { name: "Create Account", exact: true })).toBeVisible();
  expect(attempts).toBe(2);
});

test("registration, reload, logout and login use the persistent database", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const name = username();
  await page.goto("/");
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await page.getByLabel("Slayer Username").fill(name);
  await page.getByLabel("Secret Passphrase", { exact: true }).fill(password);
  await page.getByLabel("Confirm Passphrase").fill(password);
  await page.route("**/api/auth/register", async (route) => { await pause(350); await route.continue(); });
  await page.getByRole("button", { name: "Forge Account & Enter Realm" }).click();
  await expect(page.getByRole("heading", { name: "Forging your slayer's legacy" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue Adventure", exact: true })).toBeVisible();
  await expect(page.getByTestId("save-status")).toContainText("Progress saved");
  const initial = await savedProgress(page);
  expect(initial.coins).toBe(600);
  expect(initial.inventory).toHaveLength(3);
  await openArmory(page);
  await page.getByRole("button", { name: "Buy (60 C)" }).click();
  await expect(page.getByTestId("save-status")).toContainText("Progress saved");
  expect((await savedProgress(page)).coins).toBe(540);
  await page.reload();
  await expect(page.getByRole("button", { name: "Continue Adventure", exact: true })).toBeVisible();
  expect((await savedProgress(page)).healthPotions).toBe(6);
  await page.getByTitle("Settings & Profile").click();
  await page.getByRole("button", { name: "Save Progress & Sign Out" }).click();
  await expect(page.getByRole("button", { name: "Sign In & Resume Quest" })).toBeVisible();
  await page.getByLabel("Slayer Username").fill(name);
  await page.getByLabel("Secret Passphrase", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In & Resume Quest" }).click();
  await expect(page.getByRole("button", { name: "Continue Adventure", exact: true })).toBeVisible();
  expect((await savedProgress(page)).coins).toBe(540);
  expect(errors).toEqual([]);
  expect(await page.locator("img").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
});

test("a failed save is visible, retryable, and keeps optimistic changes", async ({ page }) => {
  await enterRealm(page);
  let attempts = 0;
  await page.route("**/api/game/progress", async (route) => {
    if (route.request().method() === "POST" && ++attempts === 1) {
      await route.fulfill({ status: 503, json: { error: "The database is temporarily offline." } });
    } else await route.continue();
  });
  await openArmory(page);
  await page.getByRole("button", { name: "Buy (60 C)" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Progress not saved" })).toContainText("Progress not saved");
  await expect(page.getByTestId("save-status")).toContainText("Unsaved changes");
  expect((await savedProgress(page)).coins).toBe(600);
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await expect(page.getByTestId("save-status")).toContainText("Progress saved");
  await expect(page.getByRole("alert").filter({ hasText: "Progress not saved" })).toHaveCount(0);
  const restored = await savedProgress(page);
  expect(restored.coins).toBe(540);
  expect(restored.healthPotions).toBe(6);
});

test("rapid purchases are serialized and do not overwrite one another", async ({ page }) => {
  await enterRealm(page);
  const snapshots: number[] = [];
  await page.route("**/api/game/progress", async (route) => {
    if (route.request().method() === "POST") {
      snapshots.push(route.request().postDataJSON().coins);
      if (snapshots.length === 1) await pause(300);
    }
    await route.continue();
  });
  await openArmory(page);
  await page.getByRole("button", { name: "Buy (60 C)" }).click();
  await page.getByRole("button", { name: "Buy (60 C)" }).click();
  await expect(page.getByTestId("save-status")).toContainText("Progress saved");
  const restored = await savedProgress(page);
  expect(restored.coins).toBe(480);
  expect(restored.healthPotions).toBe(7);
  expect(snapshots).toEqual([540, 480]);
});

test("an expired session can sign in again without losing pending changes", async ({ page }) => {
  const name = await enterRealm(page);
  expect((await page.request.post("/api/auth/logout")).ok()).toBe(true);
  await openArmory(page);
  await page.getByRole("button", { name: "Buy (60 C)" }).click();
  await expect(page.getByRole("button", { name: "Sign in to save" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in to save" }).click();
  await expect(page.getByLabel("Slayer Username")).toHaveValue(name);
  await expect(page.getByLabel("Slayer Username")).toHaveAttribute("readonly", "");
  await page.getByLabel("Secret Passphrase", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In & Resume Quest" }).click();
  // The armory modal stays open; all optimistic progress stays in the game root.
  await expect(page.getByTestId("save-status")).toContainText("Progress saved");
  expect((await savedProgress(page)).coins).toBe(540);
});

test("battle loading finishes before the combat canvas mounts, with no runtime errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await enterRealm(page);
  await page.getByRole("button", { name: "Continue Adventure", exact: true }).click();
  await expect(page.getByTestId("loading-screen").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Entering Outskirts Infiltration" })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("canvas")).toBeVisible();
  await page.getByTitle("Pause (P)").click();
  await expect(page.getByTestId("loading-screen").filter({ visible: true })).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.getByTitle("Abandon run").click();
  await expect(page.getByRole("button", { name: "Continue Adventure", exact: true })).toBeVisible();
});

test("artwork decode failures do not start combat and can be retried", async ({ page }) => {
  await enterRealm(page);
  await page.evaluate(() => {
    const original = HTMLImageElement.prototype.decode;
    Object.defineProperty(window, "restoreArtworkDecode", { value: () => { HTMLImageElement.prototype.decode = original; }, configurable: true });
    HTMLImageElement.prototype.decode = () => Promise.reject(new Error("test decode failure"));
  });
  await page.getByRole("button", { name: "Continue Adventure", exact: true }).click();
  await expect(page.getByTestId("loading-screen").filter({ visible: true }).getByRole("alert")).toContainText("artwork could not be loaded");
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.evaluate(() => (window as unknown as { restoreArtworkDecode: () => void }).restoreArtworkDecode());
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator("canvas")).toBeVisible();
});

test.describe("mobile accessibility", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  test("loading fits the viewport and respects reduced motion", async ({ page }) => {
    await page.route("**/api/auth/me", async (route) => { await pause(1000); await route.continue(); });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("loading-screen").filter({ visible: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator(".realm-loader__rune").first().evaluate((element) => getComputedStyle(element).animationName)).toBe("none");
    await expect(page.getByRole("button", { name: "Create Account", exact: true })).toBeVisible();
  });
});

test("legacy SQL errors during sign-in are redacted instead of exposing queries or account parameters", async ({ page }) => {
  await page.route("**/api/auth/login", (route) => route.fulfill({ status: 500, json: {
    error: 'Failed query: select "id", "username", "password_hash" from "users" where "users"."username" = $1 limit $2 params: sensitive-account,1',
  } }));
  await page.goto("/");
  await page.getByLabel("Slayer Username").fill("test-slayer");
  await page.getByLabel("Secret Passphrase", { exact: true }).fill("testpass123");
  await page.getByRole("button", { name: "Sign In & Resume Quest" }).click();
  const alert = page.getByRole("alert").filter({ hasText: "save database" });
  await expect(alert).toContainText("temporarily unavailable");
  await expect(alert).not.toContainText(/Failed query|password_hash|select|params:|sensitive-account/i);
  await expect(page.getByLabel("Slayer Username")).toHaveValue("test-slayer");
});
