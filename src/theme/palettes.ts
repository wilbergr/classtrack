// Full token sets per theme. Every palette defines the complete surface —
// including the urgency ramp and companion tints — so no screen ever
// hardcodes a color. Text tokens are chosen for WCAG AA against bg/card;
// ramp tokens for ≥3:1 against card. Urgency is never color-only: the due
// label text always carries the same information.

import type { ThemeId } from '../types';

export interface UrgencyRamp {
  /** >3 days out. */
  safe: string;
  /** ~48h. */
  soon: string;
  tomorrow: string;
  today: string;
  /** Static — overdue reads "still here, still doable", not sirens. */
  overdue: string;
}

export interface ThemeColors {
  bg: string;
  card: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryText: string;
  danger: string;
  overdue: string;
  today: string;
  upcoming: string;
  done: string;
  spark: string;
  highlight: string;
  ramp: UrgencyRamp;
  companion: { wisp: string; pip: string; juno: string; unit7: string };
  /**
   * Decorative day-phase tints blended into the Home ambient glow
   * (morning 5–11, evening 17–5; midday uses the companion tint alone).
   */
  dayPhase: { morning: string; evening: string };
  /** StatusBar style that reads against this bg. */
  statusBar: 'light' | 'dark';
}

interface ThemePalette {
  light: ThemeColors;
  dark: ThemeColors;
}

const RAMP_LIGHT: UrgencyRamp = {
  safe: '#5C7CFA',
  soon: '#0CA678',
  tomorrow: '#F08C00',
  today: '#E8590C',
  overdue: '#E03131',
};

const RAMP_DARK: UrgencyRamp = {
  safe: '#748FFC',
  soon: '#38D9A9',
  tomorrow: '#FFC078',
  today: '#FF922B',
  overdue: '#FF6B6B',
};

// ---------- Pop: the lively default — bright, saturated accents on light ----------

const popLight: ThemeColors = {
  bg: '#FFF5F9',
  card: '#FFFFFF',
  border: '#F2D7E4',
  text: '#33172B',
  textMuted: '#8C5F7C',
  primary: '#D6336C',
  primaryText: '#FFFFFF',
  danger: '#E03131',
  overdue: '#E03131',
  today: '#E8590C',
  upcoming: '#7048E8',
  done: '#2F9E44',
  spark: '#F08C00',
  highlight: '#FDE7F1',
  ramp: RAMP_LIGHT,
  companion: { wisp: '#F08C00', pip: '#7048E8', juno: '#D6336C', unit7: '#845EF7' },
  dayPhase: { morning: '#FFC078', evening: '#9775FA' },
  statusBar: 'dark',
};

const popDark: ThemeColors = {
  bg: '#221420',
  card: '#2E1B2A',
  border: '#4A2E43',
  text: '#F8E9F2',
  textMuted: '#C296B3',
  primary: '#F06BA8',
  primaryText: '#33091F',
  danger: '#FF6B6B',
  overdue: '#FF6B6B',
  today: '#FF922B',
  upcoming: '#9775FA',
  done: '#51CF66',
  spark: '#FFC94D',
  highlight: '#4A2440',
  ramp: RAMP_DARK,
  companion: { wisp: '#FFC94D', pip: '#9775FA', juno: '#F06BA8', unit7: '#B197FC' },
  dayPhase: { morning: '#B4713D', evening: '#7048E8' },
  statusBar: 'light',
};

// ---------- Slate: the original quiet-productivity palette ----------

const slateLight: ThemeColors = {
  bg: '#F7F8FA',
  card: '#FFFFFF',
  border: '#E4E7EC',
  text: '#1A1D23',
  textMuted: '#6B7280',
  primary: '#3B6FF5',
  primaryText: '#FFFFFF',
  danger: '#E5484D',
  overdue: '#E5484D',
  today: '#F5A623',
  upcoming: '#3B6FF5',
  done: '#16A34A',
  spark: '#F0B429',
  highlight: '#E3EBFE',
  ramp: RAMP_LIGHT,
  companion: { wisp: '#F0B429', pip: '#3B6FF5', juno: '#8B5CF6', unit7: '#64748B' },
  dayPhase: { morning: '#FFD8A8', evening: '#748FFC' },
  statusBar: 'dark',
};

const slateDark: ThemeColors = {
  bg: '#12151B',
  card: '#1B2028',
  border: '#2B323D',
  text: '#E7EAF0',
  textMuted: '#98A2B3',
  primary: '#6B95FF',
  primaryText: '#0B1526',
  danger: '#FF7078',
  overdue: '#FF7078',
  today: '#FFC24D',
  upcoming: '#6B95FF',
  done: '#4ADE80',
  spark: '#F5C044',
  highlight: '#243352',
  ramp: RAMP_DARK,
  companion: { wisp: '#F5C044', pip: '#6B95FF', juno: '#A78BFA', unit7: '#94A3B8' },
  dayPhase: { morning: '#A67C4A', evening: '#5C7CFA' },
  statusBar: 'light',
};

// ---------- Midnight: true dark, low glare (dark in both modes) ----------

const midnight: ThemeColors = {
  bg: '#0E1116',
  card: '#161C24',
  border: '#232B36',
  text: '#E6EAF0',
  textMuted: '#93A0B4',
  primary: '#5B8CFF',
  primaryText: '#0A0F1A',
  danger: '#FF6B6B',
  overdue: '#FF6B6B',
  today: '#FFA94D',
  upcoming: '#5B8CFF',
  done: '#40C057',
  spark: '#F5C044',
  highlight: '#1E2A44',
  ramp: RAMP_DARK,
  companion: { wisp: '#F5C044', pip: '#5B8CFF', juno: '#9775FA', unit7: '#8296AE' },
  dayPhase: { morning: '#8A6B3D', evening: '#4C6EF5' },
  statusBar: 'light',
};

// ---------- Neon: saturated accents on near-black (dark in both modes) ----------

const neon: ThemeColors = {
  bg: '#0A0A14',
  card: '#131322',
  border: '#272740',
  text: '#EDEBFF',
  textMuted: '#9C98C7',
  primary: '#22D3EE',
  primaryText: '#06121A',
  danger: '#FF5C7A',
  overdue: '#FF5C7A',
  today: '#FFB020',
  upcoming: '#818CF8',
  done: '#34D399',
  spark: '#FF4DD8',
  highlight: '#1D1D38',
  ramp: {
    safe: '#818CF8',
    soon: '#2DD4BF',
    tomorrow: '#FBBF24',
    today: '#FB923C',
    overdue: '#FF5C7A',
  },
  companion: { wisp: '#FF4DD8', pip: '#22D3EE', juno: '#818CF8', unit7: '#34D399' },
  dayPhase: { morning: '#FFB020', evening: '#818CF8' },
  statusBar: 'light',
};

// ---------- Paper: warm off-white ----------

const paperLight: ThemeColors = {
  bg: '#FAF6EE',
  card: '#FFFDF7',
  border: '#E8DFCB',
  text: '#3B3226',
  textMuted: '#84775E',
  primary: '#B4560F',
  primaryText: '#FFFFFF',
  danger: '#C92A2A',
  overdue: '#C92A2A',
  today: '#E8590C',
  upcoming: '#7C6A46',
  done: '#5C940D',
  spark: '#D9930D',
  highlight: '#F6E8CE',
  ramp: {
    safe: '#7C6A46',
    soon: '#66A80F',
    tomorrow: '#E8AC0E',
    today: '#E8590C',
    overdue: '#C92A2A',
  },
  companion: { wisp: '#D9930D', pip: '#B4560F', juno: '#7C6A46', unit7: '#84775E' },
  dayPhase: { morning: '#E8AC0E', evening: '#7C6A46' },
  statusBar: 'dark',
};

const paperDark: ThemeColors = {
  bg: '#211C13',
  card: '#2C261A',
  border: '#453C29',
  text: '#F0E8D8',
  textMuted: '#BBAD8F',
  primary: '#E8A552',
  primaryText: '#2A1D08',
  danger: '#FF8787',
  overdue: '#FF8787',
  today: '#FFA94D',
  upcoming: '#C6B491',
  done: '#A9E34B',
  spark: '#FFC94D',
  highlight: '#403520',
  ramp: RAMP_DARK,
  companion: { wisp: '#FFC94D', pip: '#E8A552', juno: '#C6B491', unit7: '#BBAD8F' },
  dayPhase: { morning: '#C08A3E', evening: '#6B5C3E' },
  statusBar: 'light',
};

// ---------- Mono: near-monochrome minimal ----------

const monoLight: ThemeColors = {
  bg: '#FAFAFA',
  card: '#FFFFFF',
  border: '#E5E5E5',
  text: '#171717',
  textMuted: '#6F6F6F',
  primary: '#171717',
  primaryText: '#FFFFFF',
  danger: '#7F1D1D',
  overdue: '#7F1D1D',
  today: '#404040',
  upcoming: '#8A8A8A',
  done: '#365314',
  spark: '#525252',
  highlight: '#EDEDED',
  ramp: {
    safe: '#B5B5B5',
    soon: '#8A8A8A',
    tomorrow: '#5C5C5C',
    today: '#333333',
    overdue: '#7F1D1D',
  },
  companion: { wisp: '#525252', pip: '#737373', juno: '#404040', unit7: '#8A8A8A' },
  dayPhase: { morning: '#8A8A8A', evening: '#5C5C5C' },
  statusBar: 'dark',
};

const monoDark: ThemeColors = {
  bg: '#111111',
  card: '#1B1B1B',
  border: '#2E2E2E',
  text: '#EDEDED',
  textMuted: '#9E9E9E',
  primary: '#EDEDED',
  primaryText: '#111111',
  danger: '#FCA5A5',
  overdue: '#FCA5A5',
  today: '#D4D4D4',
  upcoming: '#8A8A8A',
  done: '#BEF264',
  spark: '#C7C7C7',
  highlight: '#262626',
  ramp: {
    safe: '#5C5C5C',
    soon: '#7A7A7A',
    tomorrow: '#A3A3A3',
    today: '#D4D4D4',
    overdue: '#FCA5A5',
  },
  companion: { wisp: '#C7C7C7', pip: '#9E9E9E', juno: '#D4D4D4', unit7: '#8A8A8A' },
  dayPhase: { morning: '#7A7A7A', evening: '#9E9E9E' },
  statusBar: 'light',
};

export const PALETTES: Record<ThemeId, ThemePalette> = {
  pop: { light: popLight, dark: popDark },
  slate: { light: slateLight, dark: slateDark },
  midnight: { light: midnight, dark: midnight },
  neon: { light: neon, dark: neon },
  paper: { light: paperLight, dark: paperDark },
  mono: { light: monoLight, dark: monoDark },
};
