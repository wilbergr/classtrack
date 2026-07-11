import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { dueStatus, formatDueLabel } from '../dates';
import { colors, radius, spacing } from '../theme';
import type { AssignmentWithSubject } from '../types';
import { ASSIGNMENT_TYPE_LABELS } from '../types';

const STATUS_COLOR = {
  done: colors.done,
  overdue: colors.overdue,
  today: colors.today,
  upcoming: colors.upcoming,
} as const;

interface Props {
  assignment: AssignmentWithSubject;
  onPress: () => void;
  onToggleComplete: () => void;
  /** Hide the subject name (e.g. inside SubjectDetail where it is redundant). */
  showSubject?: boolean;
}

export default function AssignmentRow({
  assignment,
  onPress,
  onToggleComplete,
  showSubject = true,
}: Props) {
  const status = dueStatus(assignment);
  const metaParts = [
    ...(showSubject ? [assignment.subjectName] : []),
    ASSIGNMENT_TYPE_LABELS[assignment.type],
    formatDueLabel(assignment.dueAt),
  ];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${assignment.title}, ${metaParts.join(', ')}`}
    >
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
            <Text style={{ color: STATUS_COLOR[status] }}>{metaParts[metaParts.length - 1]}</Text>
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
  },
  pressed: { opacity: 0.7 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  checkboxDone: {
    backgroundColor: colors.done,
    borderColor: colors.done,
  },
  checkmark: { color: colors.primaryText, fontSize: 14, fontWeight: '700', lineHeight: 16 },
  body: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  titleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  subjectDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  meta: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
});
