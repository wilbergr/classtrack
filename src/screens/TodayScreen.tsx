import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import AssignmentRow from '../components/AssignmentRow';
import EmptyState from '../components/EmptyState';
import QuickAddSheet from '../components/QuickAddSheet';
import SparkPill from '../components/SparkPill';
import { listOpenAssignmentsWithSubject, listSubjects, setAssignmentCompleted } from '../db/database';
import { dueStatus } from '../dates';
import { awardCompleteAsync } from '../gamification/engine';
import { onSpark } from '../gamification/events';
import { useCalmMotion } from '../hooks';
import type { TabScreenProps } from '../navigation';
import { refreshAssignmentRemindersAsync } from '../notifications';
import { colors, spacing } from '../theme';
import type { AssignmentWithSubject } from '../types';

interface Section {
  title: string;
  color: string;
  data: AssignmentWithSubject[];
}

export default function TodayScreen({ navigation }: TabScreenProps<'Today'>) {
  const [sections, setSections] = useState<Section[]>([]);
  const [hasSubjects, setHasSubjects] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const calm = useCalmMotion();
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <SparkPill /> });
  }, [navigation]);

  // Flash freshly-captured assignments when they land in the list.
  useEffect(() => {
    const off = onSpark((e) => {
      if (e.capturedAssignmentId == null) return;
      setHighlightId(e.capturedAssignmentId);
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
      highlightTimer.current = setTimeout(() => setHighlightId(null), 1600);
    });
    return () => {
      off();
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  const load = useCallback(async () => {
    const [assignments, subjects] = await Promise.all([
      listOpenAssignmentsWithSubject(),
      listSubjects(),
    ]);
    const overdue: AssignmentWithSubject[] = [];
    const today: AssignmentWithSubject[] = [];
    const upcoming: AssignmentWithSubject[] = [];
    for (const a of assignments) {
      const s = dueStatus(a);
      if (s === 'overdue') overdue.push(a);
      else if (s === 'today') today.push(a);
      else upcoming.push(a);
    }
    setSections(
      [
        { title: 'Overdue', color: colors.overdue, data: overdue },
        { title: 'Due today', color: colors.today, data: today },
        { title: 'Upcoming', color: colors.upcoming, data: upcoming },
      ].filter((s) => s.data.length > 0),
    );
    setHasSubjects(subjects.length > 0);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleComplete = useCallback(
    async (a: AssignmentWithSubject) => {
      const nowCompleted = !a.completed;
      await setAssignmentCompleted(a.id, nowCompleted);
      await refreshAssignmentRemindersAsync(a.id);
      if (nowCompleted) {
        await awardCompleteAsync({ id: a.id, dueAt: a.dueAt });
        // Let the checkbox bloom before the row leaves the list.
        if (!calm) await new Promise((r) => setTimeout(r, 450));
      }
      await load();
    },
    [load, calm],
  );

  const [quickAddVisible, setQuickAddVisible] = useState(false);

  const guardSubjects = useCallback(() => {
    if (hasSubjects) return true;
    Alert.alert('No subjects yet', 'Create a subject first, then add assignments to it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Go to Subjects', onPress: () => navigation.navigate('Subjects') },
    ]);
    return false;
  }, [hasSubjects, navigation]);

  /** FAB tap: the friction-free Quick Add sheet. */
  const addAssignment = useCallback(() => {
    if (guardSubjects()) setQuickAddVisible(true);
  }, [guardSubjects]);

  /** FAB long-press: straight to the full editor. */
  const addWithDetails = useCallback(() => {
    if (guardSubjects()) navigation.navigate('AssignmentEdit', {});
  }, [guardSubjects, navigation]);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <AssignmentRow
            assignment={item}
            highlight={item.id === highlightId}
            onPress={() => navigation.navigate('AssignmentEdit', { assignmentId: item.id })}
            onToggleComplete={() => toggleComplete(item)}
          />
        )}
        ListEmptyComponent={
          loaded ? (
            <EmptyState
              emoji="🎉"
              title="Nothing due"
              message={
                hasSubjects
                  ? 'You are all caught up. Add homework, tests, and projects as they come in.'
                  : 'Start by creating your subjects, then add assignments to them.'
              }
              actionLabel={hasSubjects ? 'Add assignment' : 'Create a subject'}
              onAction={hasSubjects ? addAssignment : () => navigation.navigate('Subjects')}
            />
          ) : null
        }
        stickySectionHeadersEnabled={false}
      />
      <Pressable
        onPress={addAssignment}
        onLongPress={addWithDetails}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        accessibilityRole="button"
        accessibilityLabel="Add assignment"
        accessibilityHint="Long press for the full editor"
      >
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
      <QuickAddSheet
        visible={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
        onAdded={load}
        onAllDetails={(draft) => {
          setQuickAddVisible(false);
          navigation.navigate('AssignmentEdit', { draft });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingTop: spacing.md, paddingBottom: 96, flexGrow: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  sectionCount: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  fabPressed: { opacity: 0.85 },
  fabText: { color: colors.primaryText, fontSize: 26, lineHeight: 30 },
});
