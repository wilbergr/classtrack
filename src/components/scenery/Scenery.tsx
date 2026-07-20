// Scenery: draws the parametric scene model (scenery/model.ts) as the Home
// backdrop — an illustrated little room themed to the active companion. Static
// react-native-svg art (the New-Arch-safe rule: SVG stays static, never
// per-frame prop animation), plus a soft focal glow behind the companion and
// an optional layer of drifting motes on wrapper transforms only, gated by
// useCalmMotion. Sits behind the companion + bubble + cards; pointer-through.

import React, { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Line,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { useCalmMotion } from '../../hooks';
import { useTheme } from '../../theme';
import type { ThemeId } from '../../types';
import type { RigShape } from '../companion/model';
import { buildScene, SCENE_H, SCENE_W, type DayPhase, type MoteKind } from './model';

interface Props {
  themeId: ThemeId;
  dayPhase: DayPhase;
  /** Companion tint (day-phase blended) for the soft focal halo behind it. */
  glowTint: string;
}

/**
 * Renders one scene shape as an SVG element. Radial fills become a
 * <RadialGradient> def keyed by index; flat fills/strokes pass straight
 * through. Mirrors the shape→SVG mapping in scripts/generate-branding.js.
 */
function ShapeEl({ shape, id }: { shape: RigShape; id: string }) {
  const fill = shape.fill;
  let fillProp: string | undefined;
  let grad: React.ReactNode = null;
  if (fill == null) {
    fillProp = 'none';
  } else if (typeof fill === 'string') {
    fillProp = fill;
  } else {
    fillProp = `url(#${id})`;
    grad = (
      <Defs>
        <RadialGradient id={id} gradientUnits="userSpaceOnUse" cx={fill.cx} cy={fill.cy} r={fill.r}>
          {fill.stops.map((s, i) => (
            <Stop key={i} offset={s.offset} stopColor={s.color} stopOpacity={s.opacity ?? 1} />
          ))}
        </RadialGradient>
      </Defs>
    );
  }
  const common = {
    fill: fillProp,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    strokeLinecap: shape.strokeLinecap,
    opacity: shape.opacity,
  } as const;

  let el: React.ReactNode;
  switch (shape.kind) {
    case 'path':
      el = <Path d={shape.d} {...common} />;
      break;
    case 'circle':
      el = <Circle cx={shape.cx} cy={shape.cy} r={shape.r} {...common} />;
      break;
    case 'ellipse':
      el = <Ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...common} />;
      break;
    case 'rect':
      el = (
        <Rect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          rx={shape.rx}
          {...common}
        />
      );
      break;
    case 'line':
      el = <Line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...common} />;
      break;
  }
  return (
    <>
      {grad}
      {el}
    </>
  );
}

export default function Scenery({ themeId, dayPhase, glowTint }: Props) {
  const { colors } = useTheme();
  const calm = useCalmMotion();
  const scene = useMemo(() => buildScene(themeId, colors, dayPhase), [themeId, colors, dayPhase]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        {/* The room. */}
        {scene.shapes.map((s, i) => (
          <ShapeEl key={i} shape={s} id={`sc${i}`} />
        ))}
        {/* Soft focal halo behind the companion, carrying the day-phase tint. */}
        <Defs>
          <RadialGradient id="focal" gradientUnits="userSpaceOnUse" cx={50} cy={90} r={54}>
            <Stop offset={0} stopColor={glowTint} stopOpacity={0.22} />
            <Stop offset={1} stopColor={glowTint} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={50} cy={90} r={54} fill="url(#focal)" />
      </Svg>
      {!calm && scene.motes !== 'none' && <Motes kind={scene.motes} tint={scene.moteTint} />}
    </View>
  );
}

// ---------- drifting motes (wrapper transforms only) ----------

interface MoteSpec {
  left: `${number}%`;
  top: `${number}%`;
  size: number;
  durationMs: number;
  dx: number;
  dy: number;
  delayMs: number;
  opacity: number;
}

// Kept away from the vertical center so motes never clutter the companion.
const MOTE_SPECS: MoteSpec[] = [
  { left: '10%', top: '18%', size: 8, durationMs: 9000, dx: 10, dy: 26, delayMs: 0, opacity: 0.5 },
  { left: '84%', top: '22%', size: 6, durationMs: 11000, dx: -8, dy: 30, delayMs: 1500, opacity: 0.45 },
  { left: '16%', top: '58%', size: 7, durationMs: 10000, dx: 12, dy: -22, delayMs: 800, opacity: 0.4 },
  { left: '88%', top: '52%', size: 5, durationMs: 12000, dx: -10, dy: -26, delayMs: 2200, opacity: 0.5 },
  { left: '50%', top: '10%', size: 5, durationMs: 10500, dx: 6, dy: 20, delayMs: 3000, opacity: 0.35 },
];

function Motes({ kind, tint }: { kind: MoteKind; tint: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {MOTE_SPECS.map((spec, i) => (
        <Mote key={i} spec={spec} kind={kind} tint={tint} />
      ))}
    </View>
  );
}

function Mote({ spec, kind, tint }: { spec: MoteSpec; kind: MoteKind; tint: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: spec.durationMs, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    return () => cancelAnimation(t);
  }, [t, spec.durationMs]);
  const style = useAnimatedStyle(() => ({
    opacity: spec.opacity * (0.5 + 0.5 * Math.sin(t.value * Math.PI)),
    transform: [{ translateX: spec.dx * t.value }, { translateY: spec.dy * t.value }],
  }));
  // Shape by kind: bubbles are hollow rings, leaves are ovals, sparks/stars dots.
  const base = {
    position: 'absolute' as const,
    left: spec.left,
    top: spec.top,
    width: spec.size,
    height: kind === 'leaf' ? spec.size * 0.6 : spec.size,
  };
  const skin =
    kind === 'bubble'
      ? { borderRadius: spec.size / 2, borderWidth: 1, borderColor: tint }
      : kind === 'leaf'
        ? { borderRadius: spec.size / 2, backgroundColor: tint }
        : { borderRadius: spec.size / 2, backgroundColor: tint };
  return <Animated.View style={[base, skin, style]} />;
}
