// The companion, Rig v2 on Skia: a parametric layered model
// (companion/model.ts) drawn by SkiaRig — one Canvas, per-layer Groups whose
// transforms are driven directly by Reanimated shared values (Skia's
// first-class integration), with real BlurMask glow on aura/shimmer layers.
// Squash-and-stretch breathing with per-layer phase lag, wandering
// eye-tracking pupils, asymmetric blinks, celebrate hop, species-flavored
// poke reactions. Model rebuilds (blink/mood/stage) stay low-frequency React
// state. All motion is gated by useCalmMotion().

import React, { useEffect, useRef, useState } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Rect } from 'react-native-svg';

import SkiaRig from './companion/SkiaRig';
import { buildRig, type RigModel } from './companion/model';
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
  /** Increment to play a species-flavored poke reaction (affection only). */
  pokeSignal?: number;
  /** Ready grace shields (0–2) shown as guardian charms; omit to draw none. */
  shields?: number;
}

export default function Companion({
  species,
  mood,
  stage,
  size,
  accessories = [],
  pokeSignal = 0,
  shields = 0,
}: Props) {
  const { colors } = useTheme();
  const calm = useCalmMotion();
  const [blink, setBlink] = useState(false);
  const breath = useSharedValue(0); // loops 0→1; layers read sin(2π·t) with phase
  const pulse = useSharedValue(0); // slower loop for aura/glow layers
  const hop = useSharedValue(0);
  const tilt = useSharedValue(0); // degrees; poke reactions
  const squish = useSharedValue(0); // extra squash for poke reactions
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

  // Blinks: irregular, occasionally double; Juno and Otto are famous
  // slow-blinkers (cat affection, owl gravitas).
  useEffect(() => {
    if (calm || mood === 'dozing') return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const closeMs = species === 'juno' || species === 'otto' ? 240 : 130;
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

  // Poke reactions, flavored per species: Wisp wiggles, Pip does a squash
  // bounce, Juno slow-blinks with a small head tilt, Nova does a heroic hop,
  // Rex a stompy wiggle, Otto a slow owlish head swivel, Unit-7 head-bobbles.
  const prevPoke = useRef(pokeSignal);
  useEffect(() => {
    if (pokeSignal === prevPoke.current) return;
    prevPoke.current = pokeSignal;
    if (calm) return;
    if (species === 'wisp') {
      tilt.value = withSequence(
        withTiming(-6, { duration: 90 }),
        withTiming(6, { duration: 140 }),
        withTiming(-3, { duration: 120 }),
        withTiming(0, { duration: 140 }),
      );
    } else if (species === 'pip') {
      squish.value = withSequence(
        withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 7, stiffness: 260 }),
      );
    } else if (species === 'juno') {
      tilt.value = withSequence(withTiming(5, { duration: 260 }), withTiming(0, { duration: 380 }));
      setBlink(true);
      const t1 = setTimeout(() => setBlink(false), 420);
      return () => clearTimeout(t1);
    } else if (species === 'nova') {
      hop.value = withSequence(
        withSpring(-size * 0.09, { damping: 7, stiffness: 340 }),
        withSpring(0, { damping: 9 }),
      );
    } else if (species === 'rex') {
      squish.value = withSequence(
        withTiming(0.9, { duration: 100, easing: Easing.out(Easing.quad) }),
        withSpring(0, { damping: 6, stiffness: 240 }),
      );
      tilt.value = withSequence(
        withTiming(-4, { duration: 110 }),
        withTiming(3, { duration: 130 }),
        withTiming(0, { duration: 120 }),
      );
    } else if (species === 'otto') {
      tilt.value = withSequence(withTiming(9, { duration: 300 }), withTiming(0, { duration: 450 }));
      setBlink(true);
      const t1 = setTimeout(() => setBlink(false), 480);
      return () => clearTimeout(t1);
    } else {
      // unit7: quick side-to-side bobble.
      tilt.value = withSequence(
        withTiming(4, { duration: 80 }),
        withTiming(-4, { duration: 110 }),
        withTiming(4, { duration: 110 }),
        withTiming(0, { duration: 110 }),
      );
    }
    return undefined;
  }, [pokeSignal, species, calm, tilt, squish, hop, size]);

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
    () => buildRig({ species, stage, mood, eyesClosed, colors, accessories, shields }),
    [species, stage, mood, eyesClosed, colors, accessories, shields],
  );

  const rootStyle = useAnimatedStyle(() => {
    const sq = squish.value * 0.08;
    return {
      transform: [
        { translateY: hop.value + sq * size * 0.42 },
        { scale: model.baseScale },
        { rotate: `${tilt.value}deg` },
        { scaleX: 1 + sq },
        { scaleY: 1 - sq },
      ],
    };
  });

  return (
    <Animated.View
      style={[{ width: size, height: size }, rootStyle]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SkiaRig
        model={model}
        size={size}
        breath={breath}
        pulse={pulse}
        lookX={lookX}
        lookY={lookY}
        calm={calm}
      />
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
