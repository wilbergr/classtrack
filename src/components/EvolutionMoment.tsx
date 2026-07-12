// The evolution moment: a one-shot overlay when lifetime Sparks carry the
// companion across a stage threshold — glow swell, silhouette crossfade from
// the old form to the new, stage name reveal. Replayable from Progress, never
// gated, never expiring. Calm motion: a plain crossfade plus the text.
// Feedback (sound/haptic) stays with SparkBurst — this is presentation only.

import React, { useEffect, useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import Companion, { type CompanionSpecies } from './Companion';
import { STAGE_NAMES, type CompanionStage } from '../gamification/companion';
import { useCalmMotion } from '../hooks';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

const COMPANION_SIZE = 200;

interface Props {
  visible: boolean;
  species: CompanionSpecies;
  accessories: string[];
  name: string;
  fromStage: CompanionStage;
  toStage: CompanionStage;
  onClose: () => void;
}

export default function EvolutionMoment({
  visible,
  species,
  accessories,
  name,
  fromStage,
  toStage,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {visible && (
          <Sequence
            species={species}
            accessories={accessories}
            name={name}
            fromStage={fromStage}
            toStage={toStage}
          />
        )}
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Continue</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Sequence({
  species,
  accessories,
  name,
  fromStage,
  toStage,
}: Omit<Props, 'visible' | 'onClose'>) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const calm = useCalmMotion();

  const glow = useSharedValue(0);
  const crossfade = useSharedValue(0); // 0 = old form, 1 = new form
  const textIn = useSharedValue(0);

  useEffect(() => {
    if (calm) {
      glow.value = 0;
      crossfade.value = withTiming(1, { duration: 700 });
      textIn.value = withDelay(500, withTiming(1, { duration: 400 }));
      return;
    }
    // Glow swells over the old form, the silhouette morphs at the peak,
    // then the glow settles and the stage name pops in.
    glow.value = withSequence(
      withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      withDelay(300, withTiming(0.25, { duration: 900, easing: Easing.out(Easing.quad) })),
    );
    crossfade.value = withDelay(800, withTiming(1, { duration: 600 }));
    textIn.value = withDelay(1500, withSpring(1, { damping: 12, stiffness: 180 }));
  }, [calm, glow, crossfade, textIn]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.5 * glow.value,
    transform: [{ scale: 0.7 + 0.7 * glow.value }],
  }));
  const oldStyle = useAnimatedStyle(() => ({ opacity: 1 - crossfade.value }));
  const newStyle = useAnimatedStyle(() => ({ opacity: crossfade.value }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: textIn.value,
    transform: [{ scale: 0.9 + 0.1 * textIn.value }],
  }));

  const tint = colors.companion[species];

  return (
    <View style={styles.sequence}>
      <View style={styles.stageArea}>
        <Animated.View style={[styles.glow, { backgroundColor: tint }, glowStyle]} />
        <Animated.View style={[StyleSheet.absoluteFill, styles.center, oldStyle]}>
          <Companion
            species={species}
            mood="bright"
            stage={fromStage}
            size={COMPANION_SIZE}
            accessories={accessories}
          />
        </Animated.View>
        <Animated.View style={[styles.center, newStyle]}>
          <Companion
            species={species}
            mood="celebrating"
            stage={toStage}
            size={COMPANION_SIZE}
            accessories={accessories}
          />
        </Animated.View>
      </View>
      <Animated.View style={[styles.textWrap, textStyle]}>
        <Text style={styles.stageName} accessibilityLiveRegion="polite">
          {STAGE_NAMES[toStage]}
        </Text>
        <Text style={styles.subtitle}>
          {name} grew — every Spark you earned did this. Nothing to do but enjoy it.
        </Text>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.bg + 'F2',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    sequence: { alignItems: 'center' },
    stageArea: {
      width: COMPANION_SIZE,
      height: COMPANION_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: { alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' },
    glow: {
      position: 'absolute',
      width: COMPANION_SIZE,
      height: COMPANION_SIZE,
      borderRadius: COMPANION_SIZE / 2,
    },
    textWrap: { alignItems: 'center', marginTop: spacing.xl },
    stageName: { color: colors.text, fontSize: 32, fontWeight: '800', letterSpacing: 1 },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      textAlign: 'center',
      marginTop: spacing.sm,
      maxWidth: 300,
      lineHeight: 20,
    },
    button: {
      marginTop: spacing.xl * 1.5,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl * 2,
      minHeight: 48,
      justifyContent: 'center',
    },
    buttonText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
  });
