// Companion state is mostly derived, minimally stored. Stored: species, name
// (settings). Derived here: stage from level, mood from live data. There is
// deliberately NO sick/dying/disappointed state — the worst the companion
// ever looks is asleep, and the first action after a gap wakes it up happy.

import { startOfDay } from '../dates';
import type { Progress } from '../types';

export type CompanionMood = 'bright' | 'alert' | 'dozing' | 'celebrating';

/** 3 stages: small → grown → radiant. Purely additive detail. */
export function stageForLevel(level: number): 1 | 2 | 3 {
  if (level >= 12) return 3;
  if (level >= 5) return 2;
  return 1;
}

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
