/**
 * Google Sheets sync via an Apps Script Web App.
 *
 * Set up (one-time, no Google Cloud project needed):
 *  1. Open the target Sheet → Extensions → Apps Script.
 *  2. Paste a `doPost(e)` that appends `JSON.parse(e.postData.contents)` as a row
 *     (branch on the `kind` field to route TOPUP vs WITHDRAWAL to different tabs).
 *  3. Deploy → New deployment → Web app → Execute as "Me", access "Anyone".
 *  4. Copy the /exec URL into GOOGLE_SHEET_WEBHOOK_URL.
 */

/** Thrown when a configured webhook rejects or is unreachable. */
export class SheetSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetSyncError";
  }
}

export type TopUpSheetRow = {
  /** ISO timestamp the top-up was confirmed. */
  confirmedAt: string;
  requestId: string;
  memberName: string;
  memberEmail: string;
  amount: string;
  balanceAfter: string;
  confirmedBy: string;
};

export type WithdrawalSheetRow = {
  /** ISO timestamp the withdrawal was marked paid. */
  confirmedAt: string;
  requestId: string;
  memberName: string;
  memberEmail: string;
  amount: string;
  balanceAfter: string;
  paymentMethod: string;
  confirmedBy: string;
};

// The withdrawal payout awaits this *inside* its DB transaction, so a hung Apps
// Script endpoint would otherwise hold the row locks open for undici's ~300s
// default. Bound the wait so a stalled sync fails fast and rolls back cleanly.
const SHEET_TIMEOUT_MS = 10_000;

/**
 * POSTs a row to the finance Sheet.
 *
 * No-op when GOOGLE_SHEET_WEBHOOK_URL is unset (local/dev). When it *is* set,
 * any failure throws SheetSyncError so the caller can roll back and surface it.
 */
async function postToSheet(payload: Record<string, unknown>): Promise<void> {
  const url = process.env.GOOGLE_SHEET_WEBHOOK_URL;
  if (!url) return;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(SHEET_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    throw new SheetSyncError(
      timedOut
        ? "Google Sheet did not respond in time"
        : error instanceof Error
          ? error.message
          : "Could not reach Google Sheet",
    );
  }

  if (!response.ok) {
    throw new SheetSyncError(`Google Sheet responded with ${response.status}`);
  }
}

/** Appends a confirmed top-up to the finance Sheet. */
export function appendTopUpToSheet(row: TopUpSheetRow): Promise<void> {
  return postToSheet({ kind: "TOPUP", ...row });
}

/** Appends a paid-out withdrawal to the finance Sheet. */
export function appendWithdrawalToSheet(row: WithdrawalSheetRow): Promise<void> {
  return postToSheet({ kind: "WITHDRAWAL", ...row });
}
