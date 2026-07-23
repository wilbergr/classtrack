// First-launch picker: vibe → companion (+ optional name). The companion
// brings its signature palette with it — picking a sidekick dresses the whole
// app, so there is no separate theme step (manual themes live in Settings).
// Pre-selected to the playful set (Big / Wisp); the calm, quiet experience is
// the opt-down. Fully skippable — skipping keeps the defaults.

import React, { useCallback, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import Companion, { EnergyMeter } from '../components/Companion';
import { useBottomInset } from '../hooks';
import { setSettingAsync, updateSettingsAsync } from '../settings';
import {
  COMPANION_THEME,
  PALETTES,
  radius,
  spacing,
  useTheme,
  type ThemeColors,
} from '../theme';
import type { CompanionId, Vibe, VoicePackId } from '../types';

export const ONBOARDED_KEY = 'onboarded';

const VIBES: { id: Vibe; label: string; blurb: string }[] = [
  { id: 'hype', label: 'Big', blurb: 'Sounds, sparkles, the works' },
  { id: 'balanced', label: 'Medium', blurb: 'Subtle motion, no sound' },
  { id: 'chill', label: 'Quiet', blurb: 'Gentle fades only' },
];

const COMPANIONS: { id: CompanionId; label: string; blurb: string }[] = [
  { id: 'wisp', label: 'Wisp', blurb: 'A little flame that runs on your sparks' },
  { id: 'pip', label: 'Pip', blurb: 'Round, bouncy, endlessly pleased' },
  { id: 'juno', label: 'Juno', blurb: 'A cat. Approves of finished homework' },
  { id: 'unit7', label: 'Unit-7', blurb: 'A robot of few words' },
  { id: 'nova', label: 'Nova', blurb: 'A pocket-size superhero on your team' },
  { id: 'rex', label: 'Rex', blurb: 'A tiny dino with a mighty cheer' },
  { id: 'otto', label: 'Otto', blurb: 'A night owl who loves a good plan' },
  { id: 'none', label: 'None', blurb: 'Just a clean energy meter' },
];

const DEFAULT_NAMES: Record<Exclude<CompanionId, 'none'>, string> = {
  wisp: 'Wisp',
  pip: 'Pip',
  juno: 'Juno',
  unit7: 'Unit-7',
  nova: 'Nova',
  rex: 'Rex',
  otto: 'Otto',
};

function voiceForVibe(vibe: Vibe): VoicePackId {
  return vibe === 'hype' ? 'ember' : 'sage';
}

interface Props {
  onDone: () => void;
}

export default function OnboardingScreen({ onDone }: Props) {
  const { colors, dark } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const footerBottom = useBottomInset(spacing.xl);
  const [step, setStep] = useState(0);
  const [vibe, setVibe] = useState<Vibe>('hype');
  const [companion, setCompanion] = useState<CompanionId>('wisp');
  const [name, setName] = useState('');

  /** The signature accent each sidekick brings — shown on its chip. */
  const accentFor = useCallback(
    (id: CompanionId) => {
      const palette = PALETTES[COMPANION_THEME[id]];
      return (dark ? palette.dark : palette.light).primary;
    },
    [dark],
  );

  const finish = useCallback(
    async (skipped: boolean) => {
      if (!skipped) {
        await updateSettingsAsync({
          vibe,
          themeSource: 'companion',
          companion,
          companionName:
            companion === 'none'
              ? ''
              : name.trim() || DEFAULT_NAMES[companion as Exclude<CompanionId, 'none'>],
          soundOn: vibe === 'hype',
          voicePack: voiceForVibe(vibe),
        });
      }
      await setSettingAsync(ONBOARDED_KEY, true);
      onDone();
    },
    [vibe, companion, name, onDone],
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      // 'padding' on both platforms — see AGENTS.md keyboard-handling note
      // (Android edge-to-edge no longer auto-resizes the window for the keyboard).
      behavior="padding"
    >
      <View style={styles.topBar}>
        <Text style={styles.stepDots}>{['●○', '●●'][step]}</Text>
        <Pressable onPress={() => finish(true)} hitSlop={spacing.md} accessibilityRole="button">
          <Text style={styles.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <>
            <Text style={styles.title}>How loud should ClassTrack celebrate?</Text>
            <Text style={styles.subtitle}>You can change this anytime in Settings.</Text>
            {VIBES.map((v) => (
              <OptionRow
                key={v.id}
                label={v.label}
                blurb={v.blurb}
                selected={vibe === v.id}
                onPress={() => setVibe(v.id)}
                styles={styles}
              />
            ))}
          </>
        )}

        {step === 1 && (
          <>
            <Text style={styles.title}>Choose your sidekick</Text>
            <Text style={styles.subtitle}>
              Each one dresses the whole app in its own colors. It runs on your energy — and it
              never guilt-trips.
            </Text>
            <View style={styles.preview}>
              {companion !== 'none' ? (
                <Companion species={companion} mood="celebrating" stage={1} size={110} />
              ) : (
                <EnergyMeter fraction={0.6} width={200} />
              )}
            </View>
            <View style={styles.companionGrid}>
              {COMPANIONS.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCompanion(c.id)}
                  style={[styles.companionChip, companion === c.id && styles.companionChipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: companion === c.id }}
                >
                  <View style={[styles.companionSwatch, { backgroundColor: accentFor(c.id) }]} />
                  <Text
                    style={[
                      styles.companionChipText,
                      companion === c.id && styles.companionChipTextSelected,
                    ]}
                  >
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.blurb}>
              {COMPANIONS.find((c) => c.id === companion)?.blurb}
            </Text>
            {companion !== 'none' && (
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={`Name (or keep ${DEFAULT_NAMES[companion as Exclude<CompanionId, 'none'>]})`}
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                maxLength={24}
              />
            )}
          </>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerBottom }]}>
        {step > 0 ? (
          <Pressable onPress={() => setStep(step - 1)} hitSlop={spacing.md} accessibilityRole="button">
            <Text style={styles.back}>Back</Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          onPress={() => (step < 1 ? setStep(step + 1) : finish(false))}
          style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.nextText}>{step < 1 ? 'Next' : "Let's go ✦"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function OptionRow({
  label,
  blurb,
  selected,
  disabled,
  swatch,
  onPress,
  styles,
}: {
  label: string;
  blurb: string;
  selected: boolean;
  disabled?: boolean;
  swatch?: string;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.option, selected && styles.optionSelected, disabled && styles.optionDisabled]}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      {swatch != null && <View style={[styles.swatch, { backgroundColor: swatch }]} />}
      <View style={styles.optionBody}>
        <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{label}</Text>
        {blurb.length > 0 && <Text style={styles.optionBlurb}>{blurb}</Text>}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl * 2,
  },
  stepDots: { color: colors.primary, fontSize: 14, letterSpacing: 2 },
  skip: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  content: { padding: spacing.lg, paddingBottom: spacing.xl },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: spacing.lg },
  subtitle: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs, marginBottom: spacing.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  optionSelected: { borderColor: colors.primary },
  optionDisabled: { opacity: 0.55 },
  optionBody: { flex: 1 },
  optionLabel: { color: colors.text, fontSize: 16, fontWeight: '700' },
  optionLabelSelected: { color: colors.primary },
  optionBlurb: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  swatch: { width: 22, height: 22, borderRadius: 11, marginRight: spacing.md },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    marginLeft: spacing.md,
  },
  radioSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  preview: { alignItems: 'center', marginBottom: spacing.lg },
  companionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  companionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 999,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  companionSwatch: { width: 12, height: 12, borderRadius: 6 },
  companionChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  companionChipText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  companionChipTextSelected: { color: colors.primaryText },
  blurb: { color: colors.textMuted, fontSize: 13, marginTop: spacing.md, marginBottom: spacing.md },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.card,
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    // paddingBottom applied via useBottomInset (safe-area aware) inline.
  },
  back: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  nextButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl * 1.5,
  },
  pressed: { opacity: 0.8 },
  nextText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
});
