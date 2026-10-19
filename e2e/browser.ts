// Shared by the Playwright fixtures and `scripts/shot.ts`: signing in as a seeded user
// and waiting for React to hydrate.
import type { Page } from "@playwright/test";
import { SignJWT } from "jose";
import { E2E_AUTH_SECRET } from "./env";
import { SEED_USERS, type SeedUser } from "./seed";

/** Mints the HS256 token `verifyAccessToken` accepts when E2E_AUTH_SECRET is set. */
export async function accessTokenFor(user: SeedUser) {
  const { id, email, name } = SEED_USERS[user];
  return new SignJWT({ email, user_metadata: { full_name: name } })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(id)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(E2E_AUTH_SECRET));
}

/**
 * Resolves once React has hydrated the page: clicks before that are lost, and the
 * dev server takes a while to load the app's modules.
 */
export async function waitForHydration(page: Page) {
  // No named functions inside: tsx (used by `pnpm shot`) wraps those in a `__name`
  // helper that doesn't exist in the browser
  await page.waitForFunction(() =>
    [document.body, ...Array.from(document.querySelectorAll("button, a, input"))].every((el) =>
      Object.keys(el).some((k) => k.startsWith("__reactProps$")),
    ),
  );
}
