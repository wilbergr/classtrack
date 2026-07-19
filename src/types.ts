// Core domain types for ClassTrack Layer 1.

export type AssignmentType = 'homework' | 'test' | 'project';

export const ASSIGNMENT_TYPES: AssignmentType[] = ['homework', 'test', 'project'];

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  homework: 'Homework',
  test: 'Test',
  project: 'Project',
};

export interface Subject {
  id: number;
  name: string;
  color: string;
  createdAt: number; // epoch ms
}

export interface Assignment {
  id: number;
  subjectId: number;
  title: string;
  type: AssignmentType;
  dueAt: number; // epoch ms, local due date & time
  notes: string;
  completed: boolean;
  completedAt: number | null; // epoch ms when marked complete; null while open
  notificationIds: string[]; // ids of scheduled local reminders
  createdAt: number; // epoch ms
}

/** Assignment joined with its subject's display fields (for Today / rows). */
export interface AssignmentWithSubject extends Assignment {
  subjectName: string;
  subjectColor: string;
}

/** Fields the user edits; everything else is managed by the DB layer. */
export interface AssignmentInput {
  subjectId: number;
  title: string;
  type: AssignmentType;
  dueAt: number;
  notes: string;
}

// ---------- Spark (gamification) ----------

/** Cached rollup of the ledger; the single row of the `progress` table. */
export interface Progress {
  lifetime: number; // total Sparks ever earned — never decreases; drives level
  spent: number; // Sparks spent on cosmetics; balance = lifetime - spent
  momentum: number; // current momentum (active days)
  bestMomentum: number;
  grace: number; // grace tokens in hand (cap 2, refill weekly)
  lastActiveDay: number | null; // startOfDay epoch ms of last Spark-earning action
  /** Armed after a gap: the next active day is a celebrated comeback. */
  comeback: boolean;
}

export type SparkKind = 'capture' | 'complete' | 'on_time' | 'day_bonus' | 'spend';

/** One award, as returned by the engine — what the UI animates. */
export interface SparkAward {
  kind: SparkKind;
  amount: number;
  leveledUp: boolean;
  newMomentum?: number;
}

export type Vibe = 'hype' | 'balanced' | 'chill';
export type CompanionId = 'wisp' | 'pip' | 'juno' | 'unit7' | 'nova' | 'rex' | 'otto' | 'none';
export type VoicePackId = 'ember' | 'sage' | 'dot' | 'plain';
/**
 * Palette ids. pop…mono are the classic manually-picked themes (Spark
 * unlocks); ember/meadow/dusk/circuit/rocket/lagoon/nocturne are the
 * companions' signature palettes, applied automatically while `themeSource`
 * is 'companion'.
 */
export type ThemeId =
  | 'pop'
  | 'slate'
  | 'midnight'
  | 'neon'
  | 'paper'
  | 'mono'
  | 'ocean'
  | 'aurora'
  | 'ember'
  | 'meadow'
  | 'dusk'
  | 'circuit'
  | 'rocket'
  | 'lagoon'
  | 'nocturne';
/**
 * What drives the app palette: the chosen companion's signature look
 * (default) or a manually picked `themeId`.
 */
export type ThemeSource = 'companion' | 'manual';
/** How level-ups celebrate (shop-unlockable beyond 'burst'). */
export type CelebrationStyle = 'burst' | 'glow' | 'rings' | 'fireflies' | 'confetti';

export interface AppSettings {
  vibe: Vibe;
  /** Companion look by default; 'manual' pins `themeId` instead. */
  themeSource: ThemeSource;
  /** The manually picked palette, used only while `themeSource` is 'manual'. */
  themeId: ThemeId;
  darkMode: 'system' | 'on' | 'off';
  companion: CompanionId;
  companionName: string;
  /** Which tab the app opens on. Home (the companion) is the default; Today is the list-first opt-down. */
  launchScreen: 'home' | 'today';
  voicePack: VoicePackId;
  soundOn: boolean;
  hapticsOn: boolean;
  reduceEffects: boolean;
  celebrationStyle: CelebrationStyle;
  /** Equipped companion accessory item keys. */
  accessories: string[];
  /**
   * Mic-to-title on Quick Add. Default OFF: on some devices the OS speech
   * engine routes audio through vendor servers — an OS behavior, not an app
   * network call, disclosed next to the toggle.
   */
  voiceCaptureOn: boolean;
}
