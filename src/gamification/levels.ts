// Level curve: gentle, front-loaded, effectively unbounded.
// level = floor((lifetime / 40) ** 0.6) + 1 — level 2 after ~1 good day,
// level 5 in week one, then slowing. Levels only ever go up.

const BASE = 40;
const EXP = 0.6;

export function levelForLifetime(lifetime: number): number {
  if (lifetime <= 0) return 1;
  return Math.floor(Math.pow(lifetime / BASE, EXP)) + 1;
}

/** Minimum lifetime Sparks required to be at `level`. */
export function lifetimeForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.ceil(Math.pow(level - 1, 1 / EXP) * BASE);
}

export interface LevelProgress {
  level: number;
  /** Sparks earned into the current level. */
  into: number;
  /** Sparks needed to go from this level to the next. */
  span: number;
  /** 0..1 progress toward the next level. */
  fraction: number;
}

export function levelProgress(lifetime: number): LevelProgress {
  const level = levelForLifetime(lifetime);
  const floor = lifetimeForLevel(level);
  const ceil = lifetimeForLevel(level + 1);
  const span = Math.max(1, ceil - floor);
  const into = Math.max(0, lifetime - floor);
  return { level, into, span, fraction: Math.min(1, into / span) };
}
