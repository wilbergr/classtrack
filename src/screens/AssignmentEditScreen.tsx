import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useHeaderHeight } from '@react-navigation/elements';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createAssignment,
  deleteAssignment,
  getAssignmentWithSubject,
  listSubjects,
  updateAssignment,
} from '../db/database';
import { formatDayLabel, formatTime } from '../dates';
import type { RootStackScreenProps } from '../navigation';
import { cancelRemindersAsync, refreshAssignmentRemindersAsync } from '../notifications';
import { colors, radius, spacing } from '../theme';
import type { AssignmentType, Subject } from '../types';
import { ASSIGNMENT_TYPES, ASSIGNMENT_TYPE_LABELS } from '../types';

/** Default due: tomorrow at 8:00 AM — the typical "hand it in next morning". */
function defaultDue(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d;
}

export default function AssignmentEditScreen({
  navigation,
  route,
}: RootStackScreenProps<'AssignmentEdit'>) {
  const assignmentId = route.params?.assignmentId;
  const presetSubjectId = route.params?.subjectId;
  const isEditing = assignmentId != null;

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<number | null>(presetSubjectId ?? null);
  const [type, setType] = useState<AssignmentType>('homework');
  const [due, setDue] = useState<Date>(defaultDue);
  const [notes, setNotes] = useState('');
  const [notificationIds, setNotificationIds] = useState<string[]>([]);
  const [completed, setCompleted] = useState(false);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [ready, setReady] = useState(false);

  const headerHeight = useHeaderHeight();
  const scrollRef = useRef<ScrollView>(null);
  const notesFocused = useRef(false);

  // Notes sits at the bottom of the form; neither platform scrolls it into view on its own
  // once the keyboard shrinks the viewport (Android resize / iOS KeyboardAvoidingView padding).
  const scrollNotesIntoView = useCallback(() => {
    if (notesFocused.current) scrollRef.current?.scrollToEnd({ animated: true });
  }, []);

  useEffect(() => {
    // Fires after the viewport has resized, so scrollToEnd targets the shrunken layout.
    const sub = Keyboard.addListener('keyboardDidShow', scrollNotesIntoView);
    return () => sub.remove();
  }, [scrollNotesIntoView]);

  useEffect(() => {
    (async () => {
      const subs = await listSubjects();
      setSubjects(subs);
      if (isEditing) {
        const a = await getAssignmentWithSubject(assignmentId);
        if (a) {
          setTitle(a.title);
          setSubjectId(a.subjectId);
          setType(a.type);
          setDue(new Date(a.dueAt));
          setNotes(a.notes);
          setNotificationIds(a.notificationIds);
          setCompleted(a.completed);
        }
      } else if (presetSubjectId == null && subs.length > 0) {
        setSubjectId(subs[0].id);
      }
      setReady(true);
    })();
  }, [assignmentId, isEditing, presetSubjectId]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEditing ? 'Edit assignment' : 'New assignment' });
  }, [navigation, isEditing]);

  const onPickerChange = useCallback((event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') setPicker(null);
    if (event.type !== 'dismissed' && selected) setDue(selected);
  }, []);

  const save = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('Title required', 'What is the assignment? e.g. “Read chapter 4”.');
      return;
    }
    if (subjectId == null) {
      Alert.alert('Subject required', 'Pick which class this belongs to.');
      return;
    }
    const input = {
      subjectId,
      title: trimmed,
      type,
      dueAt: due.getTime(),
      notes: notes.trim(),
    };
    let id = assignmentId;
    if (isEditing && id != null) {
      await updateAssignment(id, input);
    } else {
      id = (await createAssignment(input)).id;
    }
    // Cancels stale reminders and schedules evening-before + morning-of.
    await refreshAssignmentRemindersAsync(id);
    navigation.goBack();
  }, [title, subjectId, type, due, notes, assignmentId, isEditing, navigation]);

  const confirmDelete = useCallback(() => {
    if (assignmentId == null) return;
    Alert.alert('Delete assignment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const ids = await deleteAssignment(assignmentId);
          await cancelRemindersAsync(ids);
          navigation.goBack();
        },
      },
    ]);
  }, [assignmentId, navigation]);

  if (!ready) return <View style={styles.container} />;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // Android resizes the window itself (softwareKeyboardLayoutMode: resize);
      // adding padding there too would double-compensate.
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.fieldLabel}>Title</Text>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Worksheet p. 12–14"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          autoFocus={!isEditing}
          maxLength={120}
        />

        <Text style={styles.fieldLabel}>Subject</Text>
        <View style={styles.chipWrap}>
          {subjects.map((s) => {
            const selected = s.id === subjectId;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSubjectId(s.id)}
                style={[styles.chip, selected && { backgroundColor: s.color, borderColor: s.color }]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <View style={[styles.chipDot, { backgroundColor: selected ? colors.card : s.color }]} />
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s.name}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Type</Text>
        <View style={styles.chipWrap}>
          {ASSIGNMENT_TYPES.map((t) => {
            const selected = t === type;
            return (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[styles.chip, selected && styles.chipPrimary]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {ASSIGNMENT_TYPE_LABELS[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Due</Text>
        <View style={styles.dueRow}>
          <Pressable
            onPress={() => setPicker(picker === 'date' ? null : 'date')}
            style={styles.dueButton}
            accessibilityRole="button"
          >
            <Text style={styles.dueButtonText}>{formatDayLabel(due.getTime())}</Text>
          </Pressable>
          <Pressable
            onPress={() => setPicker(picker === 'time' ? null : 'time')}
            style={styles.dueButton}
            accessibilityRole="button"
          >
            <Text style={styles.dueButtonText}>{formatTime(due.getTime())}</Text>
          </Pressable>
        </View>
        {picker && (
          <DateTimePicker
            value={due}
            mode={picker}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPickerChange}
          />
        )}
        <Text style={styles.hint}>
          Reminders: the evening before at 6:00 PM and the morning of at 7:30 AM.
        </Text>

        <Text style={styles.fieldLabel}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Anything to remember — pages, materials, topics…"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.notesInput]}
          multiline
          maxLength={2000}
          onFocus={() => {
            notesFocused.current = true;
            scrollNotesIntoView(); // keyboard may already be up (focus moved from another field)
          }}
          onBlur={() => {
            notesFocused.current = false;
          }}
        />

        <Pressable
          onPress={save}
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.saveText}>{isEditing ? 'Save changes' : 'Add assignment'}</Text>
        </Pressable>

        {isEditing && (
          <Pressable
            onPress={confirmDelete}
            style={({ pressed }) => [styles.deleteButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.deleteText}>Delete assignment</Text>
          </Pressable>
        )}
        {isEditing && completed && (
          <Text style={styles.hint}>
            This assignment is marked complete{notificationIds.length ? '' : ' — no reminders scheduled'}.
          </Text>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  notesInput: { minHeight: 88, textAlignVertical: 'top' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: colors.primaryText },
  dueRow: { flexDirection: 'row', gap: spacing.sm },
  dueButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dueButtonText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, lineHeight: 17 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md + 2,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  pressed: { opacity: 0.8 },
  saveText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
  deleteButton: { alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.sm },
  deleteText: { color: colors.danger, fontSize: 15, fontWeight: '600' },
});
