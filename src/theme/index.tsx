// Theme provider + hook. Every screen/component reads colors via useTheme();
// spacing/radius stay static imports from ../theme (they never vary by theme).

import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettings } from '../hooks';
import { PALETTES, type ThemeColors } from './palettes';

export type { ThemeColors } from './palettes';
export { PALETTES } from './palettes';
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
  const palette = PALETTES[settings.themeId] ?? PALETTES.pop;
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
