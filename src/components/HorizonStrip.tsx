// A thin glance affordance across the top of Today: one dot per upcoming day,
// sized/colored by due-load, so "Thursday is heavy" is visible without a
// calendar. Not navigation — just information (and never color-only: the
// full summary is in the accessibility label and the weekday letters).

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { addDays } from '../dates';
import { spacing, useTheme, type ThemeColors } from '../theme';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

interface Props {
  /** Open-assignment count per day, index 0 = today, length 7. */
  loads: number[];
}

export default function HorizonStrip({ loads }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  if (loads.every((n) => n === 0)) return null;

  const now = Date.now();
  const rampByDay = [colors.ramp.today, colors.ramp.tomorrow, colors.ramp.soon, colors.ramp.soon];
  const summary = loads
    .map((n, i) => (n > 0 ? `${n} due ${i === 0 ? 'today' : i === 1 ? 'tomorrow' : dayName(addDays(now, i))}` : null))
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.strip} accessibilityLabel={`Next 7 days: ${summary}`}>
      {loads.map((n, i) => {
        const day = new Date(addDays(now, i)).getDay();
        const size = n === 0 ? 6 : Math.min(16, 8 + n * 2);
        const color = n === 0 ? colors.border : rampByDay[Math.min(i, rampByDay.length - 1)] ?? colors.ramp.safe;
        return (
          <View key={i} style={styles.dayCol}>
            <View style={styles.dotSlot}>
              <View
                style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
              />
            </View>
            <Text style={[styles.dayLetter, n > 0 && styles.dayLetterActive]}>
              {WEEKDAY_LETTERS[day]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function dayName(ts: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
    new Date(ts).getDay()
  ];
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    strip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
    },
    dayCol: { alignItems: 'center', width: 24 },
    dotSlot: { height: 18, alignItems: 'center', justifyContent: 'center' },
    dayLetter: { color: colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2, opacity: 0.6 },
    dayLetterActive: { opacity: 1 },
  });
