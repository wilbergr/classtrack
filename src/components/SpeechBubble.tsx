// The companion's mouth: a themed card with a small tail, holding real Text
// (the bubble is the screen-reader story of the day — the companion art stays
// decorative). Scale-in spring, fade-only under calm motion. The `plain`
// variant (no tail, no spring) is the "None companion" information card.

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useCalmMotion } from '../hooks';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

interface Props {
  text: string;
  /** Tap → next line. */
  onPress?: () => void;
  /** No tail, no bounce — the calm information card used with no companion. */
  plain?: boolean;
}

export default function SpeechBubble({ text, onPress, plain = false }: Props) {
  const { colors } = useTheme();
  const calm = useCalmMotion();
  const { width } = useWindowDimensions();
  const styles = React.useMemo(() => makeStyles(colors), [colors]);
  const scale = useSharedValue(calm || plain ? 1 : 0.85);
  const opacity = useSharedValue(0);

  // Re-run the entrance whenever the line changes.
  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 220 });
    if (!calm && !plain) {
      scale.value = 0.85;
      scale.value = withSpring(1, { damping: 14, stiffness: 220 });
    } else {
      scale.value = 1;
    }
  }, [text, calm, plain, opacity, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (!text) return null;

  return (
    <Animated.View style={[styles.wrap, { maxWidth: Math.min(width - spacing.xl * 2, 420) }, style]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'text'}
        accessibilityHint={onPress ? 'Shows the next message' : undefined}
      >
        <Animated.View style={[styles.card, plain && styles.cardPlain]}>
          <Text style={styles.text} accessibilityLiveRegion="polite">
            {text}
          </Text>
        </Animated.View>
        {!plain && (
          <Svg width={26} height={12} style={styles.tail}>
            {/* Fill first, then stroke only the slanted sides so no line cuts across the card. */}
            <Path d="M 1 0 L 25 0 L 10 11 Z" fill={colors.card} />
            <Path d="M 1 0 L 10 11 L 25 0" stroke={colors.border} strokeWidth={1} fill="none" />
          </Svg>
        )}
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: { alignItems: 'center' },
    card: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      elevation: 2,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    cardPlain: { borderRadius: radius.md },
    text: { color: colors.text, fontSize: 15, lineHeight: 21, textAlign: 'center' },
    tail: { alignSelf: 'center', marginTop: -1 },
  });
