import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

function getFirebaseAdmin() {
  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.VITE_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      }),
    });
  }
  return getMessaging();
}

export async function sendPushNotification(
  token: string,
  title: string,
  body: string,
  data?: Record<string, string>,
) {
  const messaging = getFirebaseAdmin();

  try {
    await messaging.send({
      token,
      notification: { title, body },
      data,
      webpush: {
        fcmOptions: {
          link: "/",
        },
      },
    });
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}

export async function sendLowBalanceNotification(token: string, balance: string) {
  await sendPushNotification(
    token,
    "Low Balance Alert",
    `Your balance is low (RM ${balance}). Please top up soon.`,
    { type: "LOW_BALANCE" },
  );
}

export async function sendTopUpConfirmedNotification(token: string, amount: string) {
  await sendPushNotification(
    token,
    "Top-up Confirmed",
    `Your top-up of RM ${amount} has been confirmed.`,
    { type: "TOPUP_CONFIRMED" },
  );
}

export async function sendTopUpRejectedNotification(token: string, amount: string, reason: string) {
  await sendPushNotification(
    token,
    "Top-up Rejected",
    `Your top-up of RM ${amount} was rejected: ${reason}`,
    { type: "TOPUP_REJECTED" },
  );
}
