// The companion rig: parametric SVG (no art assets), one rig with swappable
// species shells, recolorable by theme. Animation is Reanimated transforms on
// the wrapper (breathing, hop) + a blink timer — all skipped in calm motion.

import React, { useEffect, useRef, useState } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import type { CompanionMood } from '../gamification/companion';
import { useCalmMotion } from '../hooks';
import { useTheme, type ThemeColors } from '../theme';
import type { CompanionId } from '../types';

export type CompanionSpecies = Exclude<CompanionId, 'none'>;

interface Props {
  species: CompanionSpecies;
  mood: CompanionMood;
  stage: 1 | 2 | 3;
  size: number;
  /** Equipped accessory item keys (shop unlocks): scarf / halo / bowtie. */
  accessories?: string[];
}

export default function Companion({ species, mood, stage, size, accessories = [] }: Props) {
  const { colors } = useTheme();
  const calm = useCalmMotion();
  const breath = useSharedValue(1);
  const hop = useSharedValue(0);
  const [blink, setBlink] = useState(false);

  // Breathing loop — slow and steady, slower when dozing.
  useEffect(() => {
    if (calm) {
      breath.value = 1;
      return;
    }
    const duration = mood === 'dozing' ? 2600 : 1500;
    breath.value = withRepeat(
      withTiming(1.04, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [calm, mood, breath]);

  // Blink every few seconds while awake.
  useEffect(() => {
    if (calm || mood === 'dozing') return;
    const interval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 140);
    }, 3400);
    return () => clearInterval(interval);
  }, [calm, mood]);

  // Little double-hop when celebrating.
  const prevMood = useRef(mood);
  useEffect(() => {
    if (mood === 'celebrating' && prevMood.current !== 'celebrating' && !calm) {
      hop.value = withSequence(
        withSpring(-size * 0.09, { damping: 8, stiffness: 320 }),
        withSpring(0, { damping: 10 }),
        withSpring(-size * 0.05, { damping: 8, stiffness: 320 }),
        withSpring(0, { damping: 12 }),
      );
    }
    prevMood.current = mood;
  }, [mood, calm, hop, size]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value }, { scale: breath.value }],
  }));

  const eyesClosed = blink || mood === 'dozing';

  return (
    <Animated.View
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {stage >= 3 && <Aura tint={colors.companion[species]} />}
        {species === 'wisp' && <Wisp mood={mood} stage={stage} eyesClosed={eyesClosed} c={colors} />}
        {species === 'pip' && <Pip mood={mood} stage={stage} eyesClosed={eyesClosed} c={colors} />}
        {species === 'juno' && <Juno mood={mood} stage={stage} eyesClosed={eyesClosed} c={colors} />}
        {species === 'unit7' && <Unit7 mood={mood} stage={stage} eyesClosed={eyesClosed} c={colors} />}
        <Accessories keys={accessories} c={colors} />
        {mood === 'dozing' && (
          <SvgText x={74} y={22} fontSize={16} fontWeight="bold" fill={colors.textMuted}>
            z
          </SvgText>
        )}
      </Svg>
    </Animated.View>
  );
}

interface ShellProps {
  mood: CompanionMood;
  stage: 1 | 2 | 3;
  eyesClosed: boolean;
  c: ThemeColors;
}

function Aura({ tint }: { tint: string }) {
  return <Circle cx={50} cy={56} r={45} stroke={tint} strokeOpacity={0.3} strokeWidth={2.5} fill="none" />;
}

/** Extra SVG groups for equipped shop accessories (species-generic). */
function Accessories({ keys, c }: { keys: string[]; c: ThemeColors }) {
  return (
    <G>
      {keys.includes('halo') && (
        <Ellipse cx={50} cy={7} rx={16} ry={4.5} stroke={c.spark} strokeWidth={3} fill="none" />
      )}
      {keys.includes('scarf') && (
        <G fill={c.danger}>
          <Path d="M 30 80 Q 50 90 70 80 L 70 87 Q 50 96 30 87 Z" />
          <Rect x={60} y={82} width={8} height={14} rx={3} />
        </G>
      )}
      {keys.includes('bowtie') && (
        <G fill={c.primary}>
          <Path d="M 50 84 L 38 78 L 38 90 Z" />
          <Path d="M 50 84 L 62 78 L 62 90 Z" />
          <Circle cx={50} cy={84} r={3} />
        </G>
      )}
    </G>
  );
}

/** Round eyes (closed = gentle arcs; celebrating = happy arcs). */
function Eyes({
  y,
  mood,
  closed,
  color,
  r = 4.5,
}: {
  y: number;
  mood: CompanionMood;
  closed: boolean;
  color: string;
  r?: number;
}) {
  const xs = [41, 59];
  if (closed) {
    return (
      <G>
        {xs.map((x) => (
          <Path
            key={x}
            d={`M ${x - 5} ${y} Q ${x} ${y + 4} ${x + 5} ${y}`}
            stroke={color}
            strokeWidth={2.4}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </G>
    );
  }
  if (mood === 'celebrating') {
    return (
      <G>
        {xs.map((x) => (
          <Path
            key={x}
            d={`M ${x - 5} ${y + 2} Q ${x} ${y - 5} ${x + 5} ${y + 2}`}
            stroke={color}
            strokeWidth={2.6}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </G>
    );
  }
  const rr = mood === 'alert' ? r + 1 : r;
  return (
    <G>
      {xs.map((x) => (
        <Circle key={x} cx={x} cy={y} r={rr} fill={color} />
      ))}
    </G>
  );
}

function Mouth({ y, mood, color }: { y: number; mood: CompanionMood; color: string }) {
  if (mood === 'dozing') {
    return <Line x1={46} y1={y} x2={54} y2={y} stroke={color} strokeWidth={2} strokeLinecap="round" />;
  }
  if (mood === 'alert') {
    return <Circle cx={50} cy={y} r={3} fill={color} />;
  }
  if (mood === 'celebrating') {
    return (
      <Path d={`M 42 ${y - 2} Q 50 ${y + 8} 58 ${y - 2} Z`} fill={color} />
    );
  }
  return (
    <Path
      d={`M 44 ${y} Q 50 ${y + 5} 56 ${y}`}
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      fill="none"
    />
  );
}

function Wisp({ mood, stage, eyesClosed, c }: ShellProps) {
  const tint = c.companion.wisp;
  return (
    <G>
      {stage >= 2 && (
        <G opacity={0.75}>
          <Path d="M 16 66 C 12 56 16 48 22 42 C 22 52 24 58 28 64 Z" fill={tint} />
          <Path d="M 84 66 C 88 56 84 48 78 42 C 78 52 76 58 72 64 Z" fill={tint} />
        </G>
      )}
      <Path
        d="M 50 8 C 66 26 78 40 78 58 C 78 78 65 92 50 92 C 35 92 22 78 22 58 C 22 40 34 26 50 8 Z"
        fill={tint}
      />
      <Ellipse cx={50} cy={64} rx={17} ry={15} fill="#FFFFFF" opacity={0.4} />
      <Eyes y={58} mood={mood} closed={eyesClosed} color={c.text} />
      <Mouth y={70} mood={mood} color={c.text} />
    </G>
  );
}

function Pip({ mood, stage, eyesClosed, c }: ShellProps) {
  const tint = c.companion.pip;
  return (
    <G>
      {stage >= 2 && (
        <G>
          <Line x1={50} y1={26} x2={50} y2={16} stroke={tint} strokeWidth={2.5} />
          <Ellipse cx={55} cy={13} rx={6} ry={4} fill={c.done} />
        </G>
      )}
      <Ellipse cx={50} cy={59} rx={33} ry={31} fill={tint} />
      <Ellipse cx={38} cy={44} rx={9} ry={6} fill="#FFFFFF" opacity={0.3} />
      <Circle cx={31} cy={66} r={4.5} fill="#FFFFFF" opacity={0.35} />
      <Circle cx={69} cy={66} r={4.5} fill="#FFFFFF" opacity={0.35} />
      <Eyes y={55} mood={mood} closed={eyesClosed} color="#FFFFFF" />
      <Mouth y={68} mood={mood} color="#FFFFFF" />
    </G>
  );
}

function Juno({ mood, stage, eyesClosed, c }: ShellProps) {
  const tint = c.companion.juno;
  return (
    <G>
      <Path d="M 26 44 L 22 18 L 42 32 Z" fill={tint} />
      <Path d="M 74 44 L 78 18 L 58 32 Z" fill={tint} />
      <Path d="M 27 41 L 25 25 L 38 34 Z" fill="#FFFFFF" opacity={0.35} />
      <Path d="M 73 41 L 75 25 L 62 34 Z" fill="#FFFFFF" opacity={0.35} />
      <Circle cx={50} cy={60} r={31} fill={tint} />
      {stage >= 2 && (
        <G stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={2.5} strokeLinecap="round">
          <Line x1={44} y1={33} x2={44} y2={40} />
          <Line x1={50} y1={31} x2={50} y2={39} />
          <Line x1={56} y1={33} x2={56} y2={40} />
        </G>
      )}
      <Eyes y={56} mood={mood} closed={eyesClosed} color="#FFFFFF" />
      <Path d="M 47 66 L 53 66 L 50 70 Z" fill="#FFFFFF" />
      <G stroke="#FFFFFF" strokeOpacity={0.65} strokeWidth={1.6} strokeLinecap="round">
        <Line x1={18} y1={62} x2={34} y2={64} />
        <Line x1={18} y1={70} x2={34} y2={69} />
        <Line x1={82} y1={62} x2={66} y2={64} />
        <Line x1={82} y1={70} x2={66} y2={69} />
      </G>
      <Mouth y={74} mood={mood} color="#FFFFFF" />
    </G>
  );
}

function Unit7({ mood, stage, eyesClosed, c }: ShellProps) {
  const tint = c.companion.unit7;
  return (
    <G>
      <Line x1={50} y1={30} x2={50} y2={16} stroke={tint} strokeWidth={3} />
      <Circle cx={50} cy={13} r={4.5} fill={mood === 'dozing' ? c.textMuted : c.spark} />
      {stage >= 2 && (
        <G fill={tint}>
          <Rect x={12} y={50} width={9} height={16} rx={3} />
          <Rect x={79} y={50} width={9} height={16} rx={3} />
        </G>
      )}
      <Rect x={22} y={30} width={56} height={52} rx={12} fill={tint} />
      <Rect x={28} y={38} width={44} height={36} rx={8} fill={c.text} opacity={0.85} />
      {eyesClosed ? (
        <G fill={c.spark}>
          <Rect x={36} y={52} width={10} height={2.5} rx={1.2} />
          <Rect x={54} y={52} width={10} height={2.5} rx={1.2} />
        </G>
      ) : (
        <G fill={c.spark}>
          <Rect
            x={36}
            y={mood === 'alert' ? 46 : 48}
            width={10}
            height={mood === 'alert' ? 10 : 8}
            rx={2}
          />
          <Rect
            x={54}
            y={mood === 'alert' ? 46 : 48}
            width={10}
            height={mood === 'alert' ? 10 : 8}
            rx={2}
          />
        </G>
      )}
      {mood === 'celebrating' ? (
        <Path
          d="M 40 64 Q 50 70 60 64"
          stroke={c.spark}
          strokeWidth={2.5}
          strokeLinecap="round"
          fill="none"
        />
      ) : (
        <Line x1={42} y1={66} x2={58} y2={66} stroke={c.spark} strokeWidth={2.5} strokeLinecap="round" />
      )}
    </G>
  );
}

/** The "no mascots" path: same energy, rendered as a clean meter. */
export function EnergyMeter({
  fraction,
  width,
  height = 12,
}: {
  fraction: number;
  width: number;
  height?: number;
}) {
  const { colors } = useTheme();
  const clamped = Math.max(0.04, Math.min(1, fraction));
  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} rx={height / 2} fill={colors.border} />
      <Rect
        x={0}
        y={0}
        width={Math.max(height, width * clamped)}
        height={height}
        rx={height / 2}
        fill={colors.spark}
      />
    </Svg>
  );
}
