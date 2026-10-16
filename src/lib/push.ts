import webpush from "web-push";

let configured = false;

function getWebPush() {
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
      process.env.VAPID_PUBLIC_KEY ?? "",
      process.env.VAPID_PRIVATE_KEY ?? "",
    );
    configured = true;
  }
  return webpush;
}

/**
 * Sends one Web Push message. `subscription` is the JSON string produced by the
 * browser's PushManager (stored in users.fcmToken). Failures are swallowed so a
 * single dead or invalid subscription never breaks the calling request.
 */
export async function sendPushNotification(
  subscription: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  try {
    const parsed = JSON.parse(subscription) as webpush.PushSubscription;
    await getWebPush().sendNotification(parsed, JSON.stringify({ title, body, data }));
  } catch (error) {
    // 404/410 mean the subscription has expired or been revoked; other errors
    // are transient. Either way, don't fail the request that triggered this.
    console.error("Error sending push notification:", error);
  }
}

/**
 * Fans a notification out to a set of subscriptions (admins, or the players in a
 * match), one send per token. Sends run concurrently and failures are swallowed
 * per-token by sendPushNotification, so one dead subscription never blocks the others.
 */
export async function sendToTokens(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  await Promise.all(tokens.map((token) => sendPushNotification(token, title, body, data)));
}

export async function sendNewTopUpRequestNotification(
  tokens: string[],
  playerName: string,
  amount: string,
) {
  await sendToTokens(
    tokens,
    "New Top-up Request",
    `${playerName} requested a top-up of RM ${amount}.`,
    { type: "TOPUP_REQUESTED", link: "/admin/topups" },
  );
}

export async function sendNewWithdrawalRequestNotification(
  tokens: string[],
  playerName: string,
  amount: string,
) {
  await sendToTokens(
    tokens,
    "New Withdrawal Request",
    `${playerName} requested a withdrawal of RM ${amount}.`,
    { type: "WITHDRAWAL_REQUESTED", link: "/admin/topups" },
  );
}

export async function sendLowBalanceNotification(token: string, balance: string) {
  await sendPushNotification(
    token,
    "Low Balance Alert",
    `Your balance is low (RM ${balance}). Please top up soon.`,
    { type: "LOW_BALANCE", link: "/wallet" },
  );
}

export async function sendTopUpConfirmedNotification(token: string, amount: string) {
  await sendPushNotification(
    token,
    "Top-up Confirmed",
    `Your top-up of RM ${amount} has been confirmed.`,
    { type: "TOPUP_CONFIRMED", link: "/wallet" },
  );
}

export async function sendTopUpRejectedNotification(token: string, amount: string, reason: string) {
  await sendPushNotification(
    token,
    "Top-up Rejected",
    `Your top-up of RM ${amount} was rejected: ${reason}`,
    { type: "TOPUP_REJECTED", link: "/wallet" },
  );
}

export async function sendWithdrawalConfirmedNotification(token: string, amount: string) {
  await sendPushNotification(
    token,
    "Withdrawal Paid",
    `Your withdrawal of RM ${amount} has been paid out.`,
    { type: "WITHDRAWAL_CONFIRMED", link: "/wallet" },
  );
}

export async function sendWithdrawalRejectedNotification(
  token: string,
  amount: string,
  reason: string,
) {
  await sendPushNotification(
    token,
    "Withdrawal Rejected",
    `Your withdrawal of RM ${amount} was rejected: ${reason}`,
    { type: "WITHDRAWAL_REJECTED", link: "/wallet" },
  );
}

// ---- Matches ----------------------------------------------------------------
// `tokens` are the push subscriptions of the players who need to act.

export async function sendMatchInviteNotification(
  tokens: string[],
  recorderName: string,
  sessionId: string,
) {
  await sendToTokens(tokens, "Match invite", `${recorderName} invited you to a match. Accept?`, {
    type: "MATCH_INVITED",
    link: `/sessions/${sessionId}`,
  });
}

export async function sendMatchResultNotification(
  tokens: string[],
  recorderName: string,
  score: string,
  sessionId: string,
) {
  await sendToTokens(
    tokens,
    "Confirm your match",
    `${recorderName} recorded ${score}. Confirm or dispute it.`,
    { type: "MATCH_RESULT", link: `/sessions/${sessionId}` },
  );
}

export async function sendMatchDisputedNotification(
  tokens: string[],
  disputerName: string,
  score: string,
  sessionId: string,
) {
  await sendToTokens(
    tokens,
    "Score corrected",
    `${disputerName} says the score was ${score}. Confirm or dispute it.`,
    { type: "MATCH_DISPUTED", link: `/sessions/${sessionId}` },
  );
}

export async function sendMatchConfirmedNotification(
  tokens: string[],
  confirmerName: string,
  score: string,
  sessionId: string,
) {
  await sendToTokens(tokens, "Match confirmed", `${confirmerName} confirmed ${score}.`, {
    type: "MATCH_CONFIRMED",
    link: `/sessions/${sessionId}`,
  });
}
