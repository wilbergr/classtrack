// The Home guidance system: turns the day's on-device data into a short
// prioritized queue of speech-bubble lines in the active voice pack.
// Deterministic templates — no network, no LLM, ever. Selection reuses the
// notification machinery (hash pick + persisted recent-ring) with its own
// ring key so bubbles and reminders never compete.

import { addDays, dueStatus, formatProximity, startOfDay } from '../dates';
import { getSettingAsync, setSettingAsync } from '../settings';
import { STAGE_NAMES, stageForLevel, TOP_STAGE } from './companion';
import { BUBBLES, pickTemplate, type BubbleCtx, type BubbleSlot } from './copy';
import type { ProgressSummary, WeekSummary } from './engine';
import type { SparkEvent } from './events';
import type { AssignmentWithSubject, VoicePackId } from '../types';

const RECENT_BUBBLES_KEY = 'recentBubbleTemplates';
/** Never repeat any of the last N bubble lines. */
const RECENT_RING_SIZE = 8;
/** ≥ this many due today = a "big day" (same threshold as notifications). */
const BIG_DAY_COUNT = 3;

export type UtteranceKind = BubbleSlot;

export interface Utterance {
  /** Ring key of the picked template — record it when the bubble is shown. */
  key: string;
  text: string;
  kind: UtteranceKind;
}

export interface GuidanceInputs {
  now: number;
  companionName: string;
  /** False for the "None" energy-meter home — no identity line then. */
  hasCompanion: boolean;
  packId: VoicePackId;
  assignments: AssignmentWithSubject[];
  progress: ProgressSummary;
  week: WeekSummary;
  /** True on the first Home visit of the day (drives greeting + summary). */
  firstOpenToday: boolean;
  /** True while the companion is dozing — a single sleepy line, until poked. */
  dozing: boolean;
}

/** Day-part buckets: 5–11 morning, 11–17 afternoon, 17–5 evening. */
function greetingSlot(now: number): BubbleSlot {
  const h = new Date(now).getHours();
  if (h >= 5 && h < 11) return 'greetingMorning';
  if (h >= 11 && h < 17) return 'greetingAfternoon';
  return 'greetingEvening';
}

function isWeekend(now: number): boolean {
  const d = new Date(now).getDay();
  return d === 0 || d === 6;
}

function isEvening(now: number): boolean {
  return new Date(now).getHours() >= 17;
}

/** Urgency-ordered pick of the single most relevant open item. */
export function nudgeTarget(
  assignments: AssignmentWithSubject[],
  now: number,
): AssignmentWithSubject | null {
  const open = assignments.filter((a) => !a.completed && a.dueAt >= now);
  if (open.length === 0) return null;
  // Earliest due wins; tests outrank homework at the same time (the same
  // bias urgencyBucket applies on the list).
  open.sort((a, b) => {
    const dayDiff = a.dueAt - b.dueAt;
    if (Math.abs(dayDiff) > 6 * 3600 * 1000) return dayDiff;
    if (a.type === 'test' && b.type !== 'test') return -1;
    if (b.type === 'test' && a.type !== 'test') return 1;
    return dayDiff;
  });
  return open[0];
}

export interface DayCounts {
  dueToday: number;
  dueTomorrow: number;
  overdue: number;
}

/** The glance counts used by both the bubbles and the Home day card. */
export function dayCounts(assignments: AssignmentWithSubject[], now: number): DayCounts {
  let dueToday = 0;
  let dueTomorrow = 0;
  let overdue = 0;
  const tomorrow = startOfDay(addDays(now, 1));
  for (const a of assignments) {
    const s = dueStatus(a, now);
    if (s === 'overdue') overdue += 1;
    else if (s === 'today') dueToday += 1;
    else if (s === 'upcoming' && startOfDay(a.dueAt) === tomorrow) dueTomorrow += 1;
  }
  return { dueToday, dueTomorrow, overdue };
}

export function buildBubbleCtx(inputs: GuidanceInputs): BubbleCtx {
  const { assignments, now } = inputs;
  const counts = dayCounts(assignments, now);
  const target = nudgeTarget(assignments, now);
  const stage = stageForLevel(inputs.progress.level);
  return {
    name: inputs.companionName,
    ...counts,
    nudgeTitle: target?.title ?? '',
    nudgeWhen: target ? formatProximity(target.dueAt, now) : '',
    level: inputs.progress.level,
    momentum: inputs.progress.momentum,
    earned: 0,
    stage: STAGE_NAMES[stage],
    finalForm: stage >= TOP_STAGE,
  };
}

/**
 * The prioritized bubble queue for a Home visit (§3.1 of the design):
 * comeback > greeting + day summary > nudge > overdue (gentle, last of the
 * informative lines) > ambient (wind-down / weekend / all-clear). Celebrate
 * and level-up lines are composed live from Spark events, not here.
 */
export function composeGuidance(inputs: GuidanceInputs, recent: string[]): Utterance[] {
  const ctx = buildBubbleCtx(inputs);
  const slots: BubbleSlot[] = [];

  if (inputs.dozing) {
    return pickMany(['dozing'], inputs, ctx, recent);
  }

  if (inputs.progress.comeback) slots.push('comeback');
  if (inputs.firstOpenToday) slots.push(greetingSlot(inputs.now));
  if (ctx.dueToday >= BIG_DAY_COUNT) slots.push('daySummaryBig');
  else if (ctx.dueToday > 0) slots.push('daySummary');
  if (ctx.nudgeTitle) slots.push('nudge');
  if (ctx.overdue > 0) slots.push('overdueGentle');
  // Name + stage progress lives in the rotation now that Home has no
  // name/stage label under the companion.
  if (inputs.hasCompanion) slots.push('identity');

  // Ambient filler, one flavor at most.
  if (ctx.dueToday === 0 && ctx.dueTomorrow === 0 && ctx.overdue === 0) {
    slots.push(isWeekend(inputs.now) ? 'weekend' : 'allClear');
  } else if (isEvening(inputs.now) && ctx.dueTomorrow > 0) {
    slots.push('windDown');
  }

  const out = pickMany(slots, inputs, ctx, recent);
  // Packs with sparse pools (Plain has no greetings/weekend lines) must
  // still say *something* — the day's information at minimum.
  if (out.length === 0) {
    return pickMany([ctx.dueToday > 0 ? 'daySummary' : 'allClear'], inputs, ctx, recent);
  }
  return out;
}

/** A single live line for a Spark event (celebrate / level-up). */
export function composeCelebration(
  inputs: Pick<GuidanceInputs, 'packId' | 'companionName' | 'now'>,
  event: SparkEvent,
  recent: string[],
): Utterance | null {
  const slot: BubbleSlot = event.leveledUp ? 'levelUp' : 'celebrate';
  const ctx: BubbleCtx = {
    name: inputs.companionName,
    dueToday: 0,
    dueTomorrow: 0,
    overdue: 0,
    nudgeTitle: '',
    nudgeWhen: '',
    level: event.level,
    momentum: 0,
    earned: event.total,
    stage: STAGE_NAMES[stageForLevel(event.level)],
    finalForm: stageForLevel(event.level) >= TOP_STAGE,
  };
  const us = pickOne(slot, inputs.packId, ctx, inputs.now, recent);
  return us;
}

/**
 * A single reaction line outside the queue: a poke reply, or the
 * comeback-flavored wake-up when a dozing companion is tapped.
 */
export function composeReaction(
  slot: 'idlePoke' | 'comeback' | 'evolve',
  inputs: Pick<GuidanceInputs, 'packId' | 'companionName' | 'now'>,
  level: number,
  recent: string[],
): Utterance | null {
  const ctx: BubbleCtx = {
    name: inputs.companionName,
    dueToday: 0,
    dueTomorrow: 0,
    overdue: 0,
    nudgeTitle: '',
    nudgeWhen: '',
    level,
    momentum: 0,
    earned: 0,
    stage: STAGE_NAMES[stageForLevel(level)],
    finalForm: stageForLevel(level) >= TOP_STAGE,
  };
  return pickOne(slot, inputs.packId, ctx, inputs.now, recent);
}

function pickOne(
  slot: BubbleSlot,
  packId: VoicePackId,
  ctx: BubbleCtx,
  now: number,
  recent: string[],
): Utterance | null {
  const pool = BUBBLES[packId][slot];
  if (pool.length === 0) return null;
  const seed = Math.floor(now / (24 * 3600 * 1000));
  const picked = pickTemplate(pool, `${packId}:bubble:${slot}`, seed, now, recent);
  const text = picked.value(ctx);
  if (!text) return null;
  return { key: picked.key, text, kind: slot };
}

function pickMany(
  slots: BubbleSlot[],
  inputs: GuidanceInputs,
  ctx: BubbleCtx,
  recent: string[],
): Utterance[] {
  const out: Utterance[] = [];
  const ring = [...recent];
  for (const slot of slots) {
    const u = pickOne(slot, inputs.packId, ctx, inputs.now, ring);
    if (u) {
      out.push(u);
      ring.push(u.key); // avoid picking the same line twice within one queue
    }
  }
  return out;
}

// ---------- persisted recent-ring (bubbles' own key) ----------

export async function getRecentBubblesAsync(): Promise<string[]> {
  return getSettingAsync<string[]>(RECENT_BUBBLES_KEY, []);
}

/** Record a bubble the moment it is actually shown on screen. */
export async function recordBubbleShownAsync(key: string): Promise<void> {
  const recent = await getSettingAsync<string[]>(RECENT_BUBBLES_KEY, []);
  if (recent[recent.length - 1] === key) return;
  await setSettingAsync(RECENT_BUBBLES_KEY, [...recent, key].slice(-RECENT_RING_SIZE));
}
