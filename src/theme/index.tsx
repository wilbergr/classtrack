// Theme provider + hook. Every screen/component reads colors via useTheme();
// spacing/radius stay static imports from ../theme (they never vary by theme).

import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '../hooks';
import { COMPANION_THEME, PALETTES, type ThemeColors } from './palettes';

export type { ThemeColors } from './palettes';
export { COMPANION_THEME, PALETTES } from './palettes';
export * from './tokens';

interface ThemeValue {
  colors: ThemeColors;
  /** True when the resolved palette is a dark surface (drives nav + status bar). */
  dark: boolean;
}

const ThemeContext = createContext<ThemeValue>({
  colors: PALETTES.pop.light,
  dark: false,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const settings = useSettings();
  const scheme = useColorScheme();
  const wantDark =
    settings.darkMode === 'on' || (settings.darkMode === 'system' && scheme === 'dark');
  // Companion-first: the chosen sidekick's signature palette drives the app
  // look unless the user has pinned a manual theme.
  const paletteId =
    settings.themeSource === 'manual' ? settings.themeId : COMPANION_THEME[settings.companion];
  const palette = PALETTES[paletteId] ?? PALETTES.pop;
  const colors = wantDark ? palette.dark : palette.light;

  const value = useMemo<ThemeValue>(
    () => ({ colors, dark: colors.statusBar === 'light' }),
    [colors],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
