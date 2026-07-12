# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.
The installed `.d.ts` files under `node_modules/` are the ground truth for API shapes
(e.g. `expo-notifications/build/Notifications.types.d.ts`, `expo-sqlite/build/*.d.ts`).

Key SDK 57 facts already verified against the installed types:
- expo-sqlite: async API — `openDatabaseAsync`, `execAsync`, `runAsync`, `getFirstAsync`,
  `getAllAsync`. Migrations use `PRAGMA user_version`.
- expo-notifications: foreground handler returns `shouldShowBanner`/`shouldShowList`
  (not `shouldShowAlert`); scheduled triggers need an explicit
  `type: SchedulableTriggerInputTypes.DATE` and take an optional `channelId`.

# Architecture (Layer 1)

Local-first, zero backend: SQLite on-device, local notifications only, no network calls.

- `src/types.ts` — domain types; `src/theme.ts` — all colors/spacing (never hardcode colors)
- `src/db/database.ts` — singleton `getDb()`, schema/migrations, CRUD
- `src/notifications.ts` — permission + Android channel + reminder scheduling
- `src/screens/`, `src/components/`, `src/navigation.ts` (typed param lists), `App.tsx` (tabs + stack)

Invariant: each assignment row persists its scheduled notification ids (`notification_ids`
JSON column). Any mutation must go through `refreshAssignmentRemindersAsync()` (cancels stale
ids, reschedules, persists new ids); deletes return the ids so callers can cancel them.

Keyboard handling on form screens (see `AssignmentEditScreen`): `KeyboardAvoidingView` with
`behavior` `padding` on iOS (plus `keyboardVerticalOffset={useHeaderHeight()}` — screens sit
under a native-stack header) and `undefined` on Android, where the window already resizes
(`softwareKeyboardLayoutMode` defaults to `resize`; padding there would double-compensate).
Neither platform auto-scrolls a bottom-of-form input into the shrunken viewport — scroll it
into view explicitly on focus/`keyboardDidShow`.

# EAS builds (config only — owner runs the builds)

- `eas.json`: `development` (dev client, internal, APK), `preview` (internal APK), `production`
  (store defaults, AAB). `appVersionSource: "local"` → bump `android.versionCode` in `app.json`
  manually. Android package: `com.wilbergr.classtrack`.
- `extra.eas.projectId` in `app.json` is the owner's EAS project id (public identifier, not a
  secret) — written by the owner's first `eas build` and now committed. Don't regenerate it,
  and never run `eas login`/`eas init`/`eas build` from an agent session. Runbook: see
  "Android dev build" in `HANDOFF.md`.
- Dev server on WSL2: never `sudo npx expo start`; use `--tunnel` or mirrored networking —
  see "Troubleshooting: running the dev server on WSL2" in `HANDOFF.md`.

# Verification

- `npx tsc --noEmit` must pass clean (strict mode).
- `npx expo export --platform android --output-dir <tmp>` is a good no-device smoke test
  (full Metro + Hermes bundle catches broken imports).
