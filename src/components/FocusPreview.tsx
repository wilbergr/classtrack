// The Home "day slot": a condensed glance at what's live, sitting under the
// companion. When something is overdue or due today it shows a short preview
// list (top few items, overdue first) with a tap-through to the full Today
// tab; when the day is clear it stays the calm one-line glance. Additive to
// Today — Home never lets you complete or restructure items, only peek.
//
// Copy rulebook: overdue is framed gently ("Up next", factual due labels), no
// shame, nothing "missed"; urgency is never color-only (the proximity text
// always carries it too).

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { EnergyMeter } from './Companion';
import { dueStatus, formatProximity, urgencyBucket } from '../dates';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { AssignmentWithSubject } from '../types';

/** Most items to preview on Home before deferring to the Today tab. */
const PREVIEW_MAX = 3;

interface Props {
  overdue: AssignmentWithSubject[];
  today: AssignmentWithSubject[];
  tomorrowCount: number;
  /** 0..1 level progress for the soft glance meter; null while loading. */
  levelFraction: number | null;
  onOpenToday: () => void;
  onOpenAssignment: (id: number) => void;
}

export default function FocusPreview({
  overdue,
  today,
  tomorrowCount,
  levelFraction,
  onOpenToday,
  onOpenAssignment,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const live = useMemo(() => [...overdue, ...today], [overdue, today]);
  const shown = live.slice(0, PREVIEW_MAX);
  const extra = live.length - shown.length;

  // Caught-up glance: nothing overdue or due today. Stays a calm one-liner.
  if (live.length === 0) {
    const label = tomorrowCount > 0 ? `Nothing due today · ${tomorrowCount} tomorrow` : 'Nothing due today';
    return (
      <Pressable
        onPress={onOpenToday}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Opens Today.`}
      >
        <View style={styles.headerRow}>
          <View style={[styles.dot, { backgroundColor: colors.done }]} />
          <Text style={styles.headerText}>{label}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
        {levelFraction != null && <EnergyMeter fraction={levelFraction} width={180} height={4} />}
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onOpenToday}
        style={({ pressed }) => [styles.headerRow, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Up next, ${live.length} ${live.length === 1 ? 'item' : 'items'}. Opens Today.`}
      >
        <Text style={styles.headerText}>Up next</Text>
        <Text style={styles.seeAll}>See today ›</Text>
      </Pressable>

      {shown.map((a) => {
        const status = dueStatus(a);
        const statusColor =
          status === 'overdue' ? colors.overdue : status === 'today' ? colors.today : colors.upcoming;
        return (
          <Pressable
            key={a.id}
            onPress={() => onOpenAssignment(a.id)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={`${a.title}, ${a.subjectName}, ${formatProximity(a.dueAt)}`}
          >
            <View style={[styles.rowDot, { backgroundColor: colors.ramp[urgencyBucket(a)] }]} />
            <Text style={styles.rowTitle} numberOfLines={1}>
              {a.title}
            </Text>
            <Text style={[styles.rowProx, { color: statusColor }]} numberOfLines={1}>
              {formatProximity(a.dueAt)}
            </Text>
          </Pressable>
        );
      })}

      {extra > 0 && (
        <Pressable
          onPress={onOpenToday}
          style={({ pressed }) => pressed && styles.pressed}
          accessibilityRole="button"
          accessibilityLabel={`${extra} more in Today`}
        >
          <Text style={styles.more}>+{extra} more in Today</Text>
        </Pressable>
      )}

      {levelFraction != null && (
        <View style={styles.meterWrap}>
          <EnergyMeter fraction={levelFraction} width={180} height={4} />
        </View>
      )}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    card: {
      alignSelf: 'stretch',
      gap: spacing.sm,
      marginTop: spacing.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    headerText: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
    seeAll: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
    chevron: { color: colors.textMuted, fontSize: 18, fontWeight: '600' },
    dot: { width: 8, height: 8, borderRadius: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 32,
    },
    rowDot: { width: 8, height: 8, borderRadius: 4 },
    rowTitle: { color: colors.text, fontSize: 14, fontWeight: '500', flex: 1 },
    rowProx: { fontSize: 12, fontWeight: '600', flexShrink: 0, maxWidth: '46%' },
    more: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginTop: 2 },
    meterWrap: { alignItems: 'center', marginTop: spacing.xs },
    pressed: { opacity: 0.7 },
  });
