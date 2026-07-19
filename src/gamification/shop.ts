// The Spark shop catalog. Everything is cosmetic; nothing expires, nothing
// is ever taken away, and there are no timed offers — buy when you feel like.

import { THEME_META } from '../theme';
import type { CelebrationStyle, ThemeId } from '../types';

export type ShopKind = 'theme' | 'accessory' | 'celebration';

export interface ShopItem {
  key: string;
  kind: ShopKind;
  label: string;
  description: string;
  cost: number;
  themeId?: ThemeId;
  celebration?: CelebrationStyle;
}

const THEME_DESCRIPTIONS: Partial<Record<ThemeId, string>> = {
  midnight: 'True dark, low glare',
  neon: 'Saturated color on black',
  paper: 'Warm, bookish off-white',
  mono: 'Near-monochrome minimal',
  ocean: 'Deep-sea blues, calm waters',
  aurora: 'Northern lights on the night sky',
};

export const SHOP_ITEMS: ShopItem[] = [
  ...THEME_META.filter((t) => !t.free).map(
    (t): ShopItem => ({
      key: `theme:${t.id}`,
      kind: 'theme',
      label: `${t.label} theme`,
      description: THEME_DESCRIPTIONS[t.id] ?? 'A fresh look for the whole app',
      cost: t.cost,
      themeId: t.id,
    }),
  ),
  {
    key: 'acc:scarf',
    kind: 'accessory',
    label: 'Scarf',
    description: 'Cozy neckwear for your sidekick',
    cost: 80,
  },
  {
    key: 'acc:bowtie',
    kind: 'accessory',
    label: 'Bow tie',
    description: 'Formal. Very serious business',
    cost: 80,
  },
  {
    key: 'acc:bell',
    kind: 'accessory',
    label: 'Bell collar',
    description: 'A tiny jingle wherever they go',
    cost: 80,
  },
  {
    key: 'acc:flower',
    kind: 'accessory',
    label: 'Flower',
    description: 'A little bloom tucked behind the ear',
    cost: 90,
  },
  {
    key: 'acc:halo',
    kind: 'accessory',
    label: 'Halo',
    description: 'For certified good influences',
    cost: 120,
  },
  {
    key: 'acc:crown',
    kind: 'accessory',
    label: 'Crown',
    description: 'Royalty, obviously',
    cost: 150,
  },
  {
    key: 'celebrate:glow',
    kind: 'celebration',
    label: 'Glow level-ups',
    description: 'A soft pulse instead of particles',
    cost: 100,
    celebration: 'glow',
  },
  {
    key: 'celebrate:rings',
    kind: 'celebration',
    label: 'Ring level-ups',
    description: 'Expanding shockwave rings',
    cost: 100,
    celebration: 'rings',
  },
  {
    key: 'celebrate:fireflies',
    kind: 'celebration',
    label: 'Firefly level-ups',
    description: 'A drift of twinkling lights',
    cost: 100,
    celebration: 'fireflies',
  },
  {
    key: 'celebrate:confetti',
    kind: 'celebration',
    label: 'Confetti level-ups',
    description: 'A flurry of falling confetti',
    cost: 120,
    celebration: 'confetti',
  },
];

/** The accessory settings key stored in AppSettings.accessories. */
export function accessoryId(itemKey: string): string {
  return itemKey.replace('acc:', '');
}
