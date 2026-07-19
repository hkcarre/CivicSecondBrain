/**
 * Playwright config for the e2e smoke suite (e2e/*.spec.ts).
 *
 * Runs a production build + server (`npm run build && npm start`) with only
 * safe, non-secret env vars — the smoke tests must pass WITHOUT an AI key.
 * Locally, an already-running server on the same port is reused instead.
 *
 * Note: this file and e2e/ are excluded from tsconfig.json so that
 * `tsc --noEmit` and `next build` don't require @playwright/test types;
 * Playwright compiles its own test files.
 */

import { defineConfig, devices } from "@playwright/test";

const PORT = process.env.PORT ?? "3000";
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run build && npm start",
    url: `${BASE_URL}/api/health/live`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000, // build + boot
    env: {
      // Safe, non-secret values only. No ANTHROPIC_API_KEY — the smoke
      // suite never exercises AI-dependent paths.
      WIKI_PATH: "./wiki",
      RAW_SOURCES_PATH: "./raw-sources",
      // Set so the /admin auth-gate smoke test deterministically redirects
      // to the login page. Dummy value; never a real secret.
      ADMIN_PASSWORD: "e2e-smoke-admin",
      NEXT_PUBLIC_APP_NAME: "CivicSecondBrain",
      NEXT_PUBLIC_CITY_NAME: "Schertz",
      NEXT_PUBLIC_CITY_STATE: "TX",
    },
  },
});
