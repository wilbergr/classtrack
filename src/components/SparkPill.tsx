import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { onProgressChanged, onSpark } from '../gamification/events';
import { getProgressAsync } from '../gamification/engine';
import { levelProgress } from '../gamification/levels';
import { useCalmMotion } from '../hooks';
import { spacing, useTheme, type ThemeColors } from '../theme';

const RING_SIZE = 26;
const RING_STROKE = 3;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_C = 2 * Math.PI * RING_R;

interface Props {
  onPress?: () => void;
}

/** Compact Spark counter + level ring for the Today header. */
export default function SparkPill({ onPress }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [balance, setBalance] = useState(0);
  const [level, setLevel] = useState(1);
  const [fraction, setFraction] = useState(0);
  const calm = useCalmMotion();
  const scale = useSharedValue(1);

  const refresh = useCallback(async () => {
    const p = await getProgressAsync();
    const lp = levelProgress(p.lifetime);
    setBalance(p.lifetime - p.spent);
    setLevel(lp.level);
    setFraction(lp.fraction);
  }, []);

  useEffect(() => {
    refresh();
    const offProgress = onProgressChanged(refresh);
    const offSpark = onSpark(() => {
      if (!calm) {
        scale.value = withSequence(withSpring(1.15, { damping: 12 }), withSpring(1));
      }
    });
    return () => {
      offProgress();
      offSpark();
    };
  }, [refresh, calm, scale]);

  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      hitSlop={spacing.sm}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Level ${level}, ${balance} sparks`}
      accessibilityValue={{ text: `Level ${level}, ${balance} sparks` }}
    >
      <Animated.View style={[styles.pill, animStyle]}>
        <View style={styles.ringWrap}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke={colors.border}
              strokeWidth={RING_STROKE}
              fill="none"
            />
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              stroke={colors.spark}
              strokeWidth={RING_STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${RING_C}`}
              strokeDashoffset={RING_C * (1 - fraction)}
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
            />
          </Svg>
          <Text style={styles.levelText}>{level}</Text>
        </View>
        <Text style={styles.count}>✦ {balance}</Text>
      </Animated.View>
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    gap: 6,
  },
  ringWrap: { width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  levelText: {
    position: 'absolute',
    color: colors.text,
    fontSize: 10,
    fontWeight: '800',
  },
  count: { color: colors.text, fontSize: 13, fontWeight: '700' },
});
