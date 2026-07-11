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
- ⬜ Data layer, notifications helper, screens, navigation — **not yet written** (only theme.ts exists under src/)

### Next steps to finish Layer 1
1. `src/types.ts` — Subject, Assignment types
2. `src/db/database.ts` — open SQLite, schema/migrations, CRUD
3. `src/notifications.ts` — permission + Android channel + schedule/cancel reminders
4. `src/screens/` — TodayScreen, SubjectsScreen, SubjectDetailScreen, AssignmentEditScreen, SettingsScreen
5. `src/components/` — AssignmentRow, EmptyState
6. `App.tsx` — NavigationContainer + tabs + stack; init DB on mount
7. Validate: `npx tsc --noEmit`, then run on device via Expo Go / dev build

## Git & GitHub
- Repo-local identity set to **wilbergr / wilbergr@users.noreply.github.com** (do NOT use the work email gwilber@wilshire.com — public repo).
- Target remote: personal GitHub **github.com/wilbergr**, **public** repo.
- ⚠️ `gh` auth token was invalid — re-run `gh auth login -h github.com` before creating/pushing the repo.

## Research decision on file: LMS auto-import is TABLED
Student self-authorization is effectively institution-gated on Schoology / Google Classroom / Canvas for under-18 users, plus heavy COPPA/FERPA burden for a solo dev with no school partnership. Revisit only with institutional relationships. Full cited report: `../../data/lms-research/report.md`.
