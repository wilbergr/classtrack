// Local-first data layer: on-device SQLite via expo-sqlite (SDK 57 async API).
// No backend, no network — all data lives in the app's sandbox.

import * as SQLite from 'expo-sqlite';

import type {
  Assignment,
  AssignmentInput,
  AssignmentType,
  AssignmentWithSubject,
  Subject,
} from '../types';

const DB_NAME = 'classtrack.db';
const SCHEMA_VERSION = 2;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/** Open (once) and migrate the database. Call at app start; safe to call anywhere. */
export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrate().catch((e) => {
      dbPromise = null; // allow retry on next call
      throw e;
    });
  }
  return dbPromise;
}

async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;

  if (current < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS subjects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'homework',
        due_at INTEGER NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        completed INTEGER NOT NULL DEFAULT 0,
        notification_ids TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_assignments_subject ON assignments(subject_id);
      CREATE INDEX IF NOT EXISTS idx_assignments_due ON assignments(due_at);
    `);
  }

  if (current < 2) {
    // Spark (gamification) tables. All additive; existing rows migrate untouched.
    await db.execAsync(`
      ALTER TABLE assignments ADD COLUMN completed_at INTEGER;

      -- Single-row aggregate (id constrained to 1). Fast reads for headers/meters.
      CREATE TABLE IF NOT EXISTS progress (
        id             INTEGER PRIMARY KEY CHECK (id = 1),
        lifetime       INTEGER NOT NULL DEFAULT 0,
        spent          INTEGER NOT NULL DEFAULT 0,
        momentum       INTEGER NOT NULL DEFAULT 0,
        best_momentum  INTEGER NOT NULL DEFAULT 0,
        grace          INTEGER NOT NULL DEFAULT 2,
        grace_week     INTEGER NOT NULL DEFAULT 0,
        last_active_day INTEGER,
        last_settled_day INTEGER,
        comeback       INTEGER NOT NULL DEFAULT 0,
        created_at     INTEGER NOT NULL
      );

      -- Append-only Spark event log. Source of truth; progress is a cached rollup.
      CREATE TABLE IF NOT EXISTS ledger (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        kind          TEXT NOT NULL,
        amount        INTEGER NOT NULL,
        assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
        item_key      TEXT,
        day           INTEGER NOT NULL,
        created_at    INTEGER NOT NULL
      );
      -- Each per-assignment award can only ever happen once, even across
      -- complete -> un-complete -> complete cycles.
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_once
        ON ledger(kind, assignment_id) WHERE assignment_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_ledger_day ON ledger(day);

      -- Generic key-value settings (JSON-encoded values).
      CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Owned cosmetics (themes, companion accessories, celebration styles).
      CREATE TABLE IF NOT EXISTS unlocks (
        item_key    TEXT PRIMARY KEY,
        cost        INTEGER NOT NULL,
        acquired_at INTEGER NOT NULL
      );
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

// ---------- row mapping ----------

interface SubjectRow {
  id: number;
  name: string;
  color: string;
  created_at: number;
}

interface AssignmentRow {
  id: number;
  subject_id: number;
  title: string;
  type: string;
  due_at: number;
  notes: string;
  completed: number;
  completed_at: number | null;
  notification_ids: string;
  created_at: number;
}

interface AssignmentJoinedRow extends AssignmentRow {
  subject_name: string;
  subject_color: string;
}

function toSubject(r: SubjectRow): Subject {
  return { id: r.id, name: r.name, color: r.color, createdAt: r.created_at };
}

function parseNotificationIds(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function toAssignment(r: AssignmentRow): Assignment {
  return {
    id: r.id,
    subjectId: r.subject_id,
    title: r.title,
    type: r.type as AssignmentType,
    dueAt: r.due_at,
    notes: r.notes,
    completed: r.completed !== 0,
    completedAt: r.completed_at,
    notificationIds: parseNotificationIds(r.notification_ids),
    createdAt: r.created_at,
  };
}

function toAssignmentWithSubject(r: AssignmentJoinedRow): AssignmentWithSubject {
  return { ...toAssignment(r), subjectName: r.subject_name, subjectColor: r.subject_color };
}

const JOIN_SELECT = `
  SELECT a.*, s.name AS subject_name, s.color AS subject_color
  FROM assignments a JOIN subjects s ON s.id = a.subject_id
`;

// ---------- subjects ----------

export async function listSubjects(): Promise<Subject[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<SubjectRow>('SELECT * FROM subjects ORDER BY name COLLATE NOCASE');
  return rows.map(toSubject);
}

export async function getSubject(id: number): Promise<Subject | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<SubjectRow>('SELECT * FROM subjects WHERE id = ?', id);
  return row ? toSubject(row) : null;
}

export async function createSubject(name: string, color: string): Promise<Subject> {
  const db = await getDb();
  const createdAt = Date.now();
  const res = await db.runAsync(
    'INSERT INTO subjects (name, color, created_at) VALUES (?, ?, ?)',
    name,
    color,
    createdAt,
  );
  return { id: res.lastInsertRowId, name, color, createdAt };
}

export async function updateSubject(id: number, name: string, color: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE subjects SET name = ?, color = ? WHERE id = ?', name, color, id);
}

/**
 * Delete a subject; its assignments cascade-delete. Returns the notification
 * ids of every deleted assignment so the caller can cancel the reminders.
 */
export async function deleteSubject(id: number): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ notification_ids: string }>(
    'SELECT notification_ids FROM assignments WHERE subject_id = ?',
    id,
  );
  await db.runAsync('DELETE FROM subjects WHERE id = ?', id);
  return rows.flatMap((r) => parseNotificationIds(r.notification_ids));
}

/** Open (not-completed) assignment counts per subject id. */
export async function countOpenAssignments(): Promise<Record<number, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ subject_id: number; n: number }>(
    'SELECT subject_id, COUNT(*) AS n FROM assignments WHERE completed = 0 GROUP BY subject_id',
  );
  const out: Record<number, number> = {};
  for (const r of rows) out[r.subject_id] = r.n;
  return out;
}

// ---------- assignments ----------

export async function listOpenAssignmentsWithSubject(): Promise<AssignmentWithSubject[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AssignmentJoinedRow>(
    `${JOIN_SELECT} WHERE a.completed = 0 ORDER BY a.due_at ASC, a.id ASC`,
  );
  return rows.map(toAssignmentWithSubject);
}

export async function listAssignmentsForSubject(subjectId: number): Promise<AssignmentWithSubject[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<AssignmentJoinedRow>(
    `${JOIN_SELECT} WHERE a.subject_id = ? ORDER BY a.completed ASC, a.due_at ASC, a.id ASC`,
    subjectId,
  );
  return rows.map(toAssignmentWithSubject);
}

export async function getAssignmentWithSubject(id: number): Promise<AssignmentWithSubject | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<AssignmentJoinedRow>(`${JOIN_SELECT} WHERE a.id = ?`, id);
  return row ? toAssignmentWithSubject(row) : null;
}

export async function createAssignment(input: AssignmentInput): Promise<Assignment> {
  const db = await getDb();
  const createdAt = Date.now();
  const res = await db.runAsync(
    `INSERT INTO assignments (subject_id, title, type, due_at, notes, completed, notification_ids, created_at)
     VALUES (?, ?, ?, ?, ?, 0, '[]', ?)`,
    input.subjectId,
    input.title,
    input.type,
    input.dueAt,
    input.notes,
    createdAt,
  );
  return {
    id: res.lastInsertRowId,
    ...input,
    completed: false,
    completedAt: null,
    notificationIds: [],
    createdAt,
  };
}

export async function updateAssignment(id: number, input: AssignmentInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE assignments SET subject_id = ?, title = ?, type = ?, due_at = ?, notes = ? WHERE id = ?',
    input.subjectId,
    input.title,
    input.type,
    input.dueAt,
    input.notes,
    id,
  );
}

export async function setAssignmentCompleted(id: number, completed: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'UPDATE assignments SET completed = ?, completed_at = ? WHERE id = ?',
    completed ? 1 : 0,
    completed ? Date.now() : null,
    id,
  );
}

export async function setAssignmentNotificationIds(id: number, ids: string[]): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE assignments SET notification_ids = ? WHERE id = ?', JSON.stringify(ids), id);
}

/** Open assignments due in [startTs, endTs) — digest + big-day counts. */
export async function countOpenDueBetween(startTs: number, endTs: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM assignments WHERE completed = 0 AND due_at >= ? AND due_at < ?',
    startTs,
    endTs,
  );
  return row?.n ?? 0;
}

/** Open assignments already past due as of `ts`. */
export async function countOpenOverdue(ts: number): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM assignments WHERE completed = 0 AND due_at < ?',
    ts,
  );
  return row?.n ?? 0;
}

/** All (subjectId, title) pairs — feeds Quick Add's local subject-inference heuristic. */
export async function listAssignmentTitles(): Promise<{ subjectId: number; title: string }[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ subject_id: number; title: string }>(
    'SELECT subject_id, title FROM assignments ORDER BY created_at DESC LIMIT 400',
  );
  return rows.map((r) => ({ subjectId: r.subject_id, title: r.title }));
}

/** Delete an assignment. Returns its notification ids so the caller can cancel them. */
export async function deleteAssignment(id: number): Promise<string[]> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ notification_ids: string }>(
    'SELECT notification_ids FROM assignments WHERE id = ?',
    id,
  );
  await db.runAsync('DELETE FROM assignments WHERE id = ?', id);
  return row ? parseNotificationIds(row.notification_ids) : [];
}
