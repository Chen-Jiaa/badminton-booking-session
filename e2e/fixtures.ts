import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";
import { accessTokenFor, waitForHydration } from "./browser";
import { BASE_URL } from "./env";
import { CONTEXT_OPTIONS } from "./device";
import { truncateTestDb } from "./db";
import { seed, type SeedUser } from "./seed";

/** Keeps tests off the network: the session page embeds a Google Map. */
async function blockExternal(context: BrowserContext) {
  await context.route(
    (url) => url.origin !== BASE_URL,
    (route) => route.abort(),
  );
}

/** Makes `goto` and `reload` wait for hydration, so tests can click straight away. */
function hydrateOnNavigate(page: Page) {
  const { goto, reload } = page;
  page.goto = async (...args) => {
    const response = await goto.apply(page, args);
    await waitForHydration(page);
    return response;
  };
  page.reload = async (...args) => {
    const response = await reload.apply(page, args);
    await waitForHydration(page);
    return response;
  };
  return page;
}

export const test = base.extend<{
  /**
   * Signs in as a seeded user and returns their page. The first call uses the
   * test's `page`; each further call opens a separate browser for another user,
   * so a test can play both sides (player asks, admin approves).
   */
  loginAs: (user: SeedUser) => Promise<Page>;
  freshData: void;
}>({
  // Every test starts from the same seed, whatever the previous one changed
  freshData: [
    // Playwright needs the `{}` to see this fixture takes no dependencies
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await truncateTestDb();
      await seed();
      await use();
    },
    { auto: true },
  ],

  context: async ({ context }, use) => {
    await blockExternal(context);
    await use(context);
  },

  page: async ({ page }, use) => {
    await use(hydrateOnNavigate(page));
  },

  loginAs: async ({ page, browser }, use) => {
    const extra: BrowserContext[] = [];
    let pageTaken = false;

    await use(async (user) => {
      let target = page;
      if (pageTaken) {
        const context = await browser.newContext(CONTEXT_OPTIONS);
        await blockExternal(context);
        extra.push(context);
        target = hydrateOnNavigate(await context.newPage());
      }
      pageTaken = true;
      await target
        .context()
        .addCookies([
          { name: "sb-access-token", value: await accessTokenFor(user), url: BASE_URL },
        ]);
      return target;
    });

    await Promise.all(extra.map((c) => c.close()));
  },
});

/** The balance on the wallet page, e.g. `RM 50.00`. */
export async function expectBalance(page: Page, amount: number) {
  await page.goto("/wallet");
  await expect(
    page.getByText("Current Balance").locator("xpath=ancestor::*[contains(@class,'bg-card')][1]"),
  ).toContainText(`RM ${amount.toFixed(2)}`);
}

export { expect, type Page };
