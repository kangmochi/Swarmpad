import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke tests against the production build, served by `vite preview`.
 *
 * They check that the app boots and that each route renders its shell. Nothing
 * here waits on chain data: the public RPC rate limits, and a test that depends
 * on a node answer would fail for reasons that have nothing to do with the app.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
