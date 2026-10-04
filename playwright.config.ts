import { defineConfig } from "@playwright/test";

// Browser end-to-end tests against a production build and a local Supabase (`supabase start`).
// Run: npm run build && npm run test:e2e   (set PLAYWRIGHT_BASE_URL to test an already running server)
// Two app servers run from the same build: one with place search switched on (pointing at a local stand-in for the
// Geoapify API) and one without a key, to check the manual fallback.
const port = 3100;
const noKeyPort = 3101;
const external = !!process.env.PLAYWRIGHT_BASE_URL;
const server = (p: number, env: Record<string, string>) => ({
  command: `npx next start -p ${p}`,
  url: `http://localhost:${p}/api/health`,
  reuseExistingServer: !process.env.CI,
  timeout: 60_000,
  env: { ...process.env, ...env } as Record<string, string>,
});

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "app", testIgnore: /nokey/, use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}` } },
    { name: "nokey", testMatch: /nokey/, use: { baseURL: `http://localhost:${noKeyPort}` } },
  ],
  webServer: external
    ? undefined
    : [
        { command: "node tests/e2e/geoapify-stub.mjs", url: "http://127.0.0.1:3199/v1/geocode/search?apiKey=e2e-key&text=ping", reuseExistingServer: !process.env.CI, timeout: 15_000 },
        server(port, { GEOAPIFY_API_KEY: "e2e-key", PLACES_API_BASE: "http://127.0.0.1:3199" }),
        server(noKeyPort, { GEOAPIFY_API_KEY: "" }),
      ],
});
