// Shared React hooks for settings + motion accessibility.

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getCachedSettings, onSettingsChange } from './settings';
import { spacing } from './theme/tokens';
import type { AppSettings } from './types';

/** Live app settings; re-renders on any settings change. */
export function useSettings(): AppSettings {
  const [s, setS] = useState<AppSettings>(getCachedSettings());
  useEffect(() => onSettingsChange(setS), []);
  return s;
}

/**
 * True when motion should be calm-grade (fades only, no springs/particles):
 * OS reduced-motion is always honored, and Reduce effects / Chill vibe
 * opt into the same behavior.
 */
export function useCalmMotion(): boolean {
  const osReduced = useReducedMotion();
  const s = useSettings();
  return osReduced || s.reduceEffects || s.vibe === 'chill';
}

/**
 * Bottom padding for scrollable content that always clears the device's system
 * navigation area (gesture bar / on-screen nav buttons). Adds the real
 * safe-area bottom inset to a base spacing, so the bottom-most control is never
 * rendered under the system nav — where it is both visually hidden and has its
 * taps swallowed by the system's own gesture zone.
 *
 * Android edge-to-edge (default since SDK 54) draws the app behind the nav bar,
 * so a hardcoded constant (e.g. `spacing.xl`) is not enough on phones whose nav
 * area is taller than it. Use this for every screen/sheet's scroll
 * `contentContainerStyle.paddingBottom`. Tab screens already sit above the tab
 * bar (which reserves the inset itself, see App.tsx), so the extra padding there
 * is harmless slack; under-padding is what hides controls, never over-padding.
 */
export function useBottomInset(base: number = spacing.xl): number {
  const { bottom } = useSafeAreaInsets();
  return base + bottom;
}
