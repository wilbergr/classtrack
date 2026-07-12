// Static design tokens — never vary by theme.

import type { ThemeId } from '../types';

// Palette offered when creating a subject.
export const subjectPalette = [
  '#3B6FF5', // blue
  '#16A34A', // green
  '#E5484D', // red
  '#F5A623', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#0EA5E9', // sky
  '#14B8A6', // teal
  '#F97316', // orange
  '#6B7280', // slate
];

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16 };

// Theme catalog. Pop and Slate are free; the rest are Spark unlocks.
export interface ThemeMeta {
  id: ThemeId;
  label: string;
  accent: string;
  free: boolean;
  /** Spark cost when not free. */
  cost: number;
}

export const THEME_META: ThemeMeta[] = [
  { id: 'pop', label: 'Pop', accent: '#D6336C', free: true, cost: 0 },
  { id: 'slate', label: 'Slate', accent: '#3B6FF5', free: true, cost: 0 },
  { id: 'midnight', label: 'Midnight', accent: '#5B8CFF', free: false, cost: 150 },
  { id: 'neon', label: 'Neon', accent: '#22D3EE', free: false, cost: 150 },
  { id: 'paper', label: 'Paper', accent: '#B4560F', free: false, cost: 150 },
  { id: 'mono', label: 'Mono', accent: '#171717', free: false, cost: 150 },
];
