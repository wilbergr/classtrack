import React, { useEffect, useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { dueStatus, formatProximity, urgencyBucket } from '../dates';
import { useCalmMotion } from '../hooks';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { AssignmentWithSubject } from '../types';
import { ASSIGNMENT_TYPE_LABELS } from '../types';

interface Props {
  assignment: AssignmentWithSubject;
  onPress: () => void;
  onToggleComplete: () => void;
  /** Hide the subject name (e.g. inside SubjectDetail where it is redundant). */
  showSubject?: boolean;
  /** Flash the row as freshly captured (slides in highlighted). */
  highlight?: boolean;
}

export default function AssignmentRow({
  assignment,
  onPress,
  onToggleComplete,
  showSubject = true,
  highlight = false,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const status = dueStatus(assignment);
  const statusColor = {
    done: colors.done,
    overdue: colors.overdue,
    today: colors.today,
    upcoming: colors.upcoming,
  }[status];
  const calm = useCalmMotion();
  // Heat ramp: the 4px left edge cools/warms with time remaining (static —
  // urgency is information, not decoration). Overdue stays static red.
  const heat = colors.ramp[urgencyBucket(assignment)];
  const metaParts = [
    ...(showSubject ? [assignment.subjectName] : []),
    ASSIGNMENT_TYPE_LABELS[assignment.type],
    formatProximity(assignment.dueAt),
  ];

  // Checkbox bloom + expanding ring when the row transitions to complete.
  const checkScale = useSharedValue(1);
  const ring = useSharedValue(0);
  const settle = useSharedValue(0);
  const prevCompleted = useRef(assignment.completed);
  useEffect(() => {
    if (assignment.completed && !prevCompleted.current) {
      if (!calm) {
        checkScale.value = withSequence(
          withSpring(1.25, { damping: 9, stiffness: 300 }),
          withSpring(1, { damping: 14 }),
        );
        ring.value = 0;
        ring.value = withTiming(1, { duration: 450 });
      }
      settle.value = withTiming(1, { duration: 350 });
    } else if (!assignment.completed && prevCompleted.current) {
      settle.value = withTiming(0, { duration: 200 });
    }
    prevCompleted.current = assignment.completed;
  }, [assignment.completed, calm, checkScale, ring, settle]);

  // Freshly-captured flash: highlight-tinted background easing back to card.
  const flash = useSharedValue(0);
  useEffect(() => {
    if (highlight) {
      flash.value = 1;
      flash.value = withTiming(0, { duration: 1100 });
    }
  }, [highlight, flash]);

  const rowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(flash.value, [0, 1], [colors.card, colors.highlight]),
    opacity: 1 - 0.35 * settle.value,
  }));
  const checkStyle = useAnimatedStyle(() => ({ transform: [{ scale: checkScale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value === 0 ? 0 : 1 - ring.value,
    transform: [{ scale: 1 + ring.value }],
  }));

  const row = (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
      accessibilityRole="button"
      accessibilityLabel={`${assignment.title}, ${metaParts.join(', ')}`}
    >
      <Animated.View style={[styles.row, rowStyle]}>
        <View style={[styles.heatEdge, { backgroundColor: heat }]} />
        <View style={styles.checkboxAnchor}>
          <Animated.View pointerEvents="none" style={[styles.ringBurst, ringStyle]} />
          <Animated.View style={checkStyle}>
            <Pressable
              onPress={onToggleComplete}
              hitSlop={spacing.md}
              style={[styles.checkbox, assignment.completed && styles.checkboxDone]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: assignment.completed }}
              accessibilityLabel={assignment.completed ? 'Mark as not done' : 'Mark as done'}
            >
              {assignment.completed && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
          </Animated.View>
        </View>

        <View style={styles.body}>
          <Text
            style={[styles.title, assignment.completed && styles.titleDone]}
            numberOfLines={1}
          >
            {assignment.title}
          </Text>
          <View style={styles.metaRow}>
            {showSubject && (
              <View style={[styles.subjectDot, { backgroundColor: assignment.subjectColor }]} />
            )}
            <Text style={styles.meta} numberOfLines={1}>
              {metaParts.slice(0, -1).join(' · ')}
              {metaParts.length > 1 ? ' · ' : ''}
              <Text style={{ color: statusColor }}>{metaParts[metaParts.length - 1]}</Text>
            </Text>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );

  if (highlight && !calm) {
    return <Animated.View entering={FadeInDown.duration(280)}>{row}</Animated.View>;
  }
  return row;
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    heatEdge: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
    },
    pressed: { opacity: 0.7 },
    checkboxAnchor: {
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: spacing.md,
      marginLeft: 2,
    },
    ringBurst: {
      position: 'absolute',
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.done,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.textMuted,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxDone: {
      backgroundColor: colors.done,
      borderColor: colors.done,
    },
    checkmark: { color: colors.card, fontSize: 14, fontWeight: '700', lineHeight: 16 },
    body: { flex: 1 },
    title: { color: colors.text, fontSize: 16, fontWeight: '600' },
    titleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
    metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    subjectDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
    meta: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  });
