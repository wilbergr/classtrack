// Companion state is mostly derived, minimally stored. Stored: species, name
// (settings). Derived here: stage from level, mood from live data. There is
// deliberately NO sick/dying/disappointed state — the worst the companion
// ever looks is asleep, and the first action after a gap wakes it up happy.

import { startOfDay } from '../dates';
import type { Progress } from '../types';

export type CompanionMood = 'bright' | 'alert' | 'dozing' | 'celebrating';

export type CompanionStage = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** The last evolution stage — the single source for "final form" checks. */
export const TOP_STAGE: CompanionStage = 7;

/**
 * 7 stages on the existing lifetime-Spark level curve. Purely additive
 * detail; driven by `lifetime`, so a form can never be bought or lost.
 * Existing users only ever map upward (old stage 3 = level ≥12 → stage 4).
 * The level gaps keep widening (2, 2, 4, 5, 6, 7) so each new form takes
 * longer to earn than the last.
 */
export function stageForLevel(level: number): CompanionStage {
  if (level >= 27) return 7;
  if (level >= 20) return 6;
  if (level >= 14) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  if (level >= 3) return 2;
  return 1;
}

export const STAGE_NAMES: Record<CompanionStage, string> = {
  1: 'Hatchling',
  2: 'Sprout',
  3: 'Grown',
  4: 'Radiant',
  5: 'Luminous',
  6: 'Celestial',
  7: 'Mythic',
};

export interface MoodInputs {
  progress: Pick<Progress, 'momentum' | 'lastActiveDay'>;
  hasOverdue: boolean;
  hasDueToday: boolean;
  /** True for a few seconds after Sparks are earned. */
  justAwarded: boolean;
  now?: number;
}

export function deriveMood({
  progress,
  hasOverdue,
  hasDueToday,
  justAwarded,
  now = Date.now(),
}: MoodInputs): CompanionMood {
  if (justAwarded) return 'celebrating';
  const idleDays =
    progress.lastActiveDay == null
      ? 0
      : Math.round((startOfDay(now) - progress.lastActiveDay) / (24 * 3600 * 1000));
  if (idleDays >= 3) return 'dozing'; // asleep, not sad — wakes up delighted
  if (hasOverdue || hasDueToday) return 'alert';
  return 'bright';
}
