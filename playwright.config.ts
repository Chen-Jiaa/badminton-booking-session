import { defineConfig } from "@playwright/test";
import { BASE_URL, E2E_AUTH_SECRET, PORT, TEST_DATABASE_URL } from "./e2e/env";
import { CONTEXT_OPTIONS } from "./e2e/device";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Tests share one seeded database, so run them one at a time
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    trace: "retain-on-failure",
  },
  projects: [{ name: "mobile", use: CONTEXT_OPTIONS }],
  webServer: {
    command: `pnpm exec vite dev --port ${PORT} --strictPort`,
    url: BASE_URL,
    // Never reuse a server you started by hand: it would be talking to the live DB
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      E2E_AUTH_SECRET,
      GOOGLE_SHEET_WEBHOOK_URL: "",
      // Same clock as the browser and the club, so server-rendered dates match
      TZ: "Asia/Kuala_Lumpur",
    },
  },
});
