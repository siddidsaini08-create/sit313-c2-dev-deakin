# SIT313 – C2: DEV@Deakin Deployment

This repository contains the DEV@Deakin React application prepared for C2 deployment. It keeps the existing portfolio homepage, gallery, authentication, Google sign-in support, post page, contact/newsletter UI, and the subscription demonstration pages from the supplied D1 application.

## C2 deployment

1. Create a new GitLab project named `sit313-c2-dev-deakin` and upload this project. Do not upload `.env`, `serviceAccountKey.json`, `node_modules`, or `dist`.
2. Invite `sunilsoft9x` to the GitLab project with at least Reporter access.
3. In Netlify, choose **Add new site → Import an existing project**, select this GitLab repository, then use:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Add the values from `.env.example` to Netlify's environment variables. These must be the Firebase web-app values only. Never upload a Firebase Admin service-account key to Netlify.
5. Deploy, copy the live URL, and add it to the report and resubmission.

`netlify.toml` includes an SPA redirect, so direct links such as `/login`, `/register`, `/pricing`, and `/posts` open correctly after deployment.

## Deployment testing record

Perform these checks on the deployed Netlify URL and record only the results you personally observe:

| Check | Expected result |
| --- | --- |
| Home page | Header, portfolio sections, images, and footer load. |
| Navigation | Section links, login, register, pricing, and post pages open. |
| Mobile view | Navigation and page content remain usable. |
| Email/password registration | A Firebase user and Free plan profile are created. |
| Login and refresh | The authenticated session remains active after refresh. |
| Google sign-in | Sign-in works if the Netlify domain has been added to Firebase Authentication's authorised domains. |
| Posts | A signed-in user can publish a post and it appears in Firestore. |
| Pricing demo | Form validation works. The server-backed upgrade requires the API to be deployed separately. |

## Important hosting note

The React app can be hosted on Netlify. The included `server.js` is an Express server for newsletter and protected upgrade actions; it does not run as a normal Netlify static deployment. Those actions need a separate secure backend deployment and private server credentials. Do not claim those actions are live until you have deployed and tested that backend.

## Local setup

1. Copy `.env.example` to `.env` and enter your Firebase web configuration.
2. Run `npm install`.
3. Run `npm run dev`.
4. Run `npm test` for the local payment-input validation tests.

The required Firestore rules are in `firestore.rules`. Publish them in the Firebase console before testing registration, posts, or subscription data.

---

## Original D1 implementation notes

The remaining notes describe the supplied application features and backend setup.

## Files added/changed

| File | Purpose |
| --- | --- |
| `src/pages/Home.jsx`, `src/index.css`, `public/images/` | **Unchanged from P5** |
| `src/pages/Login.jsx`, `src/pages/Register.jsx` | P5 forms retained; Free plan for new profiles; pricing redirect |
| `src/context/AuthContext.jsx` | Session + Firestore subscription state using `onAuthStateChanged` and `onSnapshot` |
| `src/pages/Pricing.jsx`, `src/d1.css` | Free/Paid plans, responsive design and demo checkout |
| `src/utils/demoPayment.js` | In-browser test-card form validation |
| `src/pages/Posts.jsx` | Firestore-backed Post page for saved-post screenshots |
| `src/components/Navbar.jsx`, `src/App.jsx`, `src/main.jsx` | Add route, links, badge and shared auth provider |
| `server.js` | Original P5 routes unchanged; authenticated `/api/upgrade` added |
| `firestore.rules` | Protect plan upgrades; user and post collection rules |
| `tests/demoPayment.test.js` | Node built-in tests for demo form input |

## Install and run

**Prerequisites:** Node.js 20.19+ / 22.12+, your working P5 Firebase project and (for newsletter testing) your P5 Resend credentials.

1. Open the `Task-D1` directory in VS Code (the one containing `package.json`).
2. Run `npm install`. **Do not run `npm ci` first**: P5's original package-lock is included to preserve the original files and adding `firebase-admin` requires npm to update the lockfile. After the install, commit the updated `package-lock.json`.
3. Copy `.env.example` to `.env`. Paste your actual working **P5** Vite Firebase settings and backend Resend settings. `.env` is ignored by Git and must stay private.
4. In the **same Firebase project** open Firebase Console → Build → Firestore Database → Rules, paste `firestore.rules` and **Publish**. This is essential to both user profile updates and saved posts. Confirm Email/Password and (if used) Google sign-in are enabled in Firebase Authentication.
5. Set up **backend-only Firebase Admin** to verify logged-in users and securely update Paid status:
   - Firebase Console → Project settings → Service accounts → Generate new private key.
   - Save the JSON locally as `serviceAccountKey.json` in the D1 root, and set `FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json` in `.env`.
   - **Never commit or share this JSON file.** `.gitignore` excludes it. If leaked, revoke/rotate it.
6. Open **two VS Code terminals** in the same folder:
   - Terminal A: `npm run server` (Express port 5000)
   - Terminal B: `npm run dev` (React/Vite)
7. Open the Vite URL (usually `http://localhost:5173`). Use **Pricing** in the top navigation.

### Demo payment input — TEST ONLY

The upgrade form is a **simulation**. There is no payment gateway, no real charges and no card details sent/stored. **Use only**:

- Card name: `Demo User`
- Test number: `4242 4242 4242 4242`
- Future expiry (MM/YY), e.g. `12/29` while in 2026
- Demo CVV: `123`

The browser checks the test input; the `/api/upgrade` request only sends the name in the body plus the Firebase ID token in the `Authorization` header. The backend verifies the token and performs a Firestore Admin SDK transaction on `users/{uid}`. This is an **educational demonstration**, not a real payment process. A real financial application must verify payment success through a payment service/provider before unlocking Paid access.

### Session management

Firebase Auth (explicitly allowed under the task's Optional Technologies) handles session persistence and token refreshing rather than hand-rolling a password-hash/JWT server. The React AuthContext uses `onAuthStateChanged` and a Firestore live snapshot listener. Firebase supplies `user.getIdToken()` for authenticated Express requests. It is not necessary to manually store an app-issued JWT in `localStorage()` when using Firebase Authentication. Refresh the page to confirm the session remains active.

### Saved users and posts

- **User registration** creates a `users/{uid}` document with `plan: 'Free'`.
- **Existing P5 users** without a plan get a one-time backfill to `plan: 'Free'` when they sign in, subject to the D1 security rules.
- **Upgrade** changes the document to `plan: 'Paid'` on the backend. The UI badge updates live and the Upgrade button becomes disabled.
- **Post** button opens the new Posts page. Log in, publish a sample educational post, then see that document in the Firestore `posts` collection. This supplies real screenshots rather than pretending data exists.
- All premium feature limits and ₹499 pricing shown on the Pricing page are illustrative. The brief specifically says actual paid feature limits **do not** need implementation.

## Before reporting or submitting: practical checks

1. Guest opens Pricing → must **log in** before upgrade.
2. New email/password user registers → `users/{uid}` appears in Firestore with `Free`.
3. Log in and refresh → still logged in, plan badge stays visible.
4. Login with Google (if enabled) → Firestore user document exists.
5. Bad test payment name, number, expiry or CVV → validation message; no plan changes.
6. Test details → successful upgrade; Firestore user plan updates to `Paid`.
7. Paid user → upgrade is disabled; refresh and log in again → stays Paid.
8. Log out → guest state; upgrade requires login again.
9. Log in, click Post, publish and inspect `posts` documents in Firestore.
10. Regression: homepage, about, projects, all gallery images, contact, newsletter, original P5 auth all still work. For the newsletter use the Resend-tested email address from P5. Confirm actual provider response in the Express terminal.
11. Security: Client-side Firestore writes setting `plan: 'Paid'` must be blocked. Confirm the browser's upgrade network request never contains number/expiry/CVV.

Run local input tests with `npm test`. This is **not** a replacement for the manual Firebase/Resend checks, which require the user's private credentials.

## GitLab and assessment hand-in

- Task sheet explicitly says **new GitLab project named `Task D1` with Internal visibility**, if your provided GitLab instance supports it. Confirm with your tutor if your GitLab account doesn't offer Internal.
- `.env`, `serviceAccountKey.json`, `node_modules` and `dist` must **NOT** be in GitLab. Check `git status` before committing.
- Use meaningful commits, e.g. `Extend P5 with D1 subscription and secure Firestore upgrade`.
- Report needs: DEV@Deakin screenshots (Pricing, modal, Paid), **Firestore saved users** screenshot, **Firestore saved posts** screenshot, GitLab URL and a Panopto link.
- Video duration: **3–6 minutes**; walk through login, refresh session, Free/Paid plans, validation, upgrade, Firestore persistence and code rationale.
- Upload the report to OnTrack and respond to feedback.

**Important:** This archive does not contain a working `.env` or backend service-account key (those were not in the P5 ZIP). You need to configure them and run the test list before claiming the cloud features are verified. The original P5 folder has not been edited.
