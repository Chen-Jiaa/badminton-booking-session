import { devices, type BrowserContextOptions } from "@playwright/test";
import { BASE_URL } from "./env";

/**
 * Browser settings for every test, including the extra contexts `loginAs` opens
 * for a second user. On Malaysia time, like the club, so dates match the server.
 */
export const CONTEXT_OPTIONS = {
  ...devices["Pixel 7"],
  baseURL: BASE_URL,
  timezoneId: "Asia/Kuala_Lumpur",
  // Skips the entrance animations so assertions don't wait on them
  reducedMotion: "reduce",
} satisfies BrowserContextOptions;
