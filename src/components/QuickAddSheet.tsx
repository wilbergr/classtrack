// Friction-free capture: one autofocused title field, MRU subject chips,
// tap-to-change due chips, homework by default. "Add" commits and clears the
// sheet WITHOUT closing it, so batch entry is one title per swipe.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import VoiceCaptureButton from './VoiceCaptureButton';
import { checkTextFields } from '../contentFilter';
import { createAssignment, listAssignmentTitles, listSubjects } from '../db/database';
import { playSound } from '../feedback';
import { awardCaptureAsync } from '../gamification/engine';
import { useBottomInset, useSettings } from '../hooks';
import { refreshAssignmentRemindersAsync } from '../notifications';
import { getSettingAsync, setSettingAsync } from '../settings';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { AssignmentDraft } from '../navigation';
import type { AssignmentType, Subject } from '../types';
import { ASSIGNMENT_TYPES, ASSIGNMENT_TYPE_LABELS } from '../types';

const MRU_KEY = 'quickAddMRU';

type DueChoice = 'today' | 'tomorrow' | 'twoDays' | 'nextWeek';

const DUE_CHOICES: { key: DueChoice; label: string }[] = [
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'today', label: 'Today' },
  { key: 'twoDays', label: '2 days' },
  { key: 'nextWeek', label: 'Next week' },
];

function dueFor(choice: DueChoice): number {
  const d = new Date();
  if (choice === 'today') {
    d.setHours(23, 59, 0, 0);
  } else {
    const days = choice === 'tomorrow' ? 1 : choice === 'twoDays' ? 2 : 7;
    d.setDate(d.getDate() + days);
    d.setHours(8, 0, 0, 0); // matches the full editor's "hand it in next morning"
  }
  return d.getTime();
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after each successful add so the list behind can refresh. */
  onAdded: () => void;
  /** Open the full editor with the sheet's current values. */
  onAllDetails: (draft: AssignmentDraft) => void;
}

export default function QuickAddSheet({ visible, onClose, onAdded, onAllDetails }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { voiceCaptureOn } = useSettings();
  const sheetBottom = useBottomInset(spacing.xl);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const [due, setDue] = useState<DueChoice>('tomorrow');
  const [type, setType] = useState<AssignmentType>('homework');
  const [addedCount, setAddedCount] = useState(0);
  // Inline, non-shaming block message from the local content filter (null = clean).
  const [contentError, setContentError] = useState<string | null>(null);
  const manualPick = useRef(false);
  const inputRef = useRef<TextInput>(null);
  // subject -> lowercased first words of its past titles (inference heuristic).
  const wordMap = useRef<Map<string, number>>(new Map());

  const load = useCallback(async () => {
    const [subs, mru, titles] = await Promise.all([
      listSubjects(),
      getSettingAsync<number[]>(MRU_KEY, []),
      listAssignmentTitles(),
    ]);
    const byMru = [...subs].sort((a, b) => {
      const ia = mru.indexOf(a.id);
      const ib = mru.indexOf(b.id);
      if (ia === -1 && ib === -1) return a.name.localeCompare(b.name);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    setSubjects(byMru);
    setSubjectId((cur) => cur ?? byMru[0]?.id ?? null);
    const map = new Map<string, number>();
    for (const t of titles) {
      const w = firstWord(t.title);
      if (w && !map.has(w)) map.set(w, t.subjectId);
    }
    wordMap.current = map;
  }, []);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setDue('tomorrow');
      setType('homework');
      setAddedCount(0);
      setContentError(null);
      manualPick.current = false;
      load();
      playSound('whoosh');
    }
  }, [visible, load]);

  // Pre-highlight a subject from the typed title; never fights a manual pick.
  const onTitleChange = useCallback(
    (text: string) => {
      setTitle(text);
      if (contentError) setContentError(null);
      if (manualPick.current || subjects.length === 0) return;
      const inferred = inferSubject(text, subjects, wordMap.current);
      if (inferred != null) setSubjectId(inferred);
    },
    [subjects, contentError],
  );

  const pickSubject = useCallback((id: number) => {
    manualPick.current = true;
    setSubjectId(id);
  }, []);

  const currentDraft = useCallback(
    (): AssignmentDraft => ({
      title: title.trim(),
      subjectId,
      type,
      dueAt: dueFor(due),
    }),
    [title, subjectId, type, due],
  );

  const add = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || subjectId == null) return;
    // Local, synchronous content check (covers typed AND voice-dictated titles) —
    // see src/contentFilter.ts. Blocks inline; the sheet stays open.
    const blocked = checkTextFields([trimmed]);
    if (blocked) {
      setContentError(blocked);
      return;
    }
    const a = await createAssignment({
      subjectId,
      title: trimmed,
      type,
      dueAt: dueFor(due),
      notes: '',
    });
    await refreshAssignmentRemindersAsync(a.id);
    const mru = await getSettingAsync<number[]>(MRU_KEY, []);
    await setSettingAsync(MRU_KEY, [subjectId, ...mru.filter((x) => x !== subjectId)].slice(0, 8));
    await awardCaptureAsync(a.id);
    // Clear for the next one — the sheet stays open for batch entry.
    setTitle('');
    setType('homework');
    manualPick.current = true; // keep the chosen subject for the batch
    setAddedCount((n) => n + 1);
    inputRef.current?.focus();
    onAdded();
  }, [title, subjectId, type, due, onAdded]);

  const close = useCallback(() => {
    playSound('whoosh');
    onClose();
  }, [onClose]);

  const canAdd = title.trim().length > 0 && subjectId != null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={close} accessibilityLabel="Close" />
        {/* 'padding' on both platforms — see AGENTS.md keyboard-handling note
            (Android edge-to-edge no longer auto-resizes the window). */}
        <KeyboardAvoidingView behavior="padding">
          <View style={[styles.sheet, { paddingBottom: sheetBottom }]}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <Text style={styles.heading}>Quick add</Text>
              {addedCount > 0 && (
                <Text style={styles.addedNote}>
                  {addedCount} added ✦ keep going
                </Text>
              )}
            </View>

            <View style={styles.inputRow}>
              <TextInput
                ref={inputRef}
                value={title}
                onChangeText={onTitleChange}
                placeholder="What's the work? e.g. Wksht p. 12"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.inputFlex]}
                autoFocus
                maxLength={120}
                returnKeyType="done"
                onSubmitEditing={add}
                submitBehavior="submit"
              />
              {voiceCaptureOn && <VoiceCaptureButton onTranscript={onTitleChange} />}
            </View>

            {contentError && <Text style={styles.contentError}>{contentError}</Text>}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.chipRow}
            >
              {subjects.map((s) => {
                const selected = s.id === subjectId;
                return (
                  <Pressable
                    key={s.id}
                    onPress={() => pickSubject(s.id)}
                    style={[styles.chip, selected && { backgroundColor: s.color, borderColor: s.color }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <View
                      style={[styles.chipDot, { backgroundColor: selected ? colors.card : s.color }]}
                    />
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {s.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.rowWrap}>
              {DUE_CHOICES.map((c) => {
                const selected = c.key === due;
                return (
                  <Pressable
                    key={c.key}
                    onPress={() => setDue(c.key)}
                    style={[styles.chip, selected && styles.chipPrimary]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {c.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.rowWrap}>
              {ASSIGNMENT_TYPES.map((t) => {
                const selected = t === type;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={[styles.typeChip, selected && styles.chipPrimary]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.typeChipText, selected && styles.chipTextSelected]}>
                      {ASSIGNMENT_TYPE_LABELS[t]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.footerRow}>
              <Pressable
                onPress={() => onAllDetails(currentDraft())}
                hitSlop={spacing.sm}
                accessibilityRole="button"
              >
                <Text style={styles.allDetails}>All details →</Text>
              </Pressable>
              <Pressable
                onPress={add}
                disabled={!canAdd}
                style={({ pressed }) => [
                  styles.addButton,
                  !canAdd && styles.addButtonDisabled,
                  pressed && canAdd && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canAdd }}
              >
                <Text style={styles.addText}>Add ✦</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function firstWord(title: string): string | null {
  const w = title.trim().toLowerCase().split(/\s+/)[0];
  return w && w.length >= 3 ? w : null;
}

function inferSubject(
  text: string,
  subjects: Subject[],
  wordMap: Map<string, number>,
): number | null {
  const lower = text.trim().toLowerCase();
  if (lower.length < 3) return null;
  // Subject name mentioned (or being typed) anywhere in the title.
  for (const s of subjects) {
    const name = s.name.toLowerCase();
    if (lower.includes(name) || name.startsWith(lower)) return s.id;
  }
  // First word matches the first word of a past title in some subject.
  const w = firstWord(lower);
  if (w != null) {
    const hit = wordMap.get(w);
    if (hit != null && subjects.some((s) => s.id === hit)) return hit;
  }
  return null;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    // paddingBottom applied via useBottomInset (safe-area aware) inline.
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  heading: { color: colors.text, fontSize: 17, fontWeight: '700' },
  addedNote: { color: colors.done, fontSize: 13, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
  },
  inputFlex: { flex: 1 },
  // Calm, non-shaming block notice (copy rulebook): muted tone, not alarm-red.
  contentError: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  chipRow: { gap: spacing.sm, paddingVertical: spacing.md },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  chipPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.xs },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: colors.primaryText },
  typeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: 'center',
  },
  typeChipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  allDetails: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  addButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl * 1.5,
    minHeight: 44,
    justifyContent: 'center',
  },
  addButtonDisabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  addText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
});
