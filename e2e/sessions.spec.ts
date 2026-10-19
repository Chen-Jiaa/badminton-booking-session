import { expect, expectBalance, test } from "./fixtures";
import { DEPOSIT, LOU_BALANCE, SEED_SESSIONS, START_BALANCE } from "./seed";

test("player joins a session, then leaves and gets the deposit back", async ({ loginAs }) => {
  const page = await loginAs("player");
  await page.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await expect(page.getByText("· 1/8")).toBeVisible();

  await page.getByRole("button", { name: "Join Game" }).click();
  await expect(page.getByRole("button", { name: "Leave Game" })).toBeVisible();
  await expect(page.getByText("· 2/8")).toBeVisible();
  await expect(page.getByText("Pat Player")).toBeVisible();
  await expectBalance(page, START_BALANCE - DEPOSIT);

  await page.goto(`/sessions/${SEED_SESSIONS.upcoming}`);
  await page.getByRole("button", { name: "Leave Game" }).click();
  await expect(page.getByRole("dialog", { name: "Leave game?" })).toBeVisible();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByRole("button", { name: "Join Game" })).toBeVisible();
  await expect(page.getByText("· 1/8")).toBeVisible();

  await expectBalance(page, START_BALANCE);
  await expect(page.getByText("Session Deposit Refund")).toBeVisible();
});

test("player without enough for the deposit is asked to top up", async ({ loginAs }) => {
  const page = await loginAs("lou");
  await page.goto(`/sessions/${SEED_SESSIONS.upcoming}`);

  const shortfall = (DEPOSIT - LOU_BALANCE).toFixed(2);
  await page.getByRole("button", { name: `Top up RM ${shortfall} to join` }).click();
  await expect(page.getByRole("dialog", { name: "Request Top Up" })).toBeVisible();
  await expect(page.getByLabel("Amount (RM)")).toHaveValue(String(DEPOSIT - LOU_BALANCE));

  // Reopening refills the shortfall rather than keeping whatever was typed last time
  await page.getByLabel("Amount (RM)").fill("99");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Request Top Up" })).toBeHidden();
  await page.getByRole("button", { name: `Top up RM ${shortfall} to join` }).click();
  await expect(page.getByLabel("Amount (RM)")).toHaveValue(String(DEPOSIT - LOU_BALANCE));
});

test("waitlisted player moves in when someone leaves", async ({ loginAs }) => {
  const player = await loginAs("player");
  await player.goto(`/sessions/${SEED_SESSIONS.full}`);
  await expect(player.getByText("· 2/2")).toBeVisible();

  await player.getByRole("button", { name: "Session full · Join waitlist" }).click();
  await expect(player.getByText("You're on the waitlist")).toBeVisible();
  await expect(player.getByText("On the waitlist · #1 in line")).toBeVisible();
  // Waitlisting doesn't take the deposit yet
  await expectBalance(player, START_BALANCE);

  const dee = await loginAs("dee");
  await dee.goto(`/sessions/${SEED_SESSIONS.full}`);
  await dee.getByRole("button", { name: "Leave Game" }).click();
  await dee.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(dee.getByRole("button", { name: "Session full · Join waitlist" })).toBeVisible();

  await player.goto(`/sessions/${SEED_SESSIONS.full}`);
  await expect(player.getByRole("button", { name: "Leave Game" })).toBeVisible();
  await expect(player.getByText("Pat Player")).toBeVisible();
  await expectBalance(player, START_BALANCE - DEPOSIT);
});

test("late cancellation approved: refunded, and the waitlist moves in", async ({ loginAs }) => {
  const ben = await loginAs("ben");
  await ben.goto(`/sessions/${SEED_SESSIONS.late}`);
  await ben.getByRole("button", { name: "Leave Game" }).click();
  await expect(ben.getByRole("dialog", { name: "Late cancellation" })).toBeVisible();
  await ben.getByRole("button", { name: "Request to leave" }).click();
  await expect(ben.getByText("Cancellation pending approval")).toBeVisible();

  const admin = await loginAs("admin");
  await admin.goto(`/sessions/${SEED_SESSIONS.late}`);
  await expect(admin.getByText("Late cancellations")).toBeVisible();
  await admin.getByRole("button", { name: "Approve" }).click();
  const dialog = admin.getByRole("dialog", { name: "Approve Ben Baker’s cancellation?" });
  // The first affordable waitlister is picked by default
  await expect(dialog.getByRole("radio", { name: /Cai Chen/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await dialog.getByRole("button", { name: "Approve" }).click();
  await expect(admin.getByText("Ben Baker refunded · Cai Chen moved in")).toBeVisible();

  await ben.goto(`/sessions/${SEED_SESSIONS.late}`);
  // Off the list (only Cai is in now), free to join again
  await expect(ben.getByRole("button", { name: "Join Game" })).toBeVisible();
  await expect(ben.getByText("· 1/4")).toBeVisible();
  await expectBalance(ben, START_BALANCE + DEPOSIT);

  const cai = await loginAs("cai");
  await cai.goto(`/sessions/${SEED_SESSIONS.late}`);
  await expect(cai.getByRole("button", { name: "Leave Game" })).toBeVisible();
  await expectBalance(cai, START_BALANCE - DEPOSIT);
});

test("late cancellation rejected: player stays on the list", async ({ loginAs }) => {
  const ben = await loginAs("ben");
  await ben.goto(`/sessions/${SEED_SESSIONS.late}`);
  await ben.getByRole("button", { name: "Leave Game" }).click();
  await ben.getByRole("button", { name: "Request to leave" }).click();
  await expect(ben.getByText("Cancellation pending approval")).toBeVisible();

  const admin = await loginAs("admin");
  await admin.goto(`/sessions/${SEED_SESSIONS.late}`);
  await admin.getByRole("button", { name: "Reject" }).click();
  await admin
    .getByRole("dialog", { name: "Reject Ben Baker’s cancellation?" })
    .getByRole("button", { name: "Reject" })
    .click();
  await expect(admin.getByText("Ben Baker stays on and will be charged")).toBeVisible();

  await ben.reload();
  await expect(ben.getByText("Late cancellation declined")).toBeVisible();
  await expectBalance(ben, START_BALANCE);
});
