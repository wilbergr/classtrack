// The Spark engine: the ONLY writer of the `progress` and `ledger` tables.
// The ledger is the source of truth (append-only, idempotent via a partial
// unique index); `progress` is a cached rollup that could be rebuilt from it.

import { getDb } from '../db/database';
import { startOfDay } from '../dates';
import { emitProgressChanged, emitSpark } from './events';
import { levelForLifetime } from './levels';
import type { Progress, SparkAward, SparkKind } from '../types';

// Award table (design defaults; tuned with real use later).
export const CAPTURE_SPARKS = 5;
export const COMPLETE_SPARKS = 10;
export const ON_TIME_SPARKS = 5;
export const DAY_BONUS_SPARKS = 5;
/** After this many rewarded captures in a day, further captures earn 0 — silently. */
export const DAILY_CAPTURE_CAP = 10;

interface ProgressRow {
  id: number;
  lifetime: number;
  spent: number;
  momentum: number;
  best_momentum: number;
  grace: number;
  grace_week: number;
  last_active_day: number | null;
  created_at: number;
}

function toProgress(r: ProgressRow): Progress {
  return {
    lifetime: r.lifetime,
    spent: r.spent,
    momentum: r.momentum,
    bestMomentum: r.best_momentum,
    grace: r.grace,
    lastActiveDay: r.last_active_day,
  };
}

async function ensureProgressRowAsync(): Promise<ProgressRow> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR IGNORE INTO progress (id, created_at) VALUES (1, ?)',
    Date.now(),
  );
  const row = await db.getFirstAsync<ProgressRow>('SELECT * FROM progress WHERE id = 1');
  if (!row) throw new Error('progress row missing after insert');
  return row;
}

export async function getProgressAsync(): Promise<Progress> {
  return toProgress(await ensureProgressRowAsync());
}

// ---------- awards ----------

interface PendingAward {
  kind: SparkKind;
  amount: number;
  assignmentId: number | null;
}

/**
 * Record a batch of awards for one user action. Ledger idempotency (the
 * partial unique index) silently drops anything already awarded; whatever
 * lands updates `progress` and is emitted for the UI to celebrate.
 */
async function awardManyAsync(
  pending: PendingAward[],
  capturedAssignmentId?: number,
): Promise<SparkAward[]> {
  const db = await getDb();
  const before = await ensureProgressRowAsync();
  const now = Date.now();
  const day = startOfDay(now);

  const landed: SparkAward[] = [];
  let earned = 0;

  for (const p of pending) {
    const res = await db.runAsync(
      'INSERT OR IGNORE INTO ledger (kind, amount, assignment_id, item_key, day, created_at) VALUES (?, ?, ?, NULL, ?, ?)',
      p.kind,
      p.amount,
      p.assignmentId,
      day,
      now,
    );
    if (res.changes > 0) {
      earned += p.amount;
      landed.push({ kind: p.kind, amount: p.amount, leveledUp: false });
    }
  }

  // First rewarded action of the day: "showed up" bonus + momentum.
  let momentum = before.momentum;
  if (earned > 0 && before.last_active_day !== day) {
    const existing = await db.getFirstAsync<{ id: number }>(
      "SELECT id FROM ledger WHERE kind = 'day_bonus' AND day = ? LIMIT 1",
      day,
    );
    if (!existing) {
      await db.runAsync(
        "INSERT INTO ledger (kind, amount, assignment_id, item_key, day, created_at) VALUES ('day_bonus', ?, NULL, NULL, ?, ?)",
        DAY_BONUS_SPARKS,
        day,
        now,
      );
      earned += DAY_BONUS_SPARKS;
      momentum = momentumOnActiveDay(before, day);
      landed.push({
        kind: 'day_bonus',
        amount: DAY_BONUS_SPARKS,
        leveledUp: false,
        newMomentum: momentum,
      });
    }
    await db.runAsync(
      'UPDATE progress SET momentum = ?, best_momentum = MAX(best_momentum, ?), last_active_day = ? WHERE id = 1',
      momentum,
      momentum,
      day,
    );
  }

  if (earned > 0) {
    await db.runAsync('UPDATE progress SET lifetime = lifetime + ? WHERE id = 1', earned);
  }

  if (landed.length > 0) {
    const lifetime = before.lifetime + earned;
    const leveledUp = levelForLifetime(lifetime) > levelForLifetime(before.lifetime);
    if (leveledUp && landed.length > 0) landed[landed.length - 1].leveledUp = true;
    emitSpark({
      awards: landed,
      total: earned,
      leveledUp,
      level: levelForLifetime(lifetime),
      lifetime,
      balance: lifetime - before.spent,
      capturedAssignmentId,
    });
  }
  return landed;
}

/**
 * Momentum gained by becoming active today. Phase 1 records steadily
 * (+1 per active day); the full forgiving mechanics (grace tokens, cool-down,
 * comeback boost) settle the gap first — see `settleMomentumAsync`.
 */
function momentumOnActiveDay(p: ProgressRow, _day: number): number {
  return p.momentum + 1;
}

/** Award for capturing (creating) an assignment. Daily-capped, once per assignment. */
export async function awardCaptureAsync(assignmentId: number): Promise<SparkAward[]> {
  const db = await getDb();
  const day = startOfDay(Date.now());
  const row = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(*) AS n FROM ledger WHERE kind = 'capture' AND day = ? AND amount > 0",
    day,
  );
  const capped = (row?.n ?? 0) >= DAILY_CAPTURE_CAP;
  return awardManyAsync(
    [{ kind: 'capture', amount: capped ? 0 : CAPTURE_SPARKS, assignmentId }],
    assignmentId,
  );
}

/**
 * Award for marking an assignment complete (never revoked on un-complete).
 * Call after `setAssignmentCompleted(id, true)`.
 */
export async function awardCompleteAsync(assignment: {
  id: number;
  dueAt: number;
}): Promise<SparkAward[]> {
  const pending: PendingAward[] = [
    { kind: 'complete', amount: COMPLETE_SPARKS, assignmentId: assignment.id },
  ];
  if (Date.now() <= assignment.dueAt) {
    pending.push({ kind: 'on_time', amount: ON_TIME_SPARKS, assignmentId: assignment.id });
  }
  return awardManyAsync(pending);
}

// ---------- reads for UI ----------

export interface ProgressSummary extends Progress {
  level: number;
  balance: number;
}

export async function getProgressSummaryAsync(): Promise<ProgressSummary> {
  const p = await getProgressAsync();
  return { ...p, level: levelForLifetime(p.lifetime), balance: p.lifetime - p.spent };
}

/** Rebuild the `progress` rollup from the ledger (recovery path; not used in normal flow). */
export async function rebuildProgressFromLedgerAsync(): Promise<void> {
  const db = await getDb();
  await ensureProgressRowAsync();
  const earned = await db.getFirstAsync<{ v: number | null }>(
    'SELECT SUM(amount) AS v FROM ledger WHERE amount > 0',
  );
  const spent = await db.getFirstAsync<{ v: number | null }>(
    "SELECT SUM(-amount) AS v FROM ledger WHERE kind = 'spend'",
  );
  await db.runAsync(
    'UPDATE progress SET lifetime = ?, spent = ? WHERE id = 1',
    earned?.v ?? 0,
    spent?.v ?? 0,
  );
  emitProgressChanged();
}
