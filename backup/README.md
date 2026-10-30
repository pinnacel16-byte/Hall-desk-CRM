# Hall Desk → Google Sheet backup

Every hour, this copies **Leads, Bookings, Payments and Attendance** from Hall Desk into a Google Sheet.
Every night it also saves a **dated copy** of the sheet in Google Drive (folder *Hall Desk daily backups*,
last 30 days kept), so a mistake in the app (say, a deleted lead) can still be found in an older copy.

It only reads Hall Desk. Editing the sheet never changes the app.

## Setup (about 5 minutes, once)

Do this signed in to Google as **pinnacel16@gmail.com**, the account that owns the Hall Desk Firebase project.

1. Go to https://sheets.new to create a new Google Sheet. Name it **Hall Desk backup**.
2. In the sheet: **Extensions → Apps Script**. A code editor opens.
3. Click the **gear icon (Project Settings)** on the left → tick **"Show 'appsscript.json' manifest file in editor"**.
4. Click the **`<>` (Editor)** icon on the left.
   - Click **appsscript.json** → select everything → paste the contents of [`appsscript.json`](appsscript.json).
   - Click **Code.gs** → select everything → paste the contents of [`Code.gs`](Code.gs).
   - Click the **💾 Save** icon.
5. At the top, in the function box next to **Run**, pick **setup** → click **Run**.
6. Google asks for permission:
   **Review permissions** → choose **pinnacel16@gmail.com** → *"Google hasn't verified this app"* →
   **Advanced** → **Go to Hall Desk backup (unsafe)** → **Allow**.
   (It says "unverified" because it's your own script, not a published app.)
7. Go back to the sheet. Tabs **Backup info, Leads, Bookings, Payments, Attendance** appear with your data,
   and a **Hall Desk** menu appears (reload the sheet if not).

That's it. It now updates every hour by itself.

## Using it
- **Backup info** tab: when the last backup ran, and whether it worked.
- **Hall Desk → Back up now**: copy immediately instead of waiting for the hour.
- Older days: Google Drive → *Hall Desk daily backups* → *Hall Desk backup 2026-10-30* etc.
- Dates show as dd/mm/yyyy and amounts as ₹1,50,000. You can sort and filter freely; the next backup rewrites the tabs.

## If something goes wrong
- **Backup info says FAILED … 403 / PERMISSION_DENIED:** the sheet isn't in the Google account that owns the
  Firebase project. Check you're signed in as pinnacel16@gmail.com and that this account is listed under
  Firebase console → Project settings → Users and permissions.
- **FAILED … API has not been used / disabled:** open the link in the message and click **Enable**, then
  **Hall Desk → Back up now**.
- **No Hall Desk menu:** reload the sheet.
- To stop the backups: Apps Script → **Triggers** (alarm-clock icon) → delete them.
