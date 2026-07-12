// The companion, Rig v2: a parametric layered model (companion/model.ts)
// drawn by a swappable draw layer (SvgRigLayer) and animated exclusively via
// Reanimated transforms on wrapper Animated.Views — squash-and-stretch
// breathing with per-layer phase lag, wandering eye-tracking pupils,
// asymmetric blinks, pulsing aura, celebrate hop. SVG props only ever change
// at low frequency (blink/mood/stage) via React state — the New-Architecture
// safe pattern. All motion is gated by useCalmMotion().

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Rect } from 'react-native-svg';

import SvgRigLayer from './companion/SvgRigLayer';
import { buildRig, type RigLayer, type RigModel } from './companion/model';
import type { CompanionMood, CompanionStage } from '../gamification/companion';
import { useCalmMotion } from '../hooks';
import { useTheme } from '../theme';
import type { CompanionId } from '../types';

export type CompanionSpecies = Exclude<CompanionId, 'none'>;

interface Props {
  species: CompanionSpecies;
  mood: CompanionMood;
  stage: CompanionStage;
  size: number;
  /** Equipped accessory item keys (shop unlocks): scarf / halo / bowtie. */
  accessories?: string[];
}

export default function Companion({ species, mood, stage, size, accessories = [] }: Props) {
  const { colors } = useTheme();
  const calm = useCalmMotion();
  const [blink, setBlink] = useState(false);
  const breath = useSharedValue(0); // loops 0→1; layers read sin(2π·t) with phase
  const pulse = useSharedValue(0); // slower loop for aura/glow layers
  const hop = useSharedValue(0);
  const lookX = useSharedValue(0); // normalized -1..1 pupil wander target
  const lookY = useSharedValue(0);

  // Breathing loop — a continuous phase, slower when dozing.
  useEffect(() => {
    if (calm) {
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }
    const duration = mood === 'dozing' ? 5200 : 3000;
    breath.value = 0;
    breath.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(breath);
  }, [calm, mood, breath]);

  useEffect(() => {
    if (calm) {
      cancelAnimation(pulse);
      pulse.value = 0;
      return;
    }
    pulse.value = 0;
    pulse.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(pulse);
  }, [calm, pulse]);

  // Blinks: irregular, occasionally double; Juno is a famous slow-blinker.
  useEffect(() => {
    if (calm || mood === 'dozing') return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const closeMs = species === 'juno' ? 240 : 130;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => {
          if (!alive) return;
          setBlink(false);
          // ~1 in 5 blinks is a quick double.
          if (Math.random() < 0.2) {
            setTimeout(() => alive && setBlink(true), 120);
            setTimeout(() => alive && setBlink(false), 120 + closeMs);
          }
        }, closeMs);
        schedule();
      }, 2600 + Math.random() * 2400);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [calm, mood, species]);

  // Eye life: pupils wander toward a soft target, often re-centering.
  useEffect(() => {
    if (calm || mood === 'dozing') {
      lookX.value = 0;
      lookY.value = 0;
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const wander = () => {
      if (!alive) return;
      const recenter = Math.random() < 0.4;
      const tx = recenter ? 0 : Math.random() * 2 - 1;
      const ty = recenter ? 0 : (Math.random() * 2 - 1) * 0.6;
      lookX.value = withTiming(tx, { duration: 650, easing: Easing.out(Easing.quad) });
      lookY.value = withTiming(ty, { duration: 650, easing: Easing.out(Easing.quad) });
      timer = setTimeout(wander, 2200 + Math.random() * 2600);
    };
    timer = setTimeout(wander, 1000);
    return () => {
      alive = false;
      clearTimeout(timer);
      lookX.value = withTiming(0, { duration: 300 });
      lookY.value = withTiming(0, { duration: 300 });
    };
  }, [calm, mood, lookX, lookY]);

  // Luminous companions do a tiny celebratory bounce every ~30 s.
  useEffect(() => {
    if (calm || stage < 5 || mood === 'dozing') return;
    const interval = setInterval(() => {
      hop.value = withSequence(
        withSpring(-size * 0.035, { damping: 9, stiffness: 300 }),
        withSpring(0, { damping: 12 }),
      );
    }, 30000);
    return () => clearInterval(interval);
  }, [calm, stage, mood, hop, size]);

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

  const eyesClosed = blink || mood === 'dozing';
  const model: RigModel = React.useMemo(
    () => buildRig({ species, stage, mood, eyesClosed, colors, accessories }),
    [species, stage, mood, eyesClosed, colors, accessories],
  );

  const rootStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hop.value }, { scale: model.baseScale }],
  }));

  return (
    <Animated.View
      style={[{ width: size, height: size }, rootStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {model.layers.map((layer) => (
        <RigLayerView
          key={layer.id}
          layer={layer}
          size={size}
          breath={breath}
          pulse={pulse}
          calm={calm}
        />
      ))}
      {model.pupils && (
        <PupilLayer
          pupils={model.pupils}
          size={size}
          lookX={lookX}
          lookY={lookY}
          breath={breath}
          calm={calm}
        />
      )}
      {model.motes && !calm && <AmbientMotes tint={colors.companion[species]} size={size} />}
    </Animated.View>
  );
}

// ---------- ambient motes (stages 4–5) ----------

interface MoteSpec {
  left: number; // fraction of size
  top: number;
  r: number;
  durationMs: number;
  delayMs: number;
}

const MOTE_SPECS: MoteSpec[] = [
  { left: 0.12, top: 0.62, r: 2.5, durationMs: 3800, delayMs: 0 },
  { left: 0.85, top: 0.55, r: 2, durationMs: 4400, delayMs: 900 },
  { left: 0.2, top: 0.3, r: 1.8, durationMs: 5000, delayMs: 1800 },
  { left: 0.78, top: 0.22, r: 2.2, durationMs: 4200, delayMs: 600 },
  { left: 0.5, top: 0.08, r: 1.6, durationMs: 4800, delayMs: 1400 },
];

/** Drifting tint dots: rise, fade, repeat. Skipped entirely in calm motion. */
function AmbientMotes({ tint, size }: { tint: string; size: number }) {
  return (
    <>
      {MOTE_SPECS.map((m, i) => (
        <Mote key={i} spec={m} tint={tint} size={size} />
      ))}
    </>
  );
}

function Mote({ spec, tint, size }: { spec: MoteSpec; tint: string; size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = 0;
    t.value = withRepeat(
      withTiming(1, { duration: spec.durationMs, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [t, spec.durationMs]);
  const style = useAnimatedStyle(() => {
    const phase = (t.value + spec.delayMs / spec.durationMs) % 1;
    return {
      opacity: phase < 0.5 ? phase * 1.4 : (1 - phase) * 1.4,
      transform: [{ translateY: -phase * size * 0.12 }],
    };
  });
  const d = spec.r * 2 * (size / 100);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: spec.left * size,
          top: spec.top * size,
          width: d,
          height: d,
          borderRadius: d / 2,
          backgroundColor: tint,
        },
        style,
      ]}
    />
  );
}

/** One rig layer: static SVG inside an independently-animated wrapper. */
function RigLayerView({
  layer,
  size,
  breath,
  pulse,
  calm,
}: {
  layer: RigLayer;
  size: number;
  breath: SharedValue<number>;
  pulse: SharedValue<number>;
  calm: boolean;
}) {
  const style = useAnimatedStyle(() => {
    if (layer.pulse) {
      const p = calm ? 0.5 : Math.sin(pulse.value * Math.PI * 2) * 0.5 + 0.5;
      return {
        opacity: 0.7 + 0.3 * p,
        transform: [{ scale: 1 + 0.05 * p }],
      };
    }
    const s = calm ? 0 : Math.sin((breath.value + layer.breathPhase) * Math.PI * 2) * layer.breathAmp;
    const scaleX = 1 + s;
    const scaleY = 1 - s * 0.85;
    const sway = layer.sway ?? 0;
    const rot = calm || sway === 0 ? 0 : Math.sin((breath.value + layer.breathPhase + 0.25) * Math.PI * 2) * sway;
    return {
      transform: [
        // Anchor the squash near the feet so the ground contact holds.
        { translateY: (1 - scaleY) * size * 0.42 },
        { scaleX },
        { scaleY },
        { rotate: `${rot}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <SvgRigLayer shapes={layer.shapes} size={size} idPrefix={layer.id} />
    </Animated.View>
  );
}

/** The wandering eyes, riding the same breath as the face layer. */
function PupilLayer({
  pupils,
  size,
  lookX,
  lookY,
  breath,
  calm,
}: {
  pupils: NonNullable<RigModel['pupils']>;
  size: number;
  lookX: SharedValue<number>;
  lookY: SharedValue<number>;
  breath: SharedValue<number>;
  calm: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const s = calm ? 0 : Math.sin((breath.value + 0.22) * Math.PI * 2) * 0.015;
    const scaleY = 1 - s * 0.85;
    const px = calm ? 0 : lookX.value * pupils.range * (size / 100);
    const py = calm ? 0 : lookY.value * pupils.range * (size / 100);
    return {
      transform: [
        { translateY: (1 - scaleY) * size * 0.42 + py },
        { translateX: px },
        { scaleX: 1 + s },
        { scaleY },
      ],
    };
  });
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <SvgRigLayer shapes={pupils.shapes} size={size} idPrefix="pupils" />
    </Animated.View>
  );
}

/**
 * The "no mascots" Home centerpiece: the EnergyMeter grown into a calm
 * level-fraction orb. Same slot as the companion, zero personality.
 */
export function EnergyOrb({ fraction, size }: { fraction: number; size: number }) {
  const { colors } = useTheme();
  const stroke = Math.max(8, size * 0.05);
  const r = (size - stroke) / 2 - 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0.02, Math.min(1, fraction));
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r - stroke} fill={colors.spark} opacity={0.12} />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.border}
        strokeWidth={stroke}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={colors.spark}
        strokeWidth={stroke}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${c}`}
        strokeDashoffset={c * (1 - clamped)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
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
