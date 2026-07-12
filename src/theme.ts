// Central color + spacing tokens for ClassTrack (Layer 1).
export const colors = {
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
  spark: '#F0B429', // Spark accents (pill, toast, level ring)
  highlight: '#E3EBFE', // freshly-captured row flash
};

// Theme catalog metadata (full palettes land with the theme provider).
// Pop and Slate are free; the rest are early Spark unlocks.
export const THEME_META: {
  id: 'pop' | 'slate' | 'midnight' | 'neon' | 'paper' | 'mono';
  label: string;
  accent: string;
  free: boolean;
}[] = [
  { id: 'pop', label: 'Pop', accent: '#EC4899', free: true },
  { id: 'slate', label: 'Slate', accent: '#3B6FF5', free: true },
  { id: 'midnight', label: 'Midnight', accent: '#5B8CFF', free: false },
  { id: 'neon', label: 'Neon', accent: '#22D3EE', free: false },
  { id: 'paper', label: 'Paper', accent: '#D97706', free: false },
  { id: 'mono', label: 'Mono', accent: '#111827', free: false },
];

// Base tint per companion species (recolored per-theme once themes land).
export const companionTints = {
  wisp: '#F0B429',
  pip: '#3B6FF5',
  juno: '#8B5CF6',
  unit7: '#64748B',
};

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
