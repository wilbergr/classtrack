import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import EmptyState from '../components/EmptyState';
import {
  countOpenAssignments,
  createSubject,
  deleteSubject,
  listSubjects,
  updateSubject,
} from '../db/database';
import type { TabScreenProps } from '../navigation';
import { cancelRemindersAsync } from '../notifications';
import { radius, spacing, subjectPalette, useTheme, type ThemeColors } from '../theme';
import type { Subject } from '../types';

export default function SubjectsScreen({ navigation }: TabScreenProps<'Subjects'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [openCounts, setOpenCounts] = useState<Record<number, number>>({});
  const [loaded, setLoaded] = useState(false);

  // Editor modal state; `editing` is null when creating a new subject.
  const [editorVisible, setEditorVisible] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState(subjectPalette[0]);

  const load = useCallback(async () => {
    const [subs, counts] = await Promise.all([listSubjects(), countOpenAssignments()]);
    setSubjects(subs);
    setOpenCounts(counts);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openEditor = useCallback(
    (subject: Subject | null) => {
      setEditing(subject);
      setName(subject?.name ?? '');
      setColor(subject?.color ?? subjectPalette[subjects.length % subjectPalette.length]);
      setEditorVisible(true);
    },
    [subjects.length],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => openEditor(null)} hitSlop={spacing.md} accessibilityRole="button">
          <Text style={styles.headerAction}>＋ New</Text>
        </Pressable>
      ),
    });
  }, [navigation, openEditor, styles]);

  const save = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Give the subject a name, like “Math” or “Biology”.');
      return;
    }
    if (editing) {
      await updateSubject(editing.id, trimmed, color);
    } else {
      await createSubject(trimmed, color);
    }
    setEditorVisible(false);
    await load();
  }, [name, color, editing, load]);

  const confirmDelete = useCallback(() => {
    if (!editing) return;
    const count = openCounts[editing.id] ?? 0;
    Alert.alert(
      `Delete ${editing.name}?`,
      count > 0
        ? `This also deletes its assignments (${count} still open) and cancels their reminders.`
        : 'This also deletes any of its assignments.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const notificationIds = await deleteSubject(editing.id);
            await cancelRemindersAsync(notificationIds);
            setEditorVisible(false);
            await load();
          },
        },
      ],
    );
  }, [editing, openCounts, load]);

  return (
    <View style={styles.container}>
      <FlatList
        data={subjects}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const count = openCounts[item.id] ?? 0;
          return (
            <Pressable
              onPress={() => navigation.navigate('SubjectDetail', { subjectId: item.id })}
              onLongPress={() => openEditor(item)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${count} open`}
            >
              <View style={[styles.colorDot, { backgroundColor: item.color }]} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.rowMeta}>
                  {count === 0 ? 'Nothing open' : `${count} open`}
                </Text>
              </View>
              <Pressable
                onPress={() => openEditor(item)}
                hitSlop={spacing.md}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${item.name}`}
              >
                <Text style={styles.editIcon}>✎</Text>
              </Pressable>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          loaded ? (
            <EmptyState
              emoji="📚"
              title="No subjects yet"
              message="Subjects keep your work organized — one per class, color-coded."
              actionLabel="Create a subject"
              onAction={() => openEditor(null)}
            />
          ) : null
        }
      />

      <Modal
        visible={editorVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditorVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{editing ? 'Edit subject' : 'New subject'}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Subject name (e.g. Math)"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoFocus
              maxLength={40}
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.swatchGrid}>
              {subjectPalette.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: c === color }}
                />
              ))}
            </View>
            <View style={styles.modalButtons}>
              {editing && (
                <Pressable onPress={confirmDelete} hitSlop={spacing.sm} accessibilityRole="button">
                  <Text style={styles.deleteText}>Delete</Text>
                </Pressable>
              )}
              <View style={styles.modalButtonsRight}>
                <Pressable
                  onPress={() => setEditorVisible(false)}
                  hitSlop={spacing.sm}
                  accessibilityRole="button"
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={save}
                  style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
                  accessibilityRole="button"
                >
                  <Text style={styles.saveText}>Save</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingVertical: spacing.md, flexGrow: 1 },
  headerAction: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  pressed: { opacity: 0.7 },
  colorDot: { width: 16, height: 16, borderRadius: 8, marginRight: spacing.md },
  rowBody: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowMeta: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  editIcon: { color: colors.textMuted, fontSize: 18, paddingLeft: spacing.md },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: spacing.lg },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatch: { width: 36, height: 36, borderRadius: 18 },
  swatchSelected: { borderWidth: 3, borderColor: colors.text },
  modalButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
  },
  modalButtonsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginLeft: 'auto',
  },
  deleteText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
  cancelText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
  },
  saveText: { color: colors.primaryText, fontSize: 15, fontWeight: '600' },
});
