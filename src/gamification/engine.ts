// The Spark engine: the ONLY writer of the `progress` and `ledger` tables.
// The ledger is the source of truth (append-only, idempotent via a partial
// unique index); `progress` is a cached rollup that could be rebuilt from it.

import { getDb } from '../db/database';
import { addDays, startOfDay, startOfWeek } from '../dates';
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
/** Grace tokens in hand: cap, and the weekly refill amount. */
export const GRACE_CAP = 2;
/** Out of tokens, momentum cools (never resets): momentum = ceil(momentum * this). */
export const MOMENTUM_COOL_FACTOR = 0.75;
/** First active day after a gap earns this much momentum instead of +1. */
export const COMEBACK_MOMENTUM = 2;

interface ProgressRow {
  id: number;
  lifetime: number;
  spent: number;
  momentum: number;
  best_momentum: number;
  grace: number;
  grace_week: number;
  last_active_day: number | null;
  last_settled_day: number | null;
  comeback: number;
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
    comeback: r.comeback === 1,
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

// ---------- forgiving momentum ----------

/**
 * Lazily settle the days since the last Spark-earning action. Forgiving by
 * design: days with nothing open are free; otherwise a grace token absorbs
 * the miss silently; out of tokens, momentum cools (ceil(m * 0.75)) — it
 * never resets. Any real gap arms the comeback boost (+2 on the next active
 * day). Idempotent per day via `last_settled_day`. Call on app open and
 * before awards; no background jobs needed.
 */
export async function settleMomentumAsync(now: number = Date.now()): Promise<void> {
  const db = await getDb();
  const p = await ensureProgressRowAsync();
  const today = startOfDay(now);

  // Weekly grace refill (Mondays), independent of activity.
  let grace = p.grace;
  let graceWeek = p.grace_week;
  const week = startOfWeek(now);
  if (graceWeek < week) {
    grace = GRACE_CAP;
    graceWeek = week;
  }

  let momentum = p.momentum;
  let comeback = p.comeback;
  const settledFrom = Math.max(p.last_active_day ?? 0, p.last_settled_day ?? 0);

  if (p.last_active_day != null && settledFrom < today) {
    for (let d = addDays(settledFrom, 1); d < today; d = addDays(d, 1)) {
      // Free day: nothing was open at any point that day — costs nothing.
      const open = await db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM assignments WHERE created_at < ? AND (completed = 0 OR completed_at >= ?)',
        d + 24 * 3600 * 1000,
        d,
      );
      if ((open?.n ?? 0) === 0) continue;
      if (grace > 0) {
        grace -= 1;
      } else {
        momentum = Math.ceil(momentum * MOMENTUM_COOL_FACTOR);
      }
      comeback = 1; // the next active day is a celebrated comeback
    }
  }

  if (
    grace !== p.grace ||
    graceWeek !== p.grace_week ||
    momentum !== p.momentum ||
    comeback !== p.comeback ||
    (p.last_settled_day ?? 0) < today
  ) {
    await db.runAsync(
      'UPDATE progress SET grace = ?, grace_week = ?, momentum = ?, comeback = ?, last_settled_day = ? WHERE id = 1',
      grace,
      graceWeek,
      momentum,
      comeback,
      today,
    );
    emitProgressChanged();
  }
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
  const now = Date.now();
  const day = startOfDay(now);
  await settleMomentumAsync(now);
  const before = await ensureProgressRowAsync();

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

  // First rewarded action of the day: "showed up" bonus + momentum
  // (+2 instead of +1 when it's a comeback after a gap).
  if (earned > 0 && before.last_active_day !== day) {
    const momentum =
      before.momentum + (before.comeback ? COMEBACK_MOMENTUM : 1);
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
      landed.push({
        kind: 'day_bonus',
        amount: DAY_BONUS_SPARKS,
        leveledUp: false,
        newMomentum: momentum,
      });
    }
    await db.runAsync(
      'UPDATE progress SET momentum = ?, best_momentum = MAX(best_momentum, ?), last_active_day = ?, comeback = 0 WHERE id = 1',
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

export interface WeekSummary {
  earned: number;
  completed: number;
  captured: number;
}

/** This week's totals straight from the ledger (Monday-based week). */
export async function getWeekSummaryAsync(now: number = Date.now()): Promise<WeekSummary> {
  const db = await getDb();
  const week = startOfWeek(now);
  const [earned, completed, captured] = await Promise.all([
    db.getFirstAsync<{ v: number | null }>(
      'SELECT SUM(amount) AS v FROM ledger WHERE amount > 0 AND day >= ?',
      week,
    ),
    db.getFirstAsync<{ v: number }>(
      "SELECT COUNT(*) AS v FROM ledger WHERE kind = 'complete' AND day >= ?",
      week,
    ),
    db.getFirstAsync<{ v: number }>(
      "SELECT COUNT(*) AS v FROM ledger WHERE kind = 'capture' AND day >= ?",
      week,
    ),
  ]);
  return { earned: earned?.v ?? 0, completed: completed?.v ?? 0, captured: captured?.v ?? 0 };
}

// ---------- the Spark shop ----------

export type SpendResult = 'ok' | 'insufficient' | 'owned';

/**
 * Buy a cosmetic: records the unlock, appends a negative 'spend' ledger row,
 * and bumps `progress.spent`. Spending never touches `lifetime`, so levels
 * never drop — no loss aversion anywhere in the system.
 */
export async function spendAsync(itemKey: string, cost: number): Promise<SpendResult> {
  const db = await getDb();
  const p = await ensureProgressRowAsync();
  const owned = await db.getFirstAsync<{ item_key: string }>(
    'SELECT item_key FROM unlocks WHERE item_key = ?',
    itemKey,
  );
  if (owned) return 'owned';
  if (p.lifetime - p.spent < cost) return 'insufficient';
  const now = Date.now();
  await db.runAsync(
    'INSERT INTO unlocks (item_key, cost, acquired_at) VALUES (?, ?, ?)',
    itemKey,
    cost,
    now,
  );
  await db.runAsync(
    "INSERT INTO ledger (kind, amount, assignment_id, item_key, day, created_at) VALUES ('spend', ?, NULL, ?, ?, ?)",
    -cost,
    itemKey,
    startOfDay(now),
    now,
  );
  await db.runAsync('UPDATE progress SET spent = spent + ? WHERE id = 1', cost);
  emitProgressChanged();
  return 'ok';
}

export async function listUnlocksAsync(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ item_key: string }>('SELECT item_key FROM unlocks');
  return rows.map((r) => r.item_key);
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
