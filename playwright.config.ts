import { defineConfig } from "@playwright/test";

// Browser end-to-end tests against a production build and a local Supabase (`supabase start`).
// Run: npm run build && npm run test:e2e   (set PLAYWRIGHT_BASE_URL to test an already running server)
const port = 3100;
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`, trace: "retain-on-failure" },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : { command: `npx next start -p ${port}`, url: `http://localhost:${port}/api/health`, reuseExistingServer: !process.env.CI, timeout: 60_000 },
});
