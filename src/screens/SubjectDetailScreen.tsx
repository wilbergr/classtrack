import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import AssignmentRow from '../components/AssignmentRow';
import EmptyState from '../components/EmptyState';
import { getSubject, listAssignmentsForSubject, setAssignmentCompleted } from '../db/database';
import { awardCompleteAsync } from '../gamification/engine';
import { useBottomInset, useCalmMotion } from '../hooks';
import type { RootStackScreenProps } from '../navigation';
import { refreshAssignmentRemindersAsync } from '../notifications';
import { spacing, useTheme, type ThemeColors } from '../theme';
import type { AssignmentWithSubject, Subject } from '../types';

interface Section {
  title: string;
  data: AssignmentWithSubject[];
}

export default function SubjectDetailScreen({
  navigation,
  route,
}: RootStackScreenProps<'SubjectDetail'>) {
  const { subjectId } = route.params;
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [loaded, setLoaded] = useState(false);
  const calm = useCalmMotion();
  const listBottom = useBottomInset(spacing.md);

  const load = useCallback(async () => {
    const s = await getSubject(subjectId);
    if (!s) {
      // Subject was deleted while this screen was on the stack.
      navigation.goBack();
      return;
    }
    const assignments = await listAssignmentsForSubject(subjectId);
    setSubject(s);
    setSections(
      [
        { title: 'Open', data: assignments.filter((a) => !a.completed) },
        { title: 'Completed', data: assignments.filter((a) => a.completed) },
      ].filter((sec) => sec.data.length > 0),
    );
    setLoaded(true);
  }, [subjectId, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: subject?.name ?? '',
      headerRight: () => (
        <Pressable
          onPress={() => navigation.navigate('AssignmentEdit', { subjectId })}
          hitSlop={spacing.md}
          accessibilityRole="button"
        >
          <Text style={styles.headerAction}>＋ Add</Text>
        </Pressable>
      ),
    });
  }, [navigation, subject, subjectId, styles]);

  const toggleComplete = useCallback(
    async (a: AssignmentWithSubject) => {
      const nowCompleted = !a.completed;
      await setAssignmentCompleted(a.id, nowCompleted);
      await refreshAssignmentRemindersAsync(a.id);
      if (nowCompleted) {
        await awardCompleteAsync({ id: a.id, dueAt: a.dueAt });
        if (!calm) await new Promise((r) => setTimeout(r, 450));
      }
      await load();
    },
    [load, calm],
  );

  return (
    <View style={styles.container}>
      {subject && (
        <View style={styles.banner}>
          <View style={[styles.bannerDot, { backgroundColor: subject.color }]} />
          <Text style={styles.bannerText}>{subject.name}</Text>
        </View>
      )}
      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.listContent, { paddingBottom: listBottom }]}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionCount}>{section.data.length}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <AssignmentRow
            assignment={item}
            showSubject={false}
            onPress={() => navigation.navigate('AssignmentEdit', { assignmentId: item.id })}
            onToggleComplete={() => toggleComplete(item)}
          />
        )}
        ListEmptyComponent={
          loaded ? (
            <EmptyState
              emoji="📝"
              title="Nothing here yet"
              message="Add the homework, tests, and projects for this class."
              actionLabel="Add assignment"
              onAction={() => navigation.navigate('AssignmentEdit', { subjectId })}
            />
          ) : null
        }
        stickySectionHeadersEnabled={false}
      />
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  headerAction: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  bannerDot: { width: 14, height: 14, borderRadius: 7, marginRight: spacing.sm },
  bannerText: { color: colors.text, fontSize: 20, fontWeight: '700' },
  // paddingBottom applied via useBottomInset (safe-area aware) at the SectionList.
  listContent: { paddingTop: spacing.md, flexGrow: 1 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: '700', flex: 1 },
  sectionCount: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
});
