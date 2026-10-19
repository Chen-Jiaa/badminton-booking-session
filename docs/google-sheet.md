# Google Sheet finance log

When an admin **confirms a top-up** or **marks a withdrawal paid**, the app appends a
row to a Google Sheet so the club has a running record outside the app.

- App side: `src/lib/google-sheet.ts`, called from `confirmTopUpFn`
  (`src/features/admin/server.ts`) and the withdrawal confirm handler
  (`src/features/withdrawal/server.ts`).
- If `GOOGLE_SHEET_WEBHOOK_URL` is unset, syncing is skipped (local/dev).
- If it is set and the Sheet can't be reached (or takes >10s), the approval is
  **not** applied and the admin sees an error toast: the Sheet never silently
  falls behind the app.
- Rejections, manual balance adjustments, session charges and expenses are not
  synced.

## Setup (one-time, ~5 minutes)

1. Create a Google Sheet (any name). Tabs are created automatically.
2. **Extensions → Apps Script**, replace the contents of `Code.gs` with the script
   below, and save.
3. **Deploy → New deployment → ⚙ → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Authorise when prompted.
4. Copy the **Web app URL** (ends in `/exec`) and set it as
   `GOOGLE_SHEET_WEBHOOK_URL` in Vercel (Production) and redeploy. Optionally add it
   to `.env` locally, but note that local approvals would then write to the real Sheet.

If you edit the script later, use **Deploy → Manage deployments → Edit → New
version**. Changes aren't live until you do, and the URL stays the same.

The URL is effectively a password: anyone who has it can append rows. Keep it in
env vars only.

## Apps Script

```js
const TABS = {
  TOPUP: {
    name: "Top-ups",
    headers: [
      "Confirmed at (MYT)",
      "Member",
      "Email",
      "Amount (RM)",
      "Balance after (RM)",
      "Confirmed by",
      "Request ID",
    ],
    row: (d) => [
      d.memberName,
      d.memberEmail,
      Number(d.amount),
      Number(d.balanceAfter),
      d.confirmedBy,
      d.requestId,
    ],
  },
  WITHDRAWAL: {
    name: "Withdrawals",
    headers: [
      "Paid at (MYT)",
      "Member",
      "Email",
      "Amount (RM)",
      "Balance after (RM)",
      "Method",
      "Paid by",
      "Request ID",
    ],
    row: (d) => [
      d.memberName,
      d.memberEmail,
      Number(d.amount),
      Number(d.balanceAfter),
      d.paymentMethod,
      d.confirmedBy,
      d.requestId,
    ],
  },
};

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const tab = TABS[data.kind];
  if (!tab) return ContentService.createTextOutput("unknown kind");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(tab.name);
    if (!sheet) {
      sheet = ss.insertSheet(tab.name);
      sheet.appendRow(tab.headers);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, tab.headers.length).setFontWeight("bold");
    }

    // An approval that's retried after a failure must not add a second row.
    const ids = sheet.getRange(1, tab.headers.length, sheet.getLastRow(), 1);
    if (ids.createTextFinder(data.requestId).matchEntireCell(true).findNext()) {
      return ContentService.createTextOutput("duplicate");
    }

    const when = Utilities.formatDate(
      new Date(data.confirmedAt),
      "Asia/Kuala_Lumpur",
      "yyyy-MM-dd HH:mm",
    );
    // Member names are user-controlled; stop "=..." being run as a formula.
    const safe = (v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v);
    sheet.appendRow([when, ...tab.row(data).map(safe)]);
    return ContentService.createTextOutput("ok");
  } finally {
    lock.releaseLock();
  }
}
```
