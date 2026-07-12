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

export const SHOP_ITEMS: ShopItem[] = [
  ...THEME_META.filter((t) => !t.free).map(
    (t): ShopItem => ({
      key: `theme:${t.id}`,
      kind: 'theme',
      label: `${t.label} theme`,
      description:
        t.id === 'midnight'
          ? 'True dark, low glare'
          : t.id === 'neon'
            ? 'Saturated color on black'
            : t.id === 'paper'
              ? 'Warm, bookish off-white'
              : 'Near-monochrome minimal',
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
    key: 'acc:halo',
    kind: 'accessory',
    label: 'Halo',
    description: 'For certified good influences',
    cost: 120,
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
];

/** The accessory settings key stored in AppSettings.accessories. */
export function accessoryId(itemKey: string): string {
  return itemKey.replace('acc:', '');
}
