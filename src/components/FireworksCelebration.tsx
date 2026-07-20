// A little celebratory fireworks burst for the "all caught up" empty state on
// Today. Pure react-native-reanimated shape bursts (same architecture as
// SparkBurst): a few staggered waves of small dots radiate out and fade on a
// gentle continuous loop. Calm motion (OS reduced-motion / Reduce effects /
// Chill vibe) shows the plain 🎉 instead — no springs or particles. All colors
// come from theme tokens; the only literal is the emoji fallback glyph.

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useCalmMotion } from '../hooks';
import { spacing, useTheme, type ThemeColors } from '../theme';

// One full loop of the whole show; each wave takes its slice via a phase offset.
const LOOP_MS = 2400;
const PARTICLE = 7;

type ColorKey = 'spark' | 'primary' | 'upcoming' | 'today';

interface Burst {
  cx: number; // launch point, offset from the centre of the stage
  cy: number;
  phase: number; // 0..1 offset into the shared loop, so waves pop in turn
  color: ColorKey;
  n: number; // particles in the ring
  radius: number; // how far they travel
}

// Three small waves at different spots read as a fireworks display without
// being literal art. 6 + 5 + 5 = 16 particles total — plenty, and cheap.
const BURSTS: Burst[] = [
  { cx: 0, cy: -8, phase: 0, color: 'spark', n: 6, radius: 40 },
  { cx: -24, cy: 8, phase: 0.34, color: 'primary', n: 5, radius: 32 },
  { cx: 24, cy: 4, phase: 0.67, color: 'upcoming', n: 5, radius: 32 },
];

export default function FireworksCelebration() {
  const { colors } = useTheme();
  const calm = useCalmMotion();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // A single clock drives every particle so the waves stay perfectly in step.
  const clock = useSharedValue(0);
  useEffect(() => {
    if (calm) return;
    clock.value = withRepeat(withTiming(1, { duration: LOOP_MS, easing: Easing.linear }), -1, false);
  }, [clock, calm]);

  if (calm) {
    // Calm: no motion, just the familiar celebratory glyph.
    return (
      <View style={styles.stage} accessibilityLabel="All caught up" accessibilityRole="image">
        <Text style={styles.emoji}>🎉</Text>
      </View>
    );
  }

  const palette: Record<ColorKey, string> = {
    spark: colors.spark,
    primary: colors.primary,
    upcoming: colors.upcoming,
    today: colors.today,
  };

  return (
    <View style={styles.stage} accessibilityLabel="All caught up" accessibilityRole="image">
      {BURSTS.map((burst, bi) =>
        Array.from({ length: burst.n }, (_, pi) => {
          const angle = (pi / burst.n) * Math.PI * 2;
          return (
            <Spark
              key={`${bi}-${pi}`}
              clock={clock}
              angle={angle}
              burst={burst}
              color={palette[burst.color]}
            />
          );
        }),
      )}
    </View>
  );
}

function Spark({
  clock,
  angle,
  burst,
  color,
}: {
  clock: SharedValue<number>;
  angle: number;
  burst: Burst;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    // Local progress for this wave: shift the shared clock by the burst phase
    // and wrap into 0..1 so each wave repeats one launch per loop.
    let t = clock.value + burst.phase;
    t = t - Math.floor(t);
    // Ease-out travel so the ring flings out fast, then coasts.
    const eased = 1 - (1 - t) * (1 - t);
    // Quick pop-in, long fade-out.
    const opacity = t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88;
    return {
      opacity,
      transform: [
        { translateX: burst.cx + Math.cos(angle) * burst.radius * eased },
        { translateY: burst.cy + Math.sin(angle) * burst.radius * eased },
        { scale: 1 - 0.55 * t },
      ],
    };
  });

  return <Animated.View style={[sparkStyles.particle, { backgroundColor: color }, style]} />;
}

const sparkStyles = StyleSheet.create({
  particle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: PARTICLE,
    height: PARTICLE,
    borderRadius: PARTICLE / 2,
    marginTop: -PARTICLE / 2,
    marginLeft: -PARTICLE / 2,
  },
});

const makeStyles = (_colors: ThemeColors) =>
  StyleSheet.create({
    stage: {
      width: 120,
      height: 64,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    emoji: { fontSize: 44 },
  });
