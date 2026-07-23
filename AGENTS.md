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
`behavior="padding"` on BOTH platforms (plus `keyboardVerticalOffset={useHeaderHeight()}`
where the screen sits under a native-stack header — 0 otherwise). Android does NOT auto-resize
the window for the keyboard: this app runs under Android edge-to-edge (default and enforced
since Expo SDK 54 / API 35), which draws behind the system bars and disables the old
`adjustResize` window shrink — so `behavior={undefined}` on Android is a no-op and the keyboard
overlays the field (this was the real cause of the notes-field bug that survived two "resize
handles it" fixes; `softwareKeyboardLayoutMode` was never actually configured, only asserted in
a comment). With no window resize left, `padding` does not double-compensate — it is what lifts
the content. Neither platform auto-scrolls a bottom-of-form input into the padding-shrunken
viewport — scroll it into view explicitly on focus/`keyboardDidShow`, deferred one frame
(`requestAnimationFrame`: `keyboardDidShow` can fire before the layout settles, under-scrolling).
Growable multiline inputs need two more things: re-scroll on `onContentSizeChange` (the caret
drifts below the keyboard as the field grows while typing — focus/didShow only cover the initial
moment) and a `maxHeight` so a long value scrolls internally instead of outgrowing the shrunken
viewport. NOTE: verify keyboard fixes on a REAL Android device/emulator (edge-to-edge behavior
does not reproduce on web or the iOS simulator) — `tsc`/bundle checks alone are not sufficient.

Safe-area bottom inset on scrollable content: every screen/sheet whose scroll content or
bottom-anchored control reaches the device bottom edge MUST pad by the real safe-area bottom
inset, not a fixed constant — under edge-to-edge the app draws behind the system nav (gesture
bar / on-screen buttons), which both hides bottom controls and swallows their taps. Use the
single `useBottomInset(base)` hook (`src/hooks.ts` = `base + useSafeAreaInsets().bottom`) for
`contentContainerStyle.paddingBottom` (or a bottom-sheet's `paddingBottom`); never hardcode
`spacing.xl`/`96`/etc. for this. A root `SafeAreaProvider` (`App.tsx`) makes insets resolve
everywhere, including Onboarding and transparent `Modal`s that render outside
`NavigationContainer`'s own `SafeAreaProviderCompat`. Exceptions: tab-screen tab bars already
add the inset to their own height (`App.tsx` `Tabs`), and `HomeScreen`'s `stage` is a centered
non-scroll layout with no bottom-edge control, so it is intentionally left unpadded.

# Spark (gamification) — Layer 1.5

One economy, one face: captures/completions earn **Sparks** (schema v2:
`progress`, `ledger`, `settings`, `unlocks` tables + `assignments.completed_at`).

- `src/gamification/engine.ts` is the ONLY writer of `progress`/`ledger`. The
  ledger is append-only and idempotent (partial unique index on
  `(kind, assignment_id)`), so complete → un-complete → complete never
  re-awards; `progress` is a rebuildable rollup cache. Momentum settles lazily
  (`settleMomentumAsync` on app open + before awards, idempotent per day via
  `progress.last_settled_day`).
- Engine emits typed events (`src/gamification/events.ts`); UI (SparkBurst
  overlay, SparkPill, companion) subscribes. Screens only call engine award
  functions — feedback (sound/haptic/toast) is centralized in `SparkBurst`.
- `src/settings.ts`: typed JSON settings over the `settings` table with an
  in-memory cache (`loadSettingsAsync()` at app start; `useSettings()` hook).
  Playful defaults (Hype vibe, Pop theme, Wisp companion, sound on) — calm is
  the opt-down, chosen in onboarding or Settings.
- **Theming:** `src/theme/` — `useTheme()` + per-component
  `makeStyles(colors)` via `useMemo`. There is deliberately NO static colors
  export; never hardcode a color, always add tokens to every palette in
  `src/theme/palettes.ts` (incl. urgency ramp + companion tints).
- **Companion drives the theme** (`themeSource` setting, default
  `'companion'`): each companion has a signature palette via
  `COMPANION_THEME` in `palettes.ts` (wisp→ember, pip→meadow, juno→dusk,
  unit7→circuit, nova→rocket, rex→lagoon, otto→nocturne, none→slate).
  Manual picks (Settings chips, Spark-shop
  equip) set `themeSource: 'manual'` + `themeId`; "Match sidekick" in
  Settings returns to companion-driven. `loadSettingsAsync` migrates
  pre-themeSource users: non-default stored themeId ⇒ pinned manual.
  Signature palettes are not in `THEME_META` (not shop items — they come
  with the companion).
- Motion: `useCalmMotion()` (OS reduced-motion OR Reduce-effects OR Chill
  vibe) must gate every spring/particle. Urgency/status is never conveyed by
  color, motion, or sound alone.
- Sounds in `assets/sounds/*.wav` are locally SYNTHESIZED placeholders (tiny
  PCM chimes, no license issues). Swappable later for Kenney.nl CC0 UI audio —
  same filenames, no code change.
- Notification copy lives in `src/gamification/copy.ts` (voice packs
  ember/sage/dot/plain). Hash-pick + settings-persisted recent-ring; copy
  re-rolls on every edit because reminders cancel+reschedule. Daily digest =
  rolling 7 days at 4 PM on its own `daily-digest` channel, ids persisted in
  settings, refreshed on app open.
- **Copy rulebook (hard constraints, enforce in every change):** never any
  diagnosis/clinical wording (it's a fun planner for every student); no shame
  ("failed/broke/lost/still haven't"); nothing is ever taken away (levels
  never drop, Sparks never revoked, companion never sickens — worst case
  asleep); no timed/expiring rewards; overdue = "whenever you're ready"
  register, never a per-item list and never shame, but mentioned ONCE at every
  regular notification interval while items remain: the digest's overdue clause
  (a soft aggregate, "a couple things"), an `overdueTag` appended to each
  reminder, and a standalone `overdueNudge` (digest channel) at 4 PM on the
  empty-upcoming days a digest skips. The tag and standalone nudge are
  deliberately count-free ("a little from before"); each is a single calm line,
  re-armed per app open (repeated, never stacked); all on-device, no network.
- Voice capture (`expo-speech-recognition`) is default-OFF with a disclosure
  in Settings: the OS speech engine may route audio through Google/Apple —
  keep it opt-in.
- New native modules since Layer 1: `react-native-reanimated`,
  `expo-haptics`, `react-native-svg`, `expo-audio`, `expo-splash-screen`,
  `expo-speech-recognition`, `@shopify/react-native-skia` → owner must run a
  FRESH `eas build` dev client (a JS reload of the old dev client will crash
  on missing native modules).

# Companion Home (Layer 2)

The companion is the app's face: `Home` is the first tab and the initial
route (`launchScreen` setting opts down to Today-first).

- `src/screens/HomeScreen.tsx` — illustrated scene backdrop + bubble queue +
  big companion + `FocusPreview` slot + quick add/Progress actions, laid out
  as a centered stage (no scroll: `companionSize` is bounded by BOTH width and
  height so the preview never overflows a short screen). Companion `none`
  renders the `EnergyOrb` home with Plain-pack info-card bubbles; same layout,
  no dead end. There is deliberately NO name/stage label under the companion —
  the `identity` bubble slot carries name + stage progress instead; renaming
  lives in Settings → Sidekick.
- **Scene backdrop** (`src/components/scenery/`): a Finch-style illustrated
  room the companion stands in, themed per active palette (so it changes with
  the companion). `model.ts` is a pure parametric scene (themeId + colors +
  dayPhase → primitive shapes in a 100×176 space, floor line `FLOOR_Y`);
  `SCENE_MOTIF` picks each theme's flavor (hearth/garden/twilight/workshop/…).
  `Scenery.tsx` draws it as STATIC react-native-svg (New-Arch rule holds —
  never per-frame SVG props), adds the day-phase focal halo behind the
  companion, and an optional calm-gated drift-mote layer (wrapper transforms
  only). Same pattern as the rig: all colors derive from palette tokens (only
  literal is white), so add a `SCENE_MOTIF` entry + `dayPhase` handling for
  any new theme. Eyeball without a device with the serialize-to-SVG trick
  (as `scripts/generate-branding.js` does for the rig).
- **Home focus preview** (`src/components/FocusPreview.tsx`): a condensed
  glance at overdue+due-today items (top 3, tap-through to Today) that is
  purely additive — Today owns the full list and all completion. Both screens
  bucket via the single `bucketByDueStatus` in `dates.ts` (never reimplement).
  Caught-up state stays the calm one-line glance + level meter.
- `src/gamification/guidance.ts` — speech bubbles are deterministic
  templates over on-device day data (NO network/LLM, ever). Slots live in
  `BUBBLES` in `copy.ts` (all four packs; apply the copy rulebook to every
  new line). Selection reuses `pickTemplate` with a bubbles-own recent-ring
  (`recentBubbleTemplates`); the ring records lines when actually shown.
- **The rig is model + renderer:** `src/components/companion/model.ts` is a
  pure parametric model (species/stage/mood/theme → layers of primitive
  shapes); `SkiaRig.tsx` draws it (one Canvas; per-layer `Group` transforms
  driven by Reanimated shared values; real `BlurMask` glow on aura/shimmer).
  Never animate react-native-svg props per-frame (New-Arch potholes) — SVG
  remains only for static art (EnergyMeter/Orb, Progress ring, bubble tail,
  tab icons).
- **Rig v3 anatomy (chibi full body):** 100×100 space, oversized head
  (~y 6–57), torso tucked under it (overlap the seam — no gaps), stubby
  limbs (`arms` layer, thick round strokes / rects, sways with breath phase
  lag), feet/tail on the ground line ~y 88, shadow y 94, neckline ≈ y 57
  (accessory anchor; halo/crown ≈ y 5). Eyes are white sclera (face layer) +
  a wandering pupil group: tinted iris ring, species-dark pupil, dual
  catchlights, converged ~0.5 inward. Layers may set `pivot` so sway reads
  as a hinge (arms at the shoulder, sprouts at the base); `RigModel.float`
  hover-bobs every layer but the shadow (Wisp), which narrows as the body
  rises; the renderer's `breathWave` is an asymmetric sine (quick inhale,
  slow exhale). All rig colors derive from `colors.companion[species]` via
  lighten/darken — the only literal is white. Seven species share `cuteFace`
  except unit7 (screen face); otto passes `beak`/`eyeScale`. To eyeball
  changes without a device: the model is pure TS — compile it standalone and
  serialize shapes to SVG (the shape union maps 1:1 onto SVG elements), as
  `scripts/generate-branding.js` does.
- Evolution: 7 stages from `stageForLevel` (levels 1/3/5/9/14/20/27), driven
  by `progress.lifetime` so forms can never be bought or lost; stages only
  ever map upward. `TOP_STAGE` in `companion.ts` is the single "final form"
  source — never hardcode the top stage number. The evolution moment is
  detected via the `lastSeenStage` settings key on Home load (works no matter
  where the award happened) and is replayable from Progress. Poking is
  affection only — no economy hooks.
- Shields (grace) surface from one source (`progress.grace`) in three places:
  the Progress `ShieldIcon` row + `MomentumInfoSheet` explainer, the rig's
  `guard` charm layer (`shields` prop on `Companion`, passed on Home only),
  and the `shieldStatus` bubble slot — queued only when grace > 0, because
  resting shields are never mentioned (copy rulebook: nothing reads as lost).
- Theme rule extension: `dayPhase` tokens (morning/evening ambient tints)
  exist in EVERY palette; add them to any new palette.
- Tab bar: custom SVG glyphs in `src/components/TabBarIcon.tsx` (filled
  active / outline idle, highlight pill + bold label carry selection — never
  color alone). The navigator renders BOTH focused and unfocused variants
  and cross-fades them. `tabBarStyle.height` overrides the default, so it
  must include `useSafeAreaInsets().bottom` itself.

# Branding assets

All of `assets/*.png` (icon, adaptive-icon layers, monochrome, notification,
splash, favicon) are generated from the companion rig itself — Wisp stage 4 in
the Ember palette — by `npm run branding` (`scripts/generate-branding.js`:
transpiles the pure model/palettes standalone, serializes shapes to SVG,
rasterizes with `@resvg/resvg-js`, deterministic + offline). Never hand-edit
the PNGs; re-run the script after rig or Ember-palette changes. The `app.json`
colors (adaptive-icon background `#251507`, splash `#FFF6EC`, notification tint
`#D9480F`) are Ember tokens — keep them in sync with `src/theme/palettes.ts`.

# EAS builds (config only — owner runs the builds)

- `eas.json`: `development` (dev client, internal, APK), `preview` (internal APK), `production`
  (store defaults, AAB). `appVersionSource: "local"` → bump `android.versionCode` in `app.json`
  manually. Android package: `com.wilbergr.classtrack`.
- `extra.eas.projectId` in `app.json` is the owner's EAS project id (public identifier, not a
  secret) — written by the owner's first `eas build` and now committed. Don't regenerate it.
- `eas build` (any profile, including `--local`) and `eas submit` MAY be run from an agent
  session, but ONLY with the supervising captain's explicit real-time approval on each
  individual invocation. Never run either silently or with any auto-approve/non-interactive
  flag (e.g. `--non-interactive`, `--auto-submit`, `--no-wait` used to skip a confirmation).
- `eas login` and `eas init` remain owner-only: never run either from an agent session.
- Runbook: see "Android dev build" in `HANDOFF.md`.
- Dev server on WSL2: never `sudo npx expo start`; use `--tunnel` or mirrored networking —
  see "Troubleshooting: running the dev server on WSL2" in `HANDOFF.md`.

# Content filter

Any screen with a free-text `TextInput` a student can save MUST gate its
save/submit handler through `checkTextFields([...])` from `src/contentFilter.ts`
(a pure, synchronous, on-device word-list check — never a network call; the app
stays zero-backend). Block the save on a non-null return and show the returned
message inline in a calm `textMuted` style (not alarm-red); clear it on the next
keystroke. Do NOT check per-keystroke. Checking at save time also covers
voice-dictated text, since `VoiceCaptureButton` only writes the transcript into
the same field state. Already wired into all current free-text entry points
(assignment title/notes, subject name, companion name in Settings + Onboarding,
quick-add title) — mirror one of those when adding a new field. Word-lists are
leaky in both directions; the false-positive/negative limits and the deliberate
omissions (legit school vocab like "kill"/"weed"/anatomy terms) are documented at
the top of `contentFilter.ts` — keep the copy rulebook (no shame, no category
naming) when touching the block message.

# Verification

- `npx tsc --noEmit` must pass clean (strict mode).
- `npm test` runs the pure-logic unit tests on Node's built-in runner with TS
  type-stripping (`test/*.test.ts`). There is no jest-expo / RN render harness —
  keep tests to pure modules (e.g. `src/contentFilter.ts`).
- `npx expo export --platform android --output-dir <tmp>` is a good no-device smoke test
  (full Metro + Hermes bundle catches broken imports).

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
