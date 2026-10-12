import { test, expect, type Page } from "@playwright/test";

async function enterRealm(page: Page) {
  const username = `pixel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const response = await page.request.post("/api/auth/register", { data: { username, password: "testpass123" } });
  expect(response.ok()).toBe(true);
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Continue Adventure", exact: true })).toBeVisible();
}

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test("pixel fonts, bitmap icons and square controls cover startup and authentication", async ({ page }) => {
  await page.route("**/api/auth/me", (route) => route.fulfill({ json: { authenticated: false, database: "embedded" } }));
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("loading-screen").filter({ visible: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "UNDEAD SLAYER", exact: true })).toHaveCSS("font-family", /Press Start 2P/);
  await expect(page.getByRole("progressbar")).toHaveCSS("border-radius", "0px");
  await expect(page.locator("[data-pixel-icon=swords]").first()).toBeVisible();
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await expect(page.getByLabel("Slayer Username")).toHaveCSS("border-radius", "0px");
  await expect(page.getByLabel("Slayer Username")).toHaveCSS("font-family", /Pixelify Sans/);
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('16px "Pixelify Sans Variable"') && document.fonts.check('16px "Press Start 2P"'))).toBe(true);
  await noOverflow(page);
});

test("all sanctuary windows share pixel chrome and matching low-resolution portraits", async ({ page }) => {
  await enterRealm(page);
  await expect(page.locator("img").first()).toHaveCSS("image-rendering", "pixelated");
  expect(await page.locator("img").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).naturalWidth === 40))).toBe(true);
  for (const item of [
    { button: /Class Select/, dialog: "Class selection" },
    { button: /^World Map/, dialog: "World map" },
    { button: /Stat Training/, dialog: "Stat training" },
    { button: /^Armory/, dialog: "Armory and inventory" },
  ]) {
    await page.getByRole("button", { name: item.button }).click();
    const dialog = page.getByRole("dialog", { name: item.dialog, exact: true });
    await expect(dialog).toBeVisible();
    expect(await dialog.locator("[data-pixel-icon]").count()).toBeGreaterThan(0);
    await noOverflow(page);
    if (item.dialog === "Class selection") {
      await expect(page.getByRole("img", { name: "Pixel-art battle model" })).toHaveAttribute("width", "75");
    }
    await dialog.getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.getByTitle("Settings & Profile").click();
  const settings = page.getByRole("dialog", { name: "Settings and profile" });
  await expect(settings).toBeVisible();
  await settings.getByLabel("Dynamic Screen Shake").uncheck();
  await expect(page.getByTestId("save-status")).toContainText("Progress saved");
  const save = await page.request.get("/api/game/progress");
  expect((await save.json()).progress.settings.screenShake).toBe(false);
});

test("combat uses a pixel framebuffer without rescaling the game world on pause or map toggles", async ({ page }) => {
  await enterRealm(page);
  await page.getByRole("button", { name: "Continue Adventure", exact: true }).click();
  const canvas = page.getByTestId("combat-canvas");
  await expect(canvas).toBeVisible();
  await expect(canvas).toHaveAttribute("width", "450");
  await expect(canvas).toHaveAttribute("height", "280");
  await expect(canvas).toHaveCSS("image-rendering", "pixelated");
  async function pixelContext() {
    expect(await canvas.evaluate((element) => {
      const ctx = (element as HTMLCanvasElement).getContext("2d")!;
      return { smoothing: ctx.imageSmoothingEnabled, a: ctx.getTransform().a, d: ctx.getTransform().d };
    })).toEqual({ smoothing: false, a: 0.5, d: 0.5 });
  }
  await pixelContext();
  await page.getByTitle("Pause (P)").click();
  await expect(page.getByText("Paused", { exact: true })).toBeVisible();
  await pixelContext();
  await page.getByTitle("Room map (M)").click();
  await pixelContext();
  await page.getByTitle("Abandon run").click();
  await expect(page.getByRole("button", { name: "Continue Adventure", exact: true })).toBeVisible();
});

test("pixel layouts and settings stay usable on a small screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await enterRealm(page);
  await noOverflow(page);
  for (const button of [/Class Select/, /^World Map/, /Stat Training/, /^Armory/]) {
    await page.getByRole("button", { name: button }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await noOverflow(page);
    await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  }
  await page.getByTitle("Settings & Profile").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await noOverflow(page);
  const nameBox = await page.locator(".pixel-profile-heading > span").first().boundingBox();
  const rankBox = await page.locator(".pixel-profile-heading > span").last().boundingBox();
  expect(nameBox).not.toBeNull(); expect(rankBox).not.toBeNull();
  expect(rankBox!.x >= nameBox!.x + nameBox!.width || rankBox!.y >= nameBox!.y + nameBox!.height).toBe(true);
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Continue Adventure", exact: true }).click();
  await expect(page.getByTestId("combat-canvas")).toBeVisible();
  await noOverflow(page);
  const pad = await page.getByTestId("movement-pad").boundingBox();
  const fire = await page.getByRole("button", { name: "Fire", exact: true }).boundingBox();
  expect(Math.abs((pad!.y + pad!.height / 2) - (fire!.y + fire!.height / 2))).toBeLessThan(3);
});
