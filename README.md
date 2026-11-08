# RE:FORM Art & Craft Club — Official Website

**RE:FORM — Reimagining Everything From Ordinary Materials.** A React + Vite website for showcasing artwork, managing teams, recruitment, events, notices, Waste to Best challenges, the Constitution, legacy, member profiles and a blog — with a permissioned admin panel.

## Stack (fixed)
React 18 + Vite + JavaScript, react-router-dom v6 (lazy routes), Tailwind CSS, Framer Motion, Firebase Auth + Firestore (Spark/free), Supabase Storage (free), react-hook-form + zod, DOMPurify, lucide-react, react-helmet-async, browser-image-compression. **No Cloud Functions, no Firebase Storage, no paid-plan services.**

## Demo mode (no keys needed)
With blank `.env` values the app runs on built-in seed demo data (`src/data/seed.js`: 12 artworks, 4 events, 4 notices, team members, 2 challenges, blog, legacy, recognitions). `npm run build` and `npm run preview` work without any keys. Admin sign-in is unavailable in demo mode; admin pages show demo data and writes are simulated (not persisted).

## Prerequisites
Node.js 18+ and npm. A Firebase project (Spark plan) and a Supabase project (Free plan) for live use. Firebase CLI (`npm i -g firebase-tools`) for deploy.

## Setup — Firebase (Spark)
1. Create a Firebase project (Spark plan, no billing). Enable **Authentication > Email/Password** and **Google** sign-in.
2. Create **Firestore Database** (production mode). Deploy rules + indexes: `firebase deploy --only firestore` (uses `firestore.rules` and `firestore.indexes.json`).
3. In Firebase Auth, add your hosting domain(s) under **Settings > Authorized domains**.
4. Create a web app; copy its config into `.env` (see `.env.example` — all values blank by default).
5. Optional but recommended: enable **App Check** with reCAPTCHA v3 (free) and set `VITE_RECAPTCHA_SITE_KEY` in `.env`. App Check is initialised in `src/config/firebase.js` (ReCaptchaV3Provider) only when that key is non-empty; with the key blank the app runs unchanged in demo mode.

## Setup — Supabase (Free plan)
See `supabase/SUPABASE_SETUP.md`. Summary: create a project, run `supabase/storage-policies.sql` in the SQL Editor. Two buckets: `reform-media` (admin content, 10 MB, image+PDF, `docs/` PDFs up to 10 MB) and `reform-submissions` (public uploads only, 5 MB, images only). Public read on both; anon insert only on `submissions/` and `w2b/` in `reform-submissions`; admin-only insert/update/delete elsewhere via the `reform_admin` JWT claim. Enable **Authentication > Third-party > Firebase** with your Firebase project ID, and put the URL + anon key + both bucket names in `.env` (`VITE_SUPABASE_BUCKET=reform-media`, `VITE_SUPABASE_SUBMISSIONS_BUCKET=reform-submissions`). **Never use the privileged Supabase service key in the frontend.** Admin Orphan Cleanup is at `/admin/orphans` (coordinator-only, `src/pages/admin/OrphanCleanup.jsx`): it lists files in `submissions/`/`w2b/` (and admin prefixes) not referenced by any Firestore document and lets the coordinator delete them with ConfirmDialog + audit log + toast; in demo mode it shows simulated rows.

## Fill `.env`
Copy `.env.example` to `.env` and fill the Firebase + Supabase values. Keep `.env` out of git (it is gitignored). No real keys are in this repo.

## Bootstrap the first coordinator
```bash
cd scripts && npm install
cp .env.example .env   # fill COORDINATOR_EMAIL / COORDINATOR_NAME
# place your Firebase service-account JSON as serviceAccountKey.json here — NEVER commit it
node bootstrap-coordinator.js
```
This creates/locates the user, writes `admins/{uid}` with role `coordinator` and all permissions, sets custom claims `{role:'authenticated', reform_admin:true, clubRole:'coordinator'}`, and prints a password-reset link to send to the coordinator. After any admin/permission change, run `node set-admin-claims.js` to sync claims. Admins are otherwise created by the Coordinator from the Users module / Firebase console — there is **no public admin sign-up**.

## Local dev / build / deploy
```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # vite build -> dist/ (no chunk-size warning; manualChunks in vite.config.js)
npm run preview
npm run sitemap    # regenerates public/sitemap.xml
npm run test:rules # Firestore rules tests — requires Java 21+ and a running emulator; see below
firebase deploy --only hosting   # after `firebase login` and setting the project in .firebaserc
```

## Enable App Check enforcement
App Check is initialised in `src/config/firebase.js` only when `VITE_RECAPTCHA_SITE_KEY` is set, so the app works in demo mode without it. Turn enforcement on like this, in order:
1. In the Google Cloud Console, enable the reCAPTCHA Enterprise API for the Firebase project.
2. In the reCAPTCHA admin console (https://www.google.com/recaptcha/admin) create a **v3** site key for the site's domain (e.g. `reform-club.web.app`), and copy the site key.
3. In the Firebase Console > App Check > Apps, register the web app, choose reCAPTCHA v3 as the provider, and paste the site key.
4. In `.env` set `VITE_RECAPTCHA_SITE_KEY=<the v3 site key>` and rebuild (`npm run build`).
5. Back in Firebase Console > App Check > Firestore, click **Enforce**. Verify the site still loads and a member can sign in and submit artwork; if App Check blocks a real user, switch Firestore back to **Unenforced** and check the site key/domain first.
Note: App Check is a bot-abuse mitigation, not a replacement for the Firestore rules — the rules in `firestore.rules` are still the real enforcement.

## Before going live
1. Run the rules tests where localhost HTTP/2 is allowed: `npx firebase emulators:exec --only firestore "npm run test:rules"` — do not go live with a failing suite.
2. Deploy the rules: `firebase deploy --only firestore:rules`.
3. Run the bootstrap: `cd scripts && node bootstrap-coordinator.js` (creates the coordinator admin doc and `siteSettings/main` with `membershipOpen: true`, all role applications closed).
4. If the project already has artworks or team members from before the hardening round, run the backfill: `cd scripts && node backfill-fields.js --dry-run` first, then `node backfill-fields.js` (sets `uploadedAt` on artworks that lack it, `archived: false` on team members that lack it; never deletes anything).
5. Set siteSettings in the admin Settings page: membership open/closed and which role applications are open.
6. Test signed-out browsing of Gallery, Events, Notices and Blog — public pages must load and no write must succeed.
7. Test Google sign-in as a member, then one member upload (artwork) and one W2B submission.
8. Test one admin upload (gallery image or constitution PDF) and one admin-only page (e.g. Users & Permissions as coordinator).

## Rules tests (green on the user's machine 2026-11-07 — still not runnable in this VM, see Remaining gaps)
`tests/firestore.rules.test.js` (214 tests, 41 describe blocks) covers public-read denial, public-create validation, role-open toggles, member field restrictions, like/unlike, voting, W2B-open-only, permissioned application review, coordinator-only actions, and audit-log immutability. Block (m) adds 26 'fails without fix' tests for the final hardening round: admin artwork `uploadedAt`, team-member `archived` bool, events https-only URLs, like/vote/voter exact key sets, one W2B submission per user (doc id == uid), verified email for member creates, audit `actorEmail` matching the token email, and coordinator-only admin-doc access. Block (n) adds 33 tests for the last round: the multi-vote batch bypass (one batch voting for two submissions), missing-document reads (own not-yet-existing submission, another user's missing submission, admin get on a missing id), the admin blog-create branch, one exact-payload test per admin module (Gallery, Events, Notices, Team, Membership, Applications incl. the byUid fix, Waste to Best, Constitution, Comments, Legacy, Blog, Recognition, Contact, Users/Settings), and draft-challenge reads. Run where localhost HTTP/2 is allowed:
```bash
npx firebase emulators:exec --only firestore "npm run test:rules"
```
`firebase.json` has emulators auth 9099 / firestore 8080. The rules were fixed by the tests' design review: W2B create now requires the parent challenge status `open`, the vote rule now also requires `!exists(voters/{uid})` (second vote in the same challenge blocked), and application create now checks phone/academicYear lengths like membership does.

## Admin
- Login: `/admin/login` (email/password). Google sign-in is for members/voters (artwork submission, likes, comments, W2B voting).
- Roles: Coordinator (everything), Co-Coordinator / Mentor / Staff (only granted permissions). Menu items are hidden without permission; Firestore rules are the real enforcement.
- Security: 30-minute admin inactivity auto sign-out; 60-second lockout after 5 failed logins; re-auth before sensitive actions (delete admin, change permissions, delete application, replace constitution); every admin write calls `auditService.log` (append-only, coordinator-read-only).
- Dashboard toggles open/close each role application; the rules enforce the same toggles on public application creation.

## Backups
- Firestore: `cd scripts && node export-firestore.js` — timestamped JSON of all collections (works on Spark). Restore by re-importing the JSON with the Admin SDK.
- Backfill (one-time, after the hardening round): `cd scripts && node backfill-fields.js --dry-run` then `node backfill-fields.js` — sets `uploadedAt` on artworks that lack it (from `createdAt` when present, else the server time) and `archived: false` on team members that lack it; logs counts, never deletes anything. Run it once after deploying the new rules; old documents without those fields would otherwise fail the new rules on update.
- Supabase: Dashboard > Storage > bucket > list/download, or the Supabase CLI. Restore by re-uploading the same paths.
- Free-tier limits: Firebase Spark + Supabase Free (1 GB storage, bandwidth cap, Supabase project pauses after inactivity). Queries are paginated (12 artworks/page) and public pages use one-time reads, not listeners, to stay inside quotas.

## Troubleshooting
- Blank page / demo data only: `.env` is blank — fill it (see above). Demo mode is intentional.
- Sign-in fails: check Auth providers are enabled and the domain is authorised.
- Upload fails: check the Supabase bucket + policies ran, and Firebase third-party auth is enabled for admin uploads.
- `npm audit`: run `npm audit` and review; versions are pinned in `package.json`.

## Section 13 self-check (verified 2026-11-07 — build tail in DECISIONS.md item 12; each tick names the implementing file)
- [x] Every page in Section 9 exists and is routed — `src/routes/AppRoutes.jsx`, `src/pages/public/` (18 pages), `src/pages/admin/` (15 pages)
- [x] Every admin module in Section 9 exists, with CRUD and permission guard — `src/pages/admin/GalleryAdmin.jsx`, `EventsAdmin.jsx`, `NoticesAdmin.jsx`, `TeamAdmin.jsx`, `MembershipAdmin.jsx`, `ApplicationsAdmin.jsx`, `WasteToBestAdmin.jsx`, `ConstitutionAdmin.jsx`, `CommentsAdmin.jsx`, `LegacyAdmin.jsx`, `BlogAdmin.jsx`, `RecognitionAdmin.jsx`, `UsersAdmin.jsx`, `SettingsAdmin.jsx`, plus `Dashboard.jsx`; all use react-hook-form + zod, `src/hooks/useAdminWrite.js` (service, then `auditService.log`, then toast), `Modal`/`ConfirmDialog`/`ImageUploader`; routes guarded in `src/routes/AppRoutes.jsx` via `ProtectedRoute`/`PermissionRoute`
- [x] All 4 gallery categories, filter, lightbox, responsive grid, approval flow — `src/pages/public/Gallery.jsx`, `src/components/gallery/GalleryGrid.jsx`, `ArtworkCard.jsx`, `CategoryFilter.jsx`, `src/components/ui/Lightbox.jsx`, `src/pages/admin/GalleryAdmin.jsx` (approve, reject with reason, bulk approve/reject)
- [x] 8 teams, full hierarchy, editable via admin, archive, latest structure shown — `src/pages/public/Team.jsx`, `src/components/team/HierarchyChart.jsx`, `src/pages/admin/TeamAdmin.jsx` (replace/reassign/archive, Start New Term wizard), `src/services/teamService.js` (`archiveTerm` updates `termRecords`, `startNewTerm` archives the old term)
- [x] General membership form is separate from role applications — `src/pages/public/JoinUs.jsx` + `src/schemas/membership.js` vs `src/pages/public/Apply.jsx` + `src/schemas/application.js`
- [x] Coordinator can open/close each role application; rules enforce it — toggles in `src/pages/admin/Dashboard.jsx`, `ApplicationsAdmin.jsx`, `SettingsAdmin.jsx` on `siteSettings.applicationsOpen` keys `coAdmin`/`teamHead`/`teamMember` (mapped from role values `co_coordinator`/`team_head`/`team_member`); enforced in `firestore.rules` via `roleOpen()` on application create
- [x] All 5 application statuses with history and role-based review access — `src/pages/admin/ApplicationsAdmin.jsx`, `src/services/applicationService.js` (`updateStatus` appends `statusHistory`, `addReviewNote`, interview date)
- [x] Waste to Best full workflow including archive and semester leaderboard — `src/pages/public/WasteToBest.jsx` (public signed-in submission form, 1 to 5 images to `w2b/`, only while challenge is open; voting; winner; archive; leaderboard), `src/pages/admin/WasteToBestAdmin.jsx` (draft, open, voting, closed; judge scores; announce winner), `src/services/challengeService.js`, `src/schemas/challenge.js` (`w2bSubmissionSchema`)
- [x] Constitution upload, latest version, archive — `src/pages/public/Constitution.jsx`, `src/pages/admin/ConstitutionAdmin.jsx` (new upload marks latest, previous `isLatest` becomes false), `src/services/constitutionService.js`
- [x] Notice board, with highlights on the Home Page — `src/pages/public/NoticeBoard.jsx`, `src/pages/admin/NoticesAdmin.jsx`, `src/pages/public/Home.jsx`
- [x] Likes, comments with moderation, Artist of Month/Semester, Hall of Fame — likes: `src/components/gallery/GalleryGrid.jsx` wired to `src/services/artworkService.js` `like`/`unlike` (Firestore transaction) and the exact exists/existsAfter rule in `firestore.rules` line 28; comments: `src/pages/admin/CommentsAdmin.jsx`; recognition: `src/pages/admin/RecognitionAdmin.jsx`, `src/services/recognitionService.js`
- [x] Legacy, Member Profiles, Blog — `src/pages/public/Legacy.jsx`, `Members.jsx`, `MemberProfile.jsx`, `Blog.jsx`, `BlogPost.jsx`; admin: `LegacyAdmin.jsx`, `BlogAdmin.jsx`
- [x] `firestore.rules` complete, all collections covered — `firestore.rules` (default deny; every Section 4 collection has rules; no placeholder text; verified by grep: zero matches for the placeholder marker and zero for the literal word used to mark unfinished work)
- [x] `.env.example` and `.env` contain blank values only; privileged Supabase service key not used in the frontend — `.env`, `.env.example` (only non-blank values are the intentional defaults `VITE_SITE_NAME` and `VITE_SUPABASE_BUCKET`, plus numeric limits `VITE_MAX_IMAGE_MB=5` and `VITE_MAX_DOC_MB=10`); grep for the privileged-key name returns zero matches
- [x] Supabase SQL complete; uploads validated and compressed — `supabase/storage-policies.sql` (two buckets: `reform-media` 10485760 = 10 MB, image+PDF; `reform-submissions` 5242880 = 5 MB, images only; anon insert only on `submissions/`/`w2b/` in `reform-submissions`; admin-only elsewhere), `src/services/uploadService.js` (public uploads routed to `reform-submissions` by prefix, admin/docs to `reform-media`; real XHR percentage progress via `onProgress`), `src/components/admin/ImageUploader.jsx` (real % bar), `src/utils/validateFile.js` (`MAX_IMAGE_MB = 5`, `MAX_DOC_MB = 10`); Orphan Cleanup `src/pages/admin/OrphanCleanup.jsx` (coordinator-only, `/admin/orphans`)
- [x] No Cloud Functions, no Firebase Storage, nothing needing a paid plan — `package.json` (firebase, supabase-js only; no functions SDK), `firebase.json` (hosting + firestore only)
- [x] Security headers, input validation, sanitisation, audit log, backup script — `firebase.json` (headers/CSP), `src/schemas/` (10 zod schemas), `src/utils/sanitize.js`, `src/services/auditService.js`, `scripts/export-firestore.js`; App Check initialised in `src/config/firebase.js` only when `VITE_RECAPTCHA_SITE_KEY` is set
- [x] Accessibility, SEO, responsiveness, reduced-motion handled — `src/index.css` (reduced-motion media query, focus styles), `src/components/layout/PageShell.jsx` (react-helmet-async per page), `public/robots.txt`, `public/sitemap.xml`, `scripts/generate-sitemap.js`
- [x] `npm run build` succeeds with no errors or warnings about missing files — verified 2026-11-07, `npm run build`, built in 11.90s, **no chunk-size warning** (`vite.config.js` `manualChunks`: react, firebase, framer-motion, zod; largest chunk firebase 474.14 kB); tail in DECISIONS.md item 26
- [x] Firestore rules tests pass — **verified 2026-11-07 on the user's machine: 214 pass, 0 fail, 0 cancelled** (`npx firebase-tools emulators:exec --only firestore "npm run test:rules"`, Java 21, ~155s). First run was 210/214; the 4 failures were test bugs fixed in the test file only (see DECISIONS item 27). The suite still cannot execute in this VM (see Remaining gaps).

## Remaining gaps (plainly, not ticked above)
- **Rules tests are green on the user's machine (2026-11-07: 214 pass, 0 fail, after a first run of 210/214 whose 4 failures were test bugs).** All 4 failures were test bugs (see DECISIONS item 27: three transaction-flow tests used `assertFails` for the service guard's plain Error, and the audit-log create test used a token with no email claim) and are fixed in the test file; the re-run on 2026-11-07 confirmed **214 pass, 0 fail**. `tests/firestore.rules.test.js` exists (214 tests, 58 'fails without fix' tests in block (l) plus 26 in block (m) plus 33 in block (n)) but `npm run test:rules` could not execute in this VM: the Firestore emulator starts (Java 21 installed) and loads `firestore.rules` with no compile error — re-checked this round by running the standalone emulator jar v1.22.0 directly (HTTP 200, zero ERROR lines in its log) — but its API layer is unusable here: the JS SDK gets gRPC `RST_STREAM` / HTTP/2 protocol errors on every Listen stream. This round's run: 0 passed, 0 failed, 1 cancelled, ~240s timeout. Run `npx firebase emulators:exec --only firestore "npm run test:rules"` on a machine where localhost HTTP/2 is allowed. Rule bugs fixed from test design across rounds (W2B open-only, second-vote block, application phone/academicYear lengths — see DECISIONS item 17; multi-vote batch bypass, missing-doc reads, draft-challenge reads, admin blog create, and the ApplicationsAdmin missing-actor bug — see DECISIONS item 26).
- **Nothing was tested against live Supabase/Firebase:** the XHR upload, the new two-bucket SQL, and orphan listing/deletion are code- and build-verified only. Run the SQL once in the Supabase SQL Editor and do a live upload + orphan scan before relying on it. Open question (unchanged): a signed-in non-admin Firebase user sends its ID token, while the anon insert policy is `to anon` — live-check whether Supabase maps that user to `authenticated` and blocks the upload.
- The Supabase 5 MB image backstop in `storage-policies.sql` is null-tolerant by design: if Supabase does not populate `metadata ->> 'size'` at INSERT-policy evaluation time, the SQL size check passes and the client-side 5 MB validation is the real enforcement. The bucket-level caps still apply.
- Demo mode is simulated, not persisted: admin writes in demo mode update the on-screen table optimistically via `useAdminWrite` but do not persist; live mode reloads from Firestore.
- Upload progress covers the main file only (thumbnail upload has no progress). The `firebase` chunk at 471.66 kB is close to the 500 kB warning limit — future Firebase SDK growth could re-trigger the warning. The `framer-motion` manualChunks rule produces no chunk (nothing imports framer-motion). Orphan scan lists up to 1000 files per prefix, non-recursive. Events gallery photos store URLs only, so orphan matching for those extracts the storage path from the Supabase public URL.
