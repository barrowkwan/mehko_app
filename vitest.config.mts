import { configDefaults, defineConfig } from "vitest/config";

// Playwright specs (tests/e2e) run with `npm run test:e2e`, not here.
export default defineConfig({ test: { exclude: [...configDefaults.exclude, "tests/e2e/**"] } });
