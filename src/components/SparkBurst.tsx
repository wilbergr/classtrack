// Global celebration overlay: floats a "+N ✦" chip when the engine awards
// Sparks, with a celebration flourish on level-ups (style is shop-selectable:
// burst / glow / rings). Also the single place where award sounds/haptics
// fire, so screens only ever call the engine.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { hapticCapture, hapticComplete, hapticLevelUp, playSound } from '../feedback';
import { onSpark, type SparkEvent } from '../gamification/events';
import { useCalmMotion, useSettings } from '../hooks';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';
import type { CelebrationStyle } from '../types';

const CHIP_MS = 1500;
const LEVEL_MS = 2200;

export default function SparkBurst() {
  const [event, setEvent] = useState<SparkEvent | null>(null);
  const [seq, setSeq] = useState(0);
  const calm = useCalmMotion();
  const { celebrationStyle } = useSettings();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const off = onSpark((e) => {
      if (e.total <= 0 && !e.leveledUp) return;
      const kinds = new Set(e.awards.map((a) => a.kind));
      if (kinds.has('complete')) {
        hapticComplete();
        playSound('complete');
      } else if (kinds.has('capture')) {
        hapticCapture();
        playSound('capture');
      }
      if (e.leveledUp) {
        hapticLevelUp();
        playSound('levelup');
      }
      AccessibilityInfo.announceForAccessibility(
        e.leveledUp ? `Plus ${e.total} sparks. Level ${e.level}!` : `Plus ${e.total} sparks.`,
      );
      setEvent(e);
      setSeq((n) => n + 1);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setEvent(null), e.leveledUp ? LEVEL_MS : CHIP_MS);
    });
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  if (!event) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Chip key={seq} event={event} calm={calm} celebrationStyle={celebrationStyle} />
    </View>
  );
}

function Chip({
  event,
  calm,
  celebrationStyle,
}: {
  event: SparkEvent;
  calm: boolean;
  celebrationStyle: CelebrationStyle;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const opacity = useSharedValue(0);
  const rise = useSharedValue(0);
  const duration = event.leveledUp ? LEVEL_MS : CHIP_MS;

  useEffect(() => {
    opacity.value = withSequence(
      withTiming(1, { duration: 160 }),
      withDelay(duration - 560, withTiming(0, { duration: 400 })),
    );
    if (!calm) {
      rise.value = withTiming(-72, { duration, easing: Easing.out(Easing.cubic) });
    }
  }, [opacity, rise, calm, duration]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: rise.value }],
  }));

  return (
    <View style={styles.anchor}>
      {event.leveledUp && !calm && <Celebration style={celebrationStyle} color={colors.spark} />}
      <Animated.View style={[styles.chip, event.leveledUp && styles.chipLevel, style]}>
        <Text style={styles.chipText}>+{event.total} ✦</Text>
        {event.leveledUp && <Text style={styles.levelText}>Level {event.level}!</Text>}
      </Animated.View>
    </View>
  );
}

function Celebration({ style, color }: { style: CelebrationStyle; color: string }) {
  if (style === 'glow') return <Glow color={color} />;
  if (style === 'rings') {
    return (
      <>
        <Ring color={color} delay={0} />
        <Ring color={color} delay={220} />
      </>
    );
  }
  return <Particles color={color} />;
}

const PARTICLE_ANGLES = Array.from({ length: 10 }, (_, i) => (i / 10) * Math.PI * 2);

function Particles({ color }: { color: string }) {
  return (
    <>
      {PARTICLE_ANGLES.map((angle, i) => (
        <Particle key={i} angle={angle} delay={i % 3 === 0 ? 60 : 0} color={color} />
      ))}
    </>
  );
}

function Particle({ angle, delay, color }: { angle: number; delay: number; color: string }) {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) }));
  }, [t, delay]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [
      { translateX: Math.cos(angle) * 56 * t.value },
      { translateY: Math.sin(angle) * 56 * t.value },
      { scale: 1 - 0.5 * t.value },
    ],
  }));

  return <Animated.View style={[particleStyles.particle, { backgroundColor: color }, style]} />;
}

function Glow({ color }: { color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), 3, true);
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 * t.value,
    transform: [{ scale: 1 + 0.4 * t.value }],
  }));
  return <Animated.View style={[particleStyles.glow, { backgroundColor: color }, style]} />;
}

function Ring({ color, delay }: { color: string; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [t, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.8 * (1 - t.value),
    transform: [{ scale: 0.4 + 1.6 * t.value }],
  }));
  return <Animated.View style={[particleStyles.ring, { borderColor: color }, style]} />;
}

const particleStyles = StyleSheet.create({
  particle: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  glow: { position: 'absolute', width: 120, height: 120, borderRadius: 60 },
  ring: { position: 'absolute', width: 90, height: 90, borderRadius: 45, borderWidth: 3 },
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    anchor: {
      position: 'absolute',
      bottom: 132,
      left: 0,
      right: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chip: {
      backgroundColor: colors.text,
      borderRadius: radius.lg,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      elevation: 6,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
    },
    chipLevel: { backgroundColor: colors.primary },
    // Inverse chip (bg = text token), so card color is always readable on it.
    chipText: { color: colors.card, fontSize: 17, fontWeight: '800' },
    levelText: { color: colors.primaryText, fontSize: 13, fontWeight: '700', marginTop: 2 },
  });
