import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { VOICE_PACK_META } from '../gamification/copy';
import { listUnlocksAsync } from '../gamification/engine';
import { useSettings } from '../hooks';
import type { TabScreenProps } from '../navigation';
import {
  ensureNotificationPermissionAsync,
  getNotificationPermissionAsync,
  refreshDailyDigestsAsync,
} from '../notifications';
import { updateSettingsAsync } from '../settings';
import { radius, spacing, THEME_META, useTheme, type ThemeColors } from '../theme';
import type { CompanionId, Vibe, VoicePackId } from '../types';

type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unknown';

const PERMISSION_LABEL: Record<PermissionState, string> = {
  granted: 'On',
  denied: 'Off — enable in system settings',
  undetermined: 'Not set up yet',
  unknown: '…',
};

const VIBE_OPTIONS: { id: Vibe; label: string }[] = [
  { id: 'hype', label: 'Big' },
  { id: 'balanced', label: 'Medium' },
  { id: 'chill', label: 'Quiet' },
];

const DARK_OPTIONS: { id: 'system' | 'on' | 'off'; label: string }[] = [
  { id: 'system', label: 'System' },
  { id: 'on', label: 'Dark' },
  { id: 'off', label: 'Light' },
];

const COMPANION_OPTIONS: { id: CompanionId; label: string }[] = [
  { id: 'wisp', label: 'Wisp' },
  { id: 'pip', label: 'Pip' },
  { id: 'juno', label: 'Juno' },
  { id: 'unit7', label: 'Unit-7' },
  { id: 'none', label: 'None' },
];

export default function SettingsScreen(_props: TabScreenProps<'Settings'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const settings = useSettings();
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [name, setName] = useState(settings.companionName);

  const refresh = useCallback(async () => {
    setPermission(await getNotificationPermissionAsync());
    setUnlocked(new Set(await listUnlocksAsync()));
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  useEffect(() => {
    setName(settings.companionName);
  }, [settings.companionName]);

  const enable = useCallback(async () => {
    if (permission === 'denied') {
      // The OS won't re-prompt; send the user to system settings.
      await Linking.openSettings();
      return;
    }
    await ensureNotificationPermissionAsync();
    await refresh();
  }, [permission, refresh]);

  const setVoicePack = useCallback(async (voicePack: VoicePackId) => {
    await updateSettingsAsync({ voicePack });
    // Future reminders re-roll on their next edit; digests re-roll now.
    refreshDailyDigestsAsync().catch(() => undefined);
  }, []);

  /** Vibe presets sound + default voice; both stay individually adjustable. */
  const setVibe = useCallback(async (vibe: Vibe) => {
    await updateSettingsAsync({
      vibe,
      soundOn: vibe === 'hype',
      voicePack: vibe === 'hype' ? 'ember' : 'sage',
    });
    refreshDailyDigestsAsync().catch(() => undefined);
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Style</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Theme</Text>
        <View style={styles.chipWrap}>
          {THEME_META.map((t) => {
            const available = t.free || unlocked.has(`theme:${t.id}`);
            const selected = settings.themeId === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => available && updateSettingsAsync({ themeId: t.id })}
                disabled={!available}
                style={[
                  styles.chip,
                  selected && styles.chipSelected,
                  !available && styles.chipLocked,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !available }}
              >
                <View style={[styles.swatch, { backgroundColor: t.accent }]} />
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {available ? t.label : `${t.label} ✦${t.cost}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>Locked themes unlock in the Spark shop (tap your Spark pill).</Text>

        <Text style={styles.fieldLabel}>Celebration size</Text>
        <View style={styles.chipWrap}>
          {VIBE_OPTIONS.map((v) => {
            const selected = settings.vibe === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => setVibe(v.id)}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {v.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Appearance</Text>
        <View style={styles.chipWrap}>
          {DARK_OPTIONS.map((d) => {
            const selected = settings.darkMode === d.id;
            return (
              <Pressable
                key={d.id}
                onPress={() => updateSettingsAsync({ darkMode: d.id })}
                style={[styles.chip, selected && styles.chipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {d.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.rowLabel}>Sound</Text>
          <Switch
            value={settings.soundOn}
            onValueChange={(v) => void updateSettingsAsync({ soundOn: v })}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.rowLabel}>Haptics</Text>
          <Switch
            value={settings.hapticsOn}
            onValueChange={(v) => void updateSettingsAsync({ hapticsOn: v })}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.rowLabel}>Reduce effects</Text>
          <Switch
            value={settings.reduceEffects}
            onValueChange={(v) => void updateSettingsAsync({ reduceEffects: v })}
          />
        </View>
        <Text style={styles.hint}>
          Reduce effects keeps every feature but calms all motion and particles. Your system's
          reduced-motion setting is always respected too.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Sidekick</Text>
      <View style={styles.card}>
        <View style={styles.chipWrap}>
          {COMPANION_OPTIONS.map((c) => {
            const selected = settings.companion === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() =>
                  updateSettingsAsync({
                    companion: c.id,
                    ...(c.id !== 'none' && !settings.companionName
                      ? { companionName: c.label }
                      : {}),
                  })
                }
                style={[styles.chip, selected && styles.chipSelected]}
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
        {settings.companion !== 'none' && (
          <>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              onEndEditing={() =>
                updateSettingsAsync({ companionName: name.trim() || settings.companionName })
              }
              placeholder="Name your sidekick"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              maxLength={24}
            />
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>Capture</Text>
      <View style={styles.card}>
        <View style={styles.switchRow}>
          <Text style={styles.rowLabel}>Voice capture</Text>
          <Switch
            value={settings.voiceCaptureOn}
            onValueChange={(v) => void updateSettingsAsync({ voiceCaptureOn: v })}
          />
        </View>
        <Text style={styles.hint}>
          Adds a mic button to Quick Add that types what you say — it never adds anything by
          itself. Heads-up: speech recognition is handled by your device's system engine, and on
          some devices that engine sends audio to its vendor (Google or Apple) to transcribe.
          ClassTrack itself never sends your data anywhere.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Reminders</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Notifications</Text>
          <Text style={styles.rowValue}>{PERMISSION_LABEL[permission]}</Text>
        </View>
        {permission !== 'granted' && (
          <Pressable
            onPress={enable}
            style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.buttonText}>
              {permission === 'denied' ? 'Open system settings' : 'Enable notifications'}
            </Text>
          </Pressable>
        )}
        <Text style={styles.hint}>
          Each assignment gets two local reminders: the evening before at 6:00 PM and the morning
          it is due at 7:30 AM. Reminders are scheduled on this device only.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Reminder voice</Text>
      <View style={styles.card}>
        {VOICE_PACK_META.map((v) => {
          const selected = settings.voicePack === v.id;
          return (
            <Pressable
              key={v.id}
              onPress={() => setVoicePack(v.id)}
              style={styles.voiceRow}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <View style={styles.voiceBody}>
                <Text style={[styles.rowLabel, selected && { color: colors.primary }]}>
                  {v.label}
                </Text>
                <Text style={styles.voiceSample} numberOfLines={1}>
                  {v.sample}
                </Text>
              </View>
              <View style={[styles.radio, selected && styles.radioSelected]} />
            </Pressable>
          );
        })}
        <Text style={styles.hint}>
          The voice your reminders and the daily digest arrive in. Digests land at 4:00 PM on days
          where tomorrow has something due — they have their own notification channel.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Your data</Text>
      <View style={styles.card}>
        <Text style={styles.bodyText}>
          Everything is stored locally on this {Platform.OS === 'ios' ? 'iPhone' : 'device'} — no
          account, no cloud, works fully offline. Deleting the app deletes your data.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>About</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>App</Text>
          <Text style={styles.rowValue}>ClassTrack</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rowValue: { color: colors.textMuted, fontSize: 15, flexShrink: 1, textAlign: 'right' },
  fieldLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    borderRadius: 999,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipLocked: { opacity: 0.55 },
  chipText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: colors.primaryText },
  swatch: { width: 14, height: 14, borderRadius: 7, marginRight: spacing.xs },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
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
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  pressed: { opacity: 0.8 },
  buttonText: { color: colors.primaryText, fontSize: 15, fontWeight: '600' },
  hint: { color: colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: spacing.md },
  bodyText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  voiceBody: { flex: 1 },
  voiceSample: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    marginLeft: spacing.md,
  },
  radioSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
});
