# ClassTrack — Handoff / Status

**What it is:** GWilber's first mobile app (personal side project). A subject-organized homework & test tracker for students. Must stay free/near-free. Cross-platform (Android + iPhone) via Expo / React Native.

## Build scope: Layer 1 (the free, no-AI, local-first core)
Manual entry of assignments / homework / tests, organized by subject, with local push-notification reminders. Everything on-device, works offline, zero backend, zero cost.

- Subjects: create/edit/delete, color-coded
- Assignments & tests: title, subject, type (homework/test/project), due date & time, notes, mark-complete
- **Today** home screen: Overdue / Due today / Upcoming — the daily habit hook
- Local scheduled reminders (evening-before + morning-of) via `expo-notifications` — on-device, free, no server

**Deferred (NOT Layer 1):** photo locker (Layer 2), AI photo→assignment extraction (Layer 3, paid), cloud sync/accounts, and LMS auto-import — see below.

## Tech stack (all free)
- Expo SDK 57 / React Native 0.86 / React 19, TypeScript
- On-device **expo-sqlite** for data
- **expo-notifications** for local scheduled reminders
- **@react-navigation** (bottom tabs: Today / Subjects / Settings; native-stack for edit screens)
- `@react-native-community/datetimepicker` for due date/time

## Current state (as of 2026-07-11)
- ✅ Expo project scaffolded (blank-typescript), standalone git repo initialized (independent of the firstmate repo)
- ✅ Dependencies installed via `expo install` (SDK-matched)
- ✅ `src/theme.ts` written (colors, subject palette, spacing tokens)
- ✅ **Layer 1 code complete**: `src/types.ts`, `src/db/database.ts` (SQLite, `PRAGMA user_version` migrations, CRUD), `src/notifications.ts` (permission, Android channel, evening-before 6:00 PM + morning-of 7:30 AM reminders), all five screens, `AssignmentRow`/`EmptyState`, typed navigation (`src/navigation.ts`), `App.tsx` (bottom tabs + native stack, DB init on mount)
- ✅ Validated: `npx tsc --noEmit` clean (strict); `npx expo export --platform android` bundles clean (Metro + Hermes)
- ✅ EAS build config prepared (2026-07-12): `expo-dev-client` installed, `eas.json` (development / preview / production profiles), `app.json` set up for Android (`com.wilbergr.classtrack`, `versionCode`, notification + dev-client plugins). Validated: `npx expo config --type public` parses, `npx tsc --noEmit` clean, `npx expo-doctor` 20/20. **No account login, EAS project, or cloud build was performed** — schema was verified against current EAS docs, but only your first real `eas build` proves it end-to-end.
- ⬜ **Not yet run on a real device/simulator** — no Android/iOS tooling in the dev environment. Next: follow the runbook below, then exercise the create-subject → add-assignment → Today → complete flow and confirm reminders fire.

## Android dev build — runbook (owner, one-time setup)

Steps 1, 3, and 4 are **interactive and account-bound** — they must be done by you, logged into your own (free) Expo account.

1. **Create a free Expo account** at https://expo.dev/signup (interactive, browser).
2. Install the EAS CLI: `npm install -g eas-cli` (or prefix every `eas` command below with `npx`).
3. `eas login` (interactive — your Expo credentials).
4. `eas build --profile development --platform android`
   - First run will prompt to **create the EAS project** and write `extra.eas.projectId` into `app.json` — that's expected; commit that change. (Done — the projectId is now committed in `app.json`; it's a public identifier, not a secret.)
   - Also expected on first run: EAS offers to generate an Android keystore for you — accept the default (stored on EAS servers).
   - The `development` profile is configured to produce a directly-installable **APK** (not an AAB).
5. When the build finishes, open the build page link (or scan the QR code), **download the APK on the phone**, enable "Install unknown apps" for your browser when prompted, and install it.
6. On your computer: `npx expo start --dev-client`, then open the ClassTrack dev build on the phone and connect (same Wi-Fi; scan the QR code, or use `--tunnel` if the network blocks LAN discovery).

Later builds: `preview` profile = shareable internal APK; `production` = store-ready AAB. `eas.json` sets `appVersionSource: "local"`, so bump `android.versionCode` in `app.json` by hand before store builds.

## iOS build — runbook (owner, one-time setup)

EAS builds iOS **in the cloud** — no Mac needed. `eas build --platform ios` is
**interactive and account-bound**, so you run it, logged into your own Apple
Developer account (same rule as the Android section: never run `eas login` /
`eas build` from an agent session).

1. `eas login` (interactive — your Expo credentials), if not already logged in.
2. `eas build --profile development --platform ios`
   - First run prompts to **register/manage signing credentials** — accept the
     **EAS-managed credentials** option (the simplest path: EAS creates and stores
     the distribution certificate and provisioning profile for you). Only decline
     if you already have credential preferences you want to bring.
   - `app.json` already carries `ios.bundleIdentifier` (`com.wilbergr.classtrack`,
     matching the Android package) and `ios.buildNumber`. `eas.json` sets
     `appVersionSource: "local"`, so bump `ios.buildNumber` in `app.json` by hand
     before store builds (mirrors `android.versionCode`).
3. **Physical-device builds need the device UDID registered first**:
   `eas device:create` (also interactive/owner-run) enrolls the device, then the
   build's provisioning profile can include it. This is **not** needed for a
   **simulator** build, or when distributing via **TestFlight** (TestFlight uses
   Apple's own device management — no ad hoc registration).

Later builds: `preview` = internal distribution; `production` = store-ready build
for App Store / TestFlight. This documents the process — read the current EAS docs
at build time, as the interactive prompts and options do change.

## Troubleshooting: running the dev server on WSL2

Lessons from the first real device run:

- **Never run the dev server with `sudo`.** `sudo npx expo start …` crashes with `Running as root without --no-sandbox is not supported` — the bundled React Native DevTools is Electron-based and refuses to run as root. Always run as your normal user: `npx expo start --dev-client --tunnel`.
- **WSL2 hides the LAN dev server from the phone.** Plain `npx expo start` advertises a `172.x` WSL-internal address the phone can't reach. Two fixes:
  - (a) use `--tunnel` (routes via Expo's servers), or
  - (b) on Windows 11, enable mirrored networking: put `[wsl2]` / `networkingMode=mirrored` in `C:\Users\<name>\.wslconfig`, run `wsl --shutdown`, and then plain `npx expo start --dev-client` works over the LAN.
- **The `@expo/ngrok` tunnel can fail transiently** (e.g. `TypeError: Cannot read properties of undefined (reading 'body')`, or an ngrok outage). Just retry the command a couple of times.
- **If a prior `sudo` run left root-owned files** and the normal run then hits permission/EACCES errors, fix ownership once: `sudo chown -R $(whoami) .expo node_modules ~/.npm`.

Known gaps (deliberate, note before shipping):
- No custom **notification icon** — the `expo-notifications` plugin is registered without options; Android will use a default. To fix later: add a 96×96 all-white transparent PNG under `assets/` and set it via the plugin options (`[ "expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#..." } ]`).
- No **splash screen** config — `assets/splash-icon.png` exists but is unreferenced; the build uses Expo's default splash. Configure via the `expo-splash-screen` plugin when polish matters.

## Git & GitHub
- Repo-local identity set to **wilbergr / wilbergr@users.noreply.github.com** (do NOT use the work email gwilber@wilshire.com — public repo).
- Target remote: personal GitHub **github.com/wilbergr**, **public** repo.
- ⚠️ `gh` auth token was invalid — re-run `gh auth login -h github.com` before creating/pushing the repo.

## Research decision on file: LMS auto-import is TABLED
Student self-authorization is effectively institution-gated on Schoology / Google Classroom / Canvas for under-18 users, plus heavy COPPA/FERPA burden for a solo dev with no school partnership. Revisit only with institutional relationships. Full cited report: `../../data/lms-research/report.md`.
