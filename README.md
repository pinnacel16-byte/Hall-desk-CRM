# Hall Desk – Celebration Hall CRM

Booking calendar, leads with follow-ups, team to-dos, attendance and payments.
Runs on Firebase (database + logins, free tier) and GitHub Pages (hosting, free).

## Roles

| Role  | Sees |
|-------|------|
| admin | Everything: calendar editing, leads, payments, team to-dos, everyone's attendance, exports |
| team  | Calendar, their own to-dos, their own attendance (clock in/out) |

## One-time setup (about 20 minutes)

### 1. Create the Firebase project
1. Go to https://console.firebase.google.com and click **Create a project** (Google Analytics not needed).
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable → Save.**
3. Still in Authentication → **Settings → User actions**: untick **Enable create (sign-up)** so only you can create accounts.
4. **Build → Firestore Database → Create database** → choose a location near you (e.g. `asia-south1` Mumbai) → start in **production mode**.
5. Firestore → **Rules** tab: delete what's there, paste the whole of `firestore.rules` from this repo, click **Publish**.

### 2. Connect the app
1. **Project settings (gear icon) → General → Your apps → Web (`</>`)**, give it a name, register (no hosting needed).
2. Copy the values from the `firebaseConfig` it shows into `config.js` in this repo and commit.

### 3. Add your staff
For each person (including yourself):
1. **Authentication → Users → Add user**: their email + a starting password. Give them the password; they can change it with "Forgot password?" on the sign-in page.
2. **Firestore Database → Data → Start collection** `staff` (first time only) → **Add document**:
   - Document ID: their email, **all lowercase** (e.g. `priya@gmail.com`)
   - Field `name` (string): their name as shown in the app
   - Field `role` (string): `admin` or `team`

To remove someone: delete their `staff` document (they lose access immediately) and their Authentication user.

### 4. Put it online (GitHub Pages)
1. In this GitHub repo: **Settings → Pages → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save.**
2. After a minute the site is at `https://<your-github-username>.github.io/<repo-name>/`.
3. Firebase → Authentication → Settings → **Authorized domains → Add domain** → `<your-github-username>.github.io`.

GitHub Pages needs a **public** repo on a free GitHub plan. That is safe here: the code and
`config.js` contain no secrets, and all data stays behind the login and the rules.
If you'd rather keep the repo private, use Firebase Hosting or Netlify instead (both free).

## Backups
Admins: **Leads → Export leads** and **Payments → Export bookings** download CSV files that open in Excel. Do this regularly.

## Moving data from the claude.ai version
The claude.ai artifact and this app have separate databases. Pick one as the "real" one.
To move leads across, export them from the claude.ai version and ask Claude to import them.
