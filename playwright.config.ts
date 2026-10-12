import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3100";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 40_000,
  // Allow cold WASM startup/image decoding on single-CPU CI/preview machines.
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    browserName: "chromium",
    viewport: { width: 1280, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    } : {},
  },
  // Set PLAYWRIGHT_BASE_URL to test an already running preview. Otherwise stop
  // your dev server first: Next's dev build lock permits one server per checkout.
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "npm run dev -- --port 3100",
    url: `${baseURL}/api/health`,
    reuseExistingServer: false,
    timeout: 90_000,
    env: { DATABASE_URL: "", POSTGRES_URL: "", PGLITE_DATA_DIR: ".cache/e2e-database", VERCEL: "", AWS_LAMBDA_FUNCTION_NAME: "" },
  },
});
