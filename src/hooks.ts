// Shared React hooks for settings + motion accessibility.

import { useEffect, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { getCachedSettings, onSettingsChange } from './settings';
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
