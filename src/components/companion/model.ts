// Rig v2 model: a pure parametric description of the companion —
// (species, stage, mood, theme) → layers of primitive shapes plus animation
// params. The renderer (SkiaRig) draws the model; all continuous motion is
// applied as wrapper/Group transforms, never as per-frame SVG prop changes
// (the New-Architecture-safe pattern).
//
// Anatomy (v3, "full little character"): every species is a chibi cartoon —
// an oversized head (~half the rig), a small rounded torso, stubby limbs and
// big white-sclera eyes with wandering pupils + a specular highlight. All in
// a 100×100 space, feet on the ground line ~y 88, shadow at y 94.

import type { CompanionMood } from '../../gamification/companion';
import type { ThemeColors } from '../../theme';
import type { CompanionId } from '../../types';
import { darken, lighten } from './color';

export type CompanionSpecies = Exclude<CompanionId, 'none'>;

// ---------- shape primitives ----------

export interface GradientStop {
  offset: number;
  color: string;
  opacity?: number;
}

export interface RadialFill {
  type: 'radial';
  cx: number;
  cy: number;
  r: number;
  stops: GradientStop[];
}

export type Fill = string | RadialFill;

interface ShapeBase {
  fill?: Fill;
  stroke?: string;
  strokeWidth?: number;
  strokeLinecap?: 'round' | 'butt';
  opacity?: number;
}

export type RigShape =
  | ({ kind: 'path'; d: string } & ShapeBase)
  | ({ kind: 'circle'; cx: number; cy: number; r: number } & ShapeBase)
  | ({ kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number } & ShapeBase)
  | ({ kind: 'rect'; x: number; y: number; width: number; height: number; rx?: number } & ShapeBase)
  | ({ kind: 'line'; x1: number; y1: number; x2: number; y2: number } & ShapeBase);

// ---------- layers ----------

export type RigLayerId =
  | 'shadow'
  | 'aura'
  | 'back'
  | 'arms'
  | 'body'
  | 'markings'
  | 'face'
  | 'front'
  | 'shimmer'
  | 'accessory'
  | 'guard';

export interface RigLayer {
  id: RigLayerId;
  shapes: RigShape[];
  /** Squash-and-stretch amplitude (0 = rigid). */
  breathAmp: number;
  /** Phase offset (0..1) — features lag the body for follow-through. */
  breathPhase: number;
  /** Gentle rotation amplitude in degrees (leaves, flames, tails, arms). */
  sway?: number;
  /**
   * Transform origin override so sway reads as a hinge (arms swing at the
   * shoulder, a sprout at its base). Default is the feet (50, 92) so squash
   * keeps ground contact.
   */
  pivot?: { x: number; y: number };
  /** Slow opacity/scale pulse instead of squash (auras, glows). */
  pulse?: boolean;
}

export interface RigModel {
  layers: RigLayer[];
  /** Stage-driven overall scale (1 = full size). */
  baseScale: number;
  /**
   * Eye shapes that wander (eye-tracking); null when the face layer carries
   * the eyes instead (blink arcs, celebrating arcs).
   */
  pupils: { shapes: RigShape[]; range: number } | null;
  /** Ambient tint motes drift around the companion (stage 4 and up). */
  motes: boolean;
  /**
   * Hover amplitude in rig units for floaty species (Wisp). Every layer but
   * the ground shadow bobs; the shadow narrows as the body rises.
   */
  float?: number;
}

export interface RigInputs {
  species: CompanionSpecies;
  stage: number;
  mood: CompanionMood;
  eyesClosed: boolean;
  colors: ThemeColors;
  accessories: string[];
  /**
   * Ready grace shields (0–2), shown as tiny guardian charms at the
   * companion's feet. Omit (or 0) to draw none — a resting shield simply
   * isn't there, never a dimmed or broken one.
   */
  shields?: number;
}

// ---------- shared pieces ----------

/** Per-stage overall scale: hatchling-small up to a touch over full size. */
export function stageScale(stage: number): number {
  if (stage <= 1) return 0.78;
  if (stage <= 3) return 1;
  if (stage === 4) return 1.04;
  if (stage === 5) return 1.08;
  if (stage === 6) return 1.11;
  return 1.14;
}

const WHITE = '#FFFFFF';

function bodyGradient(tint: string): RadialFill {
  // Four stops off one key light (upper-left): a bright core, a soft mid,
  // the true tint, and a deeper occluded edge — rounder than the old 3-stop.
  return {
    type: 'radial',
    cx: 42,
    cy: 30,
    r: 66,
    stops: [
      { offset: 0, color: lighten(tint, 0.42) },
      { offset: 0.35, color: lighten(tint, 0.14) },
      { offset: 0.7, color: tint },
      { offset: 1, color: darken(tint, 0.24) },
    ],
  };
}

/** Hatchlings are flat-filled; shading appears at Sprout. */
function bodyFill(tint: string, stage: number): Fill {
  return stage >= 2 ? bodyGradient(tint) : tint;
}

/** 4-point sparkle (diamond star) path. */
function starPath(cx: number, cy: number, r: number): string {
  const q = r * 0.28;
  return (
    `M ${cx} ${cy - r} L ${cx + q} ${cy - q} L ${cx + r} ${cy} L ${cx + q} ${cy + q} ` +
    `L ${cx} ${cy + r} L ${cx - q} ${cy + q} L ${cx - r} ${cy} L ${cx - q} ${cy - q} Z`
  );
}

/**
 * Luminous-stage shimmer: tiny sparkles over the character, gently pulsing.
 * The field thickens at Celestial and again at Mythic.
 */
function shimmerLayer(tint: string, stage: number): RigLayer {
  const spark = lighten(tint, 0.6);
  const shapes: RigShape[] = [
    { kind: 'path', d: starPath(33, 30, 3), fill: spark, opacity: 0.8 },
    { kind: 'path', d: starPath(68, 24, 2.4), fill: spark, opacity: 0.7 },
    { kind: 'path', d: starPath(70, 72, 2.8), fill: spark, opacity: 0.75 },
    { kind: 'path', d: starPath(30, 76, 2.2), fill: spark, opacity: 0.65 },
  ];
  if (stage >= 6) {
    shapes.push(
      { kind: 'path', d: starPath(23, 49, 2.4), fill: spark, opacity: 0.7 },
      { kind: 'path', d: starPath(77, 45, 2.2), fill: spark, opacity: 0.7 },
    );
  }
  if (stage >= 7) {
    shapes.push(
      { kind: 'path', d: starPath(20, 22, 2), fill: spark, opacity: 0.75 },
      { kind: 'path', d: starPath(81, 15, 2.2), fill: spark, opacity: 0.75 },
      { kind: 'path', d: starPath(50, 97, 1.8), fill: spark, opacity: 0.6 },
    );
  }
  return {
    id: 'shimmer',
    shapes,
    breathAmp: 0.022,
    breathPhase: 0,
    pulse: true,
  };
}

function groundShadow(c: ThemeColors): RigLayer {
  return {
    id: 'shadow',
    shapes: [{ kind: 'ellipse', cx: 50, cy: 94, rx: 26, ry: 4, fill: c.text, opacity: 0.08 }],
    breathAmp: 0,
    breathPhase: 0,
  };
}

function auraLayer(tint: string, stage: number): RigLayer {
  const ring = (r: number, opacity: number): RigShape => ({
    kind: 'circle',
    cx: 50,
    cy: 54,
    r,
    fill: {
      type: 'radial',
      cx: 50,
      cy: 54,
      r,
      stops: [
        { offset: 0.55, color: tint, opacity: 0 },
        { offset: 0.85, color: tint, opacity },
        { offset: 1, color: tint, opacity: 0 },
      ],
    },
  });
  const rings = [ring(46, 0.28), ring(41, 0.16), ring(36, 0.09)];
  if (stage >= 5) rings.unshift(ring(50, 0.12));
  if (stage >= 6) rings.unshift(ring(53, 0.1));
  if (stage >= 7) rings.unshift(ring(56, 0.07));
  return {
    id: 'aura',
    shapes: rings,
    breathAmp: 0,
    breathPhase: 0,
    pulse: true,
  };
}

/** Closed eyes (gentle arcs) / celebrating (happy arcs) drawn in the face layer. */
function eyeArcs(xs: [number, number], y: number, color: string, happy: boolean): RigShape[] {
  return xs.map((x): RigShape => ({
    kind: 'path',
    d: happy
      ? `M ${x - 5} ${y + 2} Q ${x} ${y - 5} ${x + 5} ${y + 2}`
      : `M ${x - 5} ${y} Q ${x} ${y + 4} ${x + 5} ${y}`,
    stroke: color,
    strokeWidth: 2.5,
    strokeLinecap: 'round',
    fill: 'none',
  }));
}

function mouthShape(y: number, mood: CompanionMood, color: string): RigShape {
  if (mood === 'dozing') {
    return { kind: 'line', x1: 46.5, y1: y, x2: 53.5, y2: y, stroke: color, strokeWidth: 2, strokeLinecap: 'round' };
  }
  if (mood === 'alert') {
    return { kind: 'circle', cx: 50, cy: y, r: 2.6, fill: color };
  }
  if (mood === 'celebrating') {
    return { kind: 'path', d: `M 43.5 ${y - 1.5} Q 50 ${y + 7} 56.5 ${y - 1.5} Z`, fill: color };
  }
  return {
    kind: 'path',
    d: `M 45 ${y} Q 50 ${y + 4.5} 55 ${y}`,
    stroke: color,
    strokeWidth: 2.4,
    strokeLinecap: 'round',
    fill: 'none',
  };
}

function blush(y: number, color: string): RigShape[] {
  return [
    { kind: 'ellipse', cx: 35, cy: y, rx: 4.2, ry: 2.4, fill: color, opacity: 0.28 },
    { kind: 'ellipse', cx: 65, cy: y, rx: 4.2, ry: 2.4, fill: color, opacity: 0.28 },
  ];
}

/** The sleepy "z z" (path-drawn so every renderer can show it). */
function sleepZs(color: string): RigShape[] {
  return [
    {
      kind: 'path',
      d: 'M 76 26 L 85 26 L 76 35 L 85 35',
      stroke: color,
      strokeWidth: 2.4,
      strokeLinecap: 'round',
      fill: 'none',
    },
    {
      kind: 'path',
      d: 'M 84 13 L 91 13 L 84 20 L 91 20',
      stroke: color,
      strokeWidth: 2,
      strokeLinecap: 'round',
      fill: 'none',
      opacity: 0.7,
    },
  ];
}

/** Stubby cartoon arms: thick round strokes from the shoulders, down-out. */
function stubbyArms(color: string, shoulderY: number, width = 6.5): RigLayer {
  return {
    id: 'arms',
    shapes: [
      { kind: 'line', x1: 36, y1: shoulderY, x2: 27, y2: shoulderY + 8, stroke: color, strokeWidth: width, strokeLinecap: 'round' },
      { kind: 'line', x1: 64, y1: shoulderY, x2: 73, y2: shoulderY + 8, stroke: color, strokeWidth: width, strokeLinecap: 'round' },
    ],
    breathAmp: 0.03,
    breathPhase: 0.3,
    sway: 2,
    pivot: { x: 50, y: shoulderY },
  };
}

/** Little rounded feet planted on the ground line. */
function feet(color: string): RigShape[] {
  return [
    { kind: 'ellipse', cx: 42, cy: 87.5, rx: 5.5, ry: 3.5, fill: color },
    { kind: 'ellipse', cx: 58, cy: 87.5, rx: 5.5, ry: 3.5, fill: color },
  ];
}

/**
 * Shop accessories, species-generic; anchored to the shared neckline
 * (head-torso seam ≈ y 57) and crown (y ≈ 5).
 */
function accessoryLayer(keys: string[], c: ThemeColors): RigLayer | null {
  const shapes: RigShape[] = [];
  if (keys.includes('halo')) {
    shapes.push({
      kind: 'ellipse',
      cx: 50,
      cy: 5,
      rx: 15,
      ry: 4,
      stroke: c.spark,
      strokeWidth: 3,
      fill: 'none',
    });
  }
  if (keys.includes('scarf')) {
    shapes.push(
      { kind: 'path', d: 'M 35 55 Q 50 63 65 55 L 65 62 Q 50 70 35 62 Z', fill: c.danger },
      { kind: 'rect', x: 57, y: 59, width: 7, height: 13, rx: 3, fill: c.danger },
    );
  }
  if (keys.includes('bowtie')) {
    shapes.push(
      { kind: 'path', d: 'M 50 59 L 39 53 L 39 65 Z', fill: c.primary },
      { kind: 'path', d: 'M 50 59 L 61 53 L 61 65 Z', fill: c.primary },
      { kind: 'circle', cx: 50, cy: 59, r: 3, fill: c.primary },
    );
  }
  if (keys.includes('bell')) {
    shapes.push(
      { kind: 'path', d: 'M 36 55 Q 50 61 64 55 L 64 59 Q 50 65 36 59 Z', fill: c.upcoming },
      { kind: 'circle', cx: 50, cy: 62.5, r: 3.5, fill: c.spark },
      { kind: 'circle', cx: 50, cy: 64.5, r: 1, fill: c.text },
    );
  }
  if (keys.includes('flower')) {
    // Five petals around a spark-colored center, tucked at the head's side.
    const petals: Array<[number, number]> = [
      [68, 9.6],
      [72.2, 12.6],
      [70.6, 17.6],
      [65.4, 17.6],
      [63.8, 12.6],
    ];
    shapes.push(
      ...petals.map(
        ([cx, cy]): RigShape => ({ kind: 'circle', cx, cy, r: 2.6, fill: c.primary }),
      ),
      { kind: 'circle', cx: 68, cy: 13.6, r: 2.2, fill: c.spark },
    );
  }
  if (keys.includes('crown')) {
    shapes.push(
      { kind: 'path', d: 'M 40 12 L 40 4 L 45 8 L 50 3 L 55 8 L 60 4 L 60 12 Z', fill: c.spark },
      { kind: 'circle', cx: 50, cy: 10, r: 1.4, fill: c.primary },
    );
  }
  if (shapes.length === 0) return null;
  return { id: 'accessory', shapes, breathAmp: 0.02, breathPhase: 0.05 };
}

/**
 * Ready grace shields as tiny guardian charms standing by the companion's
 * feet — one per shield, glowing on the aura pulse. The second charm flanks
 * the opposite side so a pair reads as a little honor guard.
 */
function guardLayer(c: ThemeColors, count: number): RigLayer | null {
  if (count <= 0) return null;
  const charm = (cx: number): RigShape[] => [
    {
      kind: 'path',
      d:
        `M ${cx} 76.4 C ${cx + 2.2} 77.6 ${cx + 3.5} 78 ${cx + 4.3} 78.2 ` +
        `L ${cx + 4.3} 81.2 C ${cx + 4.3} 83.6 ${cx + 2.5} 85.2 ${cx} 86 ` +
        `C ${cx - 2.5} 85.2 ${cx - 4.3} 83.6 ${cx - 4.3} 81.2 L ${cx - 4.3} 78.2 ` +
        `C ${cx - 3.5} 78 ${cx - 2.2} 77.6 ${cx} 76.4 Z`,
      fill: c.spark,
      opacity: 0.95,
    },
    { kind: 'path', d: starPath(cx, 80.9, 1.8), fill: WHITE, opacity: 0.9 },
  ];
  const shapes = count >= 2 ? [...charm(21), ...charm(79)] : charm(79);
  return { id: 'guard', shapes, breathAmp: 0, breathPhase: 0, pulse: true };
}

// ---------- the cartoon face (organic species) ----------

interface FaceSpec {
  /** Eye centers, symmetric on the head. */
  eyeXs: [number, number];
  eyeY: number;
  mouthY: number;
  /** Deep species-dark used for pupils, arcs and the mouth. */
  ink: string;
  /** Mid-tone iris ring between sclera and pupil (usually darken(tint, ~0.3)). */
  iris: string;
  blushY?: number;
  /** Bigger-than-standard eyes (owls). */
  eyeScale?: number;
  /** Beak color: replaces the mouth with a little triangle beak (owls). */
  beak?: string;
}

/** Closed beak / open celebrating beak, drawn where a mouth would go. */
function beakShapes(y: number, mood: CompanionMood, color: string): RigShape[] {
  if (mood === 'celebrating') {
    return [
      { kind: 'path', d: `M 46 ${y} L 54 ${y} L 50 ${y + 4.5} Z`, fill: color },
      { kind: 'path', d: `M 47.5 ${y + 6} L 52.5 ${y + 6} L 50 ${y + 9} Z`, fill: darken(color, 0.2), opacity: 0.9 },
    ];
  }
  return [{ kind: 'path', d: `M 46 ${y} L 54 ${y} L 50 ${y + 6} Z`, fill: color }];
}

/**
 * Big-cartoon-eyes face shared by the organic species: white sclera in the
 * face layer; a tinted iris ring, deep pupil and dual catchlights in the
 * wandering pupil group. Pupils converge a touch inward so the character
 * reads as focused on the viewer. Hatchlings get even bigger eyes; blush
 * arrives at Grown.
 */
function cuteFace(
  i: RigInputs,
  spec: FaceSpec,
  extra: RigShape[] = [],
): { face: RigLayer; pupils: RigModel['pupils'] } {
  const shapes: RigShape[] = [...extra];
  let pupils: RigModel['pupils'] = null;
  const big = i.stage <= 1;
  const es = spec.eyeScale ?? 1;
  const scleraRx = (big ? 7.2 : 6) * es;
  const scleraRy = (big ? 8.4 : 7) * es;
  const pupilR = ((big ? 4.6 : 3.9) + (i.mood === 'alert' ? 0.6 : 0)) * es;
  const [lx, rx] = spec.eyeXs;

  if (i.eyesClosed) {
    shapes.push(...eyeArcs(spec.eyeXs, spec.eyeY, spec.ink, false));
  } else if (i.mood === 'celebrating') {
    shapes.push(...eyeArcs(spec.eyeXs, spec.eyeY, spec.ink, true));
  } else {
    shapes.push(
      { kind: 'ellipse', cx: lx, cy: spec.eyeY, rx: scleraRx, ry: scleraRy, fill: WHITE },
      { kind: 'ellipse', cx: rx, cy: spec.eyeY, rx: scleraRx, ry: scleraRy, fill: WHITE },
    );
    const pupilShapes: RigShape[] = spec.eyeXs.flatMap((x, idx): RigShape[] => {
      const cx = x + (idx === 0 ? 0.5 : -0.5); // converge toward the viewer
      const cy = spec.eyeY + 0.6;
      return [
        { kind: 'circle', cx, cy, r: pupilR + 1.2, fill: spec.iris },
        { kind: 'circle', cx, cy: cy + 0.3, r: pupilR - 0.3, fill: spec.ink },
        { kind: 'circle', cx: cx + 1.4, cy: cy - 1.7, r: 1.6, fill: WHITE, opacity: 0.95 },
        { kind: 'circle', cx: cx - 1.6, cy: cy + 1.9, r: 0.8, fill: WHITE, opacity: 0.6 },
      ];
    });
    pupils = { shapes: pupilShapes, range: 2.2 };
  }
  if (i.stage >= 3 && spec.blushY != null) {
    shapes.push(...blush(spec.blushY, WHITE));
  }
  if (spec.beak != null) shapes.push(...beakShapes(spec.mouthY, i.mood, spec.beak));
  else shapes.push(mouthShape(spec.mouthY, i.mood, spec.ink));
  if (i.mood === 'dozing') shapes.push(...sleepZs(i.colors.textMuted));
  return {
    face: { id: 'face', shapes, breathAmp: 0.015, breathPhase: 0.22 },
    pupils,
  };
}

// ---------- species shells ----------

function wispLayers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.wisp;
  const ink = darken(tint, 0.72);
  const layers: RigLayer[] = [];

  // Side flames flank the head from Sprout on; Celestial grows a taller
  // outer pair that reads as flame wings, and Mythic sets twin embers
  // hovering beside the torso.
  if (i.stage >= 2) {
    const sideFlames: RigShape[] = [
      { kind: 'path', d: 'M 28 44 C 22 36 24 26 30 20 C 29 30 31 37 36 43 Z', fill: darken(tint, 0.06), opacity: 0.8 },
      { kind: 'path', d: 'M 72 44 C 78 36 76 26 70 20 C 71 30 69 37 64 43 Z', fill: darken(tint, 0.06), opacity: 0.8 },
    ];
    if (i.stage >= 6) {
      sideFlames.unshift(
        { kind: 'path', d: 'M 23 50 C 14 40 15 24 25 13 C 22 27 25 40 32 48 Z', fill: lighten(tint, 0.16), opacity: 0.75 },
        { kind: 'path', d: 'M 77 50 C 86 40 85 24 75 13 C 78 27 75 40 68 48 Z', fill: lighten(tint, 0.16), opacity: 0.75 },
      );
    }
    if (i.stage >= 7) {
      sideFlames.push(
        { kind: 'path', d: 'M 15 60 C 18 63 17 67 15 69 C 13 67 12 63 15 60 Z', fill: lighten(tint, 0.3), opacity: 0.9 },
        { kind: 'path', d: 'M 85 60 C 88 63 87 67 85 69 C 83 67 82 63 85 60 Z', fill: lighten(tint, 0.3), opacity: 0.9 },
      );
    }
    layers.push({
      id: 'back',
      shapes: sideFlames,
      breathAmp: 0.03,
      breathPhase: 0.4,
      sway: 2.5,
      pivot: { x: 50, y: 42 },
    });
  }

  if (i.stage >= 2) layers.push(stubbyArms(darken(tint, 0.06), 63));

  // Flame-teardrop head over a small round flame body; Wisp floats, so a
  // little tail flame flickers where feet would be.
  const bodyShapes: RigShape[] = [
    {
      kind: 'path',
      d: 'M 50 6 C 60 16 70 24 70 36 C 70 49 61 57 50 57 C 39 57 30 49 30 36 C 30 24 40 16 50 6 Z',
      fill: bodyFill(tint, i.stage),
    },
    // Torso tucks up under the head so the silhouette reads as one body.
    { kind: 'ellipse', cx: 50, cy: 69, rx: 14.5, ry: 13, fill: bodyFill(tint, i.stage) },
  ];
  if (i.stage >= 2) {
    bodyShapes.push(
      // Rim light along the head's upper left.
      {
        kind: 'path',
        d: 'M 41 16 C 35 22 31 29 31 36',
        stroke: lighten(tint, 0.5),
        strokeWidth: 3,
        strokeLinecap: 'round',
        fill: 'none',
        opacity: 0.7,
      },
      { kind: 'ellipse', cx: 50, cy: 72, rx: 8, ry: 6, fill: WHITE, opacity: 0.35 },
    );
  }
  layers.push({ id: 'body', shapes: bodyShapes, breathAmp: 0.022, breathPhase: 0 });

  if (i.stage >= 3) {
    const markings: RigShape[] = [
      { kind: 'path', d: 'M 40 63 C 39 67 39 72 40 76', stroke: darken(tint, 0.14), strokeWidth: 2.2, strokeLinecap: 'round', fill: 'none', opacity: 0.5 },
      { kind: 'path', d: 'M 60 63 C 61 67 61 72 60 76', stroke: darken(tint, 0.14), strokeWidth: 2.2, strokeLinecap: 'round', fill: 'none', opacity: 0.5 },
    ];
    if (i.stage >= 7) {
      // Mythic burns white-hot: an inner flame glows through the head.
      markings.unshift({
        kind: 'path',
        d: 'M 50 16 C 55 22 60 27 60 34 C 60 42 55 47 50 47 C 45 47 40 42 40 34 C 40 27 45 22 50 16 Z',
        fill: lighten(tint, 0.5),
        opacity: 0.45,
      });
    }
    layers.push({
      id: 'markings',
      shapes: markings,
      breathAmp: 0.022,
      breathPhase: 0,
    });
  }

  // Tail flame (always) + crown-flame at Radiant; Luminous lights a tongue,
  // Celestial splits the tail into three, Mythic whitens the tail core.
  const front: RigShape[] = [
    { kind: 'path', d: 'M 50 81 C 55 85 53 91 50 94 C 47 91 45 85 50 81 Z', fill: lighten(tint, 0.2), opacity: 0.95 },
  ];
  if (i.stage >= 6) {
    front.push(
      { kind: 'path', d: 'M 42 82 C 45.5 85 44.5 89 42.5 91.5 C 40.5 89 39.5 85 42 82 Z', fill: lighten(tint, 0.2), opacity: 0.85 },
      { kind: 'path', d: 'M 58 82 C 60.5 85 59.5 89 57.5 91.5 C 55.5 89 54.5 85 58 82 Z', fill: lighten(tint, 0.2), opacity: 0.85 },
    );
  }
  if (i.stage >= 7) {
    front.push({ kind: 'ellipse', cx: 50, cy: 87, rx: 1.8, ry: 4, fill: lighten(tint, 0.55), opacity: 0.9 });
  }
  if (i.stage >= 4) {
    front.push({
      kind: 'path',
      d: i.stage >= 5
        ? 'M 50 0 C 56 5 58 11 54 16 C 52 12 48 12 46 16 C 42 11 44 5 50 0 Z'
        : 'M 50 1 C 54 6 55 10 52 14 C 50 11 48 11 47 14 C 45 10 46 6 50 1 Z',
      fill: lighten(tint, 0.2),
      opacity: 0.9,
    });
    if (i.stage >= 5) {
      front.push({ kind: 'ellipse', cx: 50, cy: 9, rx: 2.4, ry: 4, fill: lighten(tint, 0.55), opacity: 0.9 });
    }
    if (i.stage >= 7) {
      // The crown flame flares into a full plume.
      front.push(
        { kind: 'path', d: 'M 42 6 C 44 2.5 47 0.5 50 0 C 47.5 3 46 6.5 45.5 10 Z', fill: lighten(tint, 0.35), opacity: 0.85 },
        { kind: 'path', d: 'M 58 6 C 56 2.5 53 0.5 50 0 C 52.5 3 54 6.5 54.5 10 Z', fill: lighten(tint, 0.35), opacity: 0.85 },
      );
    }
  }
  layers.push({
    id: 'front',
    shapes: front,
    breathAmp: 0.026,
    breathPhase: 0.35,
    sway: 3,
    pivot: { x: 50, y: 82 },
  });

  const { face, pupils } = cuteFace(i, {
    eyeXs: [42, 58],
    eyeY: 36,
    mouthY: 47,
    ink,
    iris: darken(tint, 0.32),
    blushY: 43,
  });
  layers.push(face);
  return { layers, pupils };
}

function pipLayers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.pip;
  const ink = darken(tint, 0.72);
  const layers: RigLayer[] = [];

  // Celestial grows leafy fronds at the shoulders; Mythic frees a few petals
  // to drift alongside.
  if (i.stage >= 6) {
    const fronds: RigShape[] = [
      { kind: 'path', d: 'M 34 60 C 26 57 21 51 21 43 C 28 46 33 52 35 58 Z', fill: i.colors.done, opacity: 0.9 },
      { kind: 'path', d: 'M 66 60 C 74 57 79 51 79 43 C 72 46 67 52 65 58 Z', fill: i.colors.done, opacity: 0.9 },
    ];
    if (i.stage >= 7) {
      fronds.push(
        { kind: 'circle', cx: 25, cy: 33, r: 1.9, fill: lighten(tint, 0.4), opacity: 0.85 },
        { kind: 'circle', cx: 76, cy: 38, r: 1.6, fill: lighten(tint, 0.4), opacity: 0.85 },
        { kind: 'circle', cx: 21, cy: 70, r: 1.5, fill: lighten(tint, 0.4), opacity: 0.7 },
      );
    }
    layers.push({
      id: 'back',
      shapes: fronds,
      breathAmp: 0.026,
      breathPhase: 0.4,
      sway: 2.5,
      pivot: { x: 50, y: 58 },
    });
  }

  if (i.stage >= 2) layers.push(stubbyArms(darken(tint, 0.04), 63, 7));

  // Big round head on a round tummy, little feet; the tummy tucks up under
  // the head so the silhouette reads as one body.
  const bodyShapes: RigShape[] = [
    { kind: 'circle', cx: 50, cy: 33, r: 21, fill: bodyFill(tint, i.stage) },
    { kind: 'ellipse', cx: 50, cy: 69, rx: 16, ry: 15, fill: bodyFill(tint, i.stage) },
    ...feet(darken(tint, 0.12)),
    { kind: 'ellipse', cx: 42, cy: 24, rx: 6, ry: 4, fill: WHITE, opacity: 0.3 },
  ];
  if (i.stage >= 2) {
    bodyShapes.push(
      { kind: 'ellipse', cx: 50, cy: 74, rx: 9, ry: 7, fill: lighten(tint, 0.28), opacity: 0.55 },
      {
        kind: 'path',
        d: 'M 35 22 C 32 26 30 31 30 36',
        stroke: lighten(tint, 0.5),
        strokeWidth: 3,
        strokeLinecap: 'round',
        fill: 'none',
        opacity: 0.7,
      },
    );
  }
  layers.push({ id: 'body', shapes: bodyShapes, breathAmp: 0.024, breathPhase: 0 });

  if (i.stage >= 3) {
    const markings: RigShape[] = [
      { kind: 'circle', cx: 37, cy: 68, r: 3.5, fill: WHITE, opacity: 0.35 },
      { kind: 'circle', cx: 63, cy: 68, r: 3.5, fill: WHITE, opacity: 0.35 },
    ];
    if (i.stage >= 7) {
      // A little tummy blossom — the garden reaches the body.
      const petal = lighten(tint, 0.4);
      markings.push(
        { kind: 'circle', cx: 50, cy: 69, r: 2, fill: petal },
        { kind: 'circle', cx: 47.6, cy: 71.8, r: 2, fill: petal },
        { kind: 'circle', cx: 52.4, cy: 71.8, r: 2, fill: petal },
        { kind: 'circle', cx: 50, cy: 74.2, r: 2, fill: petal },
        { kind: 'circle', cx: 50, cy: 71.5, r: 1.6, fill: i.colors.spark },
      );
    }
    layers.push({
      id: 'markings',
      shapes: markings,
      breathAmp: 0.024,
      breathPhase: 0,
    });
  }

  if (i.stage >= 2) {
    // The head-sprout; at Radiant it blooms, at Luminous a second bud joins.
    const sprout: RigShape[] = [
      { kind: 'line', x1: 50, y1: 13, x2: 50, y2: 6, stroke: darken(tint, 0.1), strokeWidth: 2.5, strokeLinecap: 'round' },
      { kind: 'ellipse', cx: 55.5, cy: 4.5, rx: 5.5, ry: 3.5, fill: i.colors.done },
      { kind: 'ellipse', cx: 45.5, cy: 6, rx: 4, ry: 2.8, fill: i.colors.done, opacity: 0.85 },
    ];
    if (i.stage >= 4) {
      const petal = lighten(tint, 0.35);
      sprout.push(
        { kind: 'circle', cx: 50, cy: 2.8, r: 2.8, fill: petal },
        { kind: 'circle', cx: 46.4, cy: 5.4, r: 2.8, fill: petal },
        { kind: 'circle', cx: 53.6, cy: 5.4, r: 2.8, fill: petal },
        { kind: 'circle', cx: 50, cy: 4.8, r: 2, fill: i.colors.spark },
      );
    }
    if (i.stage >= 5) {
      sprout.push(
        { kind: 'line', x1: 56, y1: 11, x2: 61, y2: 5, stroke: darken(tint, 0.1), strokeWidth: 2, strokeLinecap: 'round' },
        { kind: 'circle', cx: 62, cy: 3.6, r: 2.6, fill: lighten(tint, 0.35) },
        { kind: 'circle', cx: 62, cy: 3.6, r: 1.4, fill: i.colors.spark },
      );
    }
    if (i.stage >= 6) {
      // A mirrored bud on the left completes the flower crown.
      sprout.push(
        { kind: 'line', x1: 44, y1: 11, x2: 39, y2: 5, stroke: darken(tint, 0.1), strokeWidth: 2, strokeLinecap: 'round' },
        { kind: 'circle', cx: 38, cy: 3.6, r: 2.6, fill: lighten(tint, 0.35) },
        { kind: 'circle', cx: 38, cy: 3.6, r: 1.4, fill: i.colors.spark },
      );
    }
    if (i.stage >= 7) {
      // The center bloom opens wide: an outer ring of pale petals.
      const outer = lighten(tint, 0.5);
      sprout.push(
        { kind: 'circle', cx: 43.8, cy: 3, r: 2.4, fill: outer, opacity: 0.95 },
        { kind: 'circle', cx: 56.2, cy: 3, r: 2.4, fill: outer, opacity: 0.95 },
        { kind: 'circle', cx: 50, cy: 0.8, r: 2.4, fill: outer, opacity: 0.95 },
        { kind: 'circle', cx: 50, cy: 4.8, r: 2.4, fill: i.colors.spark },
      );
    }
    layers.push({
      id: 'front',
      shapes: sprout,
      breathAmp: 0.02,
      breathPhase: 0.3,
      sway: 3,
      pivot: { x: 50, y: 13 },
    });
  }

  const { face, pupils } = cuteFace(i, {
    eyeXs: [42, 58],
    eyeY: 34,
    mouthY: 45,
    ink,
    iris: darken(tint, 0.32),
    blushY: 41,
  });
  layers.push(face);
  return { layers, pupils };
}

function junoLayers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.juno;
  const ink = darken(tint, 0.72);
  const layers: RigLayer[] = [];

  // Ears + curling tail lag the body — organic follow-through.
  const backShapes: RigShape[] = [
    { kind: 'path', d: 'M 32 22 L 27 6 L 45 14 Z', fill: darken(tint, 0.08) },
    { kind: 'path', d: 'M 68 22 L 73 6 L 55 14 Z', fill: darken(tint, 0.08) },
    { kind: 'path', d: 'M 33 19 L 30 9 L 41 14 Z', fill: lighten(tint, 0.35), opacity: 0.7 },
    { kind: 'path', d: 'M 67 19 L 70 9 L 59 14 Z', fill: lighten(tint, 0.35), opacity: 0.7 },
    { kind: 'path', d: 'M 64 80 C 76 79 81 70 76 61', stroke: darken(tint, 0.08), strokeWidth: 5, strokeLinecap: 'round', fill: 'none' },
  ];
  if (i.stage >= 2) {
    backShapes.push(
      { kind: 'path', d: 'M 27 6 L 25 1.5 L 30 4 Z', fill: darken(tint, 0.08) },
      { kind: 'path', d: 'M 73 6 L 75 1.5 L 70 4 Z', fill: darken(tint, 0.08) },
    );
  }
  if (i.stage >= 3) {
    backShapes.push({ kind: 'circle', cx: 76, cy: 61, r: 3, fill: lighten(tint, 0.35) });
  }
  if (i.stage >= 5) {
    backShapes.push(
      { kind: 'path', d: starPath(25, 4, 2.4), fill: i.colors.spark, opacity: 0.9 },
      { kind: 'path', d: starPath(75, 4, 2.4), fill: i.colors.spark, opacity: 0.9 },
    );
  }
  if (i.stage >= 6) {
    // A little gold crescent drifts above the tail tip.
    backShapes.push({
      kind: 'path',
      d: 'M 82 49 A 4.2 4.2 0 1 0 84.9 56.1 A 3.2 3.2 0 1 1 82 49 Z',
      fill: i.colors.spark,
      opacity: 0.9,
    });
  }
  if (i.stage >= 7) {
    // The mythic second tail — a mirrored curl with its own lit tip.
    backShapes.push(
      { kind: 'path', d: 'M 36 80 C 24 79 19 70 24 61', stroke: darken(tint, 0.08), strokeWidth: 5, strokeLinecap: 'round', fill: 'none' },
      { kind: 'circle', cx: 24, cy: 61, r: 3, fill: lighten(tint, 0.35) },
    );
  }
  layers.push({ id: 'back', shapes: backShapes, breathAmp: 0.02, breathPhase: 0.35, sway: 2 });

  // Sitting-cat front legs with lighter paws.
  if (i.stage >= 2) {
    layers.push({
      id: 'arms',
      shapes: [
        { kind: 'line', x1: 43, y1: 72, x2: 43, y2: 83, stroke: darken(tint, 0.05), strokeWidth: 5.5, strokeLinecap: 'round' },
        { kind: 'line', x1: 57, y1: 72, x2: 57, y2: 83, stroke: darken(tint, 0.05), strokeWidth: 5.5, strokeLinecap: 'round' },
        { kind: 'ellipse', cx: 43, cy: 85.5, rx: 4.5, ry: 3, fill: lighten(tint, 0.3) },
        { kind: 'ellipse', cx: 57, cy: 85.5, rx: 4.5, ry: 3, fill: lighten(tint, 0.3) },
      ],
      breathAmp: 0.02,
      breathPhase: 0.25,
    });
  }

  const bodyShapes: RigShape[] = [
    { kind: 'circle', cx: 50, cy: 35, r: 21, fill: bodyFill(tint, i.stage) },
    // Torso tucks up under the head so the silhouette reads as one body.
    { kind: 'ellipse', cx: 50, cy: 71, rx: 15.5, ry: 14, fill: bodyFill(tint, i.stage) },
  ];
  if (i.stage <= 1) bodyShapes.push(...feet(darken(tint, 0.1)));
  if (i.stage >= 2) {
    bodyShapes.push(
      { kind: 'ellipse', cx: 50, cy: 75, rx: 8, ry: 6, fill: lighten(tint, 0.3), opacity: 0.5 },
      {
        kind: 'path',
        d: 'M 36 23 C 33 27 31 32 31 37',
        stroke: lighten(tint, 0.5),
        strokeWidth: 3,
        strokeLinecap: 'round',
        fill: 'none',
        opacity: 0.7,
      },
    );
  }
  layers.push({ id: 'body', shapes: bodyShapes, breathAmp: 0.022, breathPhase: 0 });

  const markings: RigShape[] = [];
  if (i.stage >= 3) {
    // Forehead stripes.
    markings.push(
      { kind: 'line', x1: 44, y1: 16, x2: 44, y2: 22, stroke: WHITE, strokeWidth: 2.5, strokeLinecap: 'round', opacity: 0.4 },
      { kind: 'line', x1: 50, y1: 14, x2: 50, y2: 21, stroke: WHITE, strokeWidth: 2.5, strokeLinecap: 'round', opacity: 0.4 },
      { kind: 'line', x1: 56, y1: 16, x2: 56, y2: 22, stroke: WHITE, strokeWidth: 2.5, strokeLinecap: 'round', opacity: 0.4 },
    );
  }
  if (i.stage >= 4) {
    // Star-collar on the neckline.
    markings.push(
      { kind: 'path', d: starPath(42, 57, 2.6), fill: i.colors.spark, opacity: 0.9 },
      { kind: 'path', d: starPath(50, 59.5, 3), fill: i.colors.spark, opacity: 0.95 },
      { kind: 'path', d: starPath(58, 57, 2.6), fill: i.colors.spark, opacity: 0.9 },
    );
  }
  if (i.stage >= 5) {
    markings.push({ kind: 'path', d: starPath(50, 26, 2.6), fill: i.colors.spark, opacity: 0.9 });
  }
  if (i.stage >= 6) {
    // The collar arcs wider up the shoulders.
    markings.push(
      { kind: 'path', d: starPath(34.5, 53.5, 2.2), fill: i.colors.spark, opacity: 0.85 },
      { kind: 'path', d: starPath(65.5, 53.5, 2.2), fill: i.colors.spark, opacity: 0.85 },
    );
  }
  if (i.stage >= 7) {
    // A tiny constellation traced on the flank.
    markings.push(
      { kind: 'line', x1: 39, y1: 66, x2: 36.5, y2: 72, stroke: i.colors.spark, strokeWidth: 0.8, strokeLinecap: 'round', opacity: 0.5 },
      { kind: 'line', x1: 36.5, y1: 72, x2: 41.5, y2: 76, stroke: i.colors.spark, strokeWidth: 0.8, strokeLinecap: 'round', opacity: 0.5 },
      { kind: 'path', d: starPath(39, 66, 1.6), fill: i.colors.spark, opacity: 0.9 },
      { kind: 'path', d: starPath(36.5, 72, 1.4), fill: i.colors.spark, opacity: 0.9 },
      { kind: 'path', d: starPath(41.5, 76, 1.6), fill: i.colors.spark, opacity: 0.9 },
    );
  }
  if (markings.length > 0) {
    layers.push({ id: 'markings', shapes: markings, breathAmp: 0.022, breathPhase: 0 });
  }

  // Whiskers grow with the Sprout upgrade; little cat nose above the mouth.
  const wLen = i.stage >= 2 ? 0 : 4;
  const whiskers: RigShape[] = [
    { kind: 'line', x1: 25 + wLen, y1: 40, x2: 37, y2: 42, stroke: WHITE, strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.65 },
    { kind: 'line', x1: 25 + wLen, y1: 46, x2: 37, y2: 45, stroke: WHITE, strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.65 },
    { kind: 'line', x1: 75 - wLen, y1: 40, x2: 63, y2: 42, stroke: WHITE, strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.65 },
    { kind: 'line', x1: 75 - wLen, y1: 46, x2: 63, y2: 45, stroke: WHITE, strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.65 },
    { kind: 'path', d: 'M 47.5 43 L 52.5 43 L 50 46 Z', fill: WHITE, opacity: 0.9 },
  ];

  const { face, pupils } = cuteFace(
    i,
    { eyeXs: [41, 59], eyeY: 35, mouthY: 48, ink, iris: darken(tint, 0.32), blushY: 42 },
    whiskers,
  );
  layers.push(face);
  return { layers, pupils };
}

/**
 * One segmented robot arm for unit7 (`sign` -1 = left, +1 = right): an
 * outlined upper-arm and forearm capsule with a shoulder and elbow bolt and a
 * two-prong gripper claw at the wrist. Deliberately lighter metal over a dark
 * panel outline so it separates cleanly from the flush, darker side fins
 * behind it — reading as a jointed limb, not a body side-panel. From Radiant
 * (stage 5) a spark pip lights in the gripper.
 */
function unit7Arm(tint: string, c: ThemeColors, stage: number, sign: number): RigShape[] {
  const shX = 50 + sign * 16; // shoulder, tucked at the torso edge
  const shY = 52;
  const elX = 50 + sign * 22; // elbow, angled out
  const elY = 63;
  const wrX = 50 + sign * 23; // wrist / gripper hub
  const wrY = 72;
  const outline = darken(tint, 0.32);
  const metal = lighten(tint, 0.12);
  const bolt = darken(tint, 0.24);
  const boltPin = lighten(tint, 0.22);
  const claw = lighten(tint, 0.2);
  // An outlined capsule = a dark round-cap line with a lighter one on top.
  const capsule = (x1: number, y1: number, x2: number, y2: number, w: number): RigShape[] => [
    { kind: 'line', x1, y1, x2, y2, stroke: outline, strokeWidth: w + 2.4, strokeLinecap: 'round' },
    { kind: 'line', x1, y1, x2, y2, stroke: metal, strokeWidth: w, strokeLinecap: 'round' },
  ];
  const prong = (x2: number, y2: number, w: number): RigShape[] => [
    { kind: 'line', x1: wrX, y1: wrY, x2, y2, stroke: outline, strokeWidth: w + 1.6, strokeLinecap: 'round' },
    { kind: 'line', x1: wrX, y1: wrY, x2, y2, stroke: claw, strokeWidth: w, strokeLinecap: 'round' },
  ];
  const shapes: RigShape[] = [
    ...capsule(shX, shY, elX, elY, 5.6),
    ...capsule(elX, elY, wrX, wrY, 4.6),
    // Joint bolts ride on top of the capsules so the arm reads as jointed.
    { kind: 'circle', cx: elX, cy: elY, r: 2.9, fill: bolt },
    { kind: 'circle', cx: elX, cy: elY, r: 1.1, fill: boltPin },
    { kind: 'circle', cx: shX, cy: shY, r: 3.4, fill: bolt },
    { kind: 'circle', cx: shX, cy: shY, r: 1.3, fill: boltPin },
    // Two-prong gripper claw splayed open at the wrist.
    ...prong(wrX + sign * 4, wrY + 3.5, 2.6),
    ...prong(wrX - sign * 1, wrY + 5, 2.6),
    { kind: 'circle', cx: wrX, cy: wrY, r: 2.4, fill: metal, stroke: outline, strokeWidth: 1 },
  ];
  if (stage >= 5) {
    shapes.push({ kind: 'circle', cx: wrX, cy: wrY, r: 1, fill: c.spark });
  }
  return shapes;
}

function unit7Layers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.unit7;
  const c = i.colors;
  const layers: RigLayer[] = [];

  // Flat, darker side fins from Sprout on (behind the arms) — kept plainer and
  // darker than the arms so the limbs in front clearly separate from them.
  if (i.stage >= 2) {
    layers.push({
      id: 'back',
      shapes: [
        { kind: 'rect', x: 21, y: 51, width: 6, height: 13, rx: 3, fill: darken(tint, 0.2) },
        { kind: 'rect', x: 73, y: 51, width: 6, height: 13, rx: 3, fill: darken(tint, 0.2) },
      ],
      breathAmp: 0.018,
      breathPhase: 0.3,
    });
  }

  // Segmented, outlined robot arms with a gripper claw, hinged at the shoulder.
  if (i.stage >= 2) {
    layers.push({
      id: 'arms',
      shapes: [...unit7Arm(tint, c, i.stage, -1), ...unit7Arm(tint, c, i.stage, 1)],
      breathAmp: 0.02,
      breathPhase: 0.28,
      sway: 1.8,
      pivot: { x: 50, y: 52 },
    });
  }

  // Big screen head on a boxy little torso with chunky boots.
  const bodyShapes: RigShape[] = [
    { kind: 'rect', x: 29, y: 14, width: 42, height: 32, rx: 10, fill: bodyFill(tint, i.stage) },
    { kind: 'rect', x: 35, y: 48, width: 30, height: 28, rx: 8, fill: bodyFill(tint, i.stage) },
    { kind: 'rect', x: 37, y: 78, width: 11, height: 8, rx: 3.5, fill: darken(tint, 0.12) },
    { kind: 'rect', x: 52, y: 78, width: 11, height: 8, rx: 3.5, fill: darken(tint, 0.12) },
    // Screen inset + a faint spark-colored rim so the face reads lit; the
    // rim burns brighter at Luminous and fully at Mythic.
    { kind: 'rect', x: 34, y: 20, width: 32, height: 22, rx: 6, fill: c.text, opacity: 0.85 },
    { kind: 'rect', x: 34, y: 20, width: 32, height: 22, rx: 6, stroke: c.spark, strokeWidth: i.stage >= 7 ? 2 : 1.5, fill: 'none', opacity: i.stage >= 7 ? 0.9 : i.stage >= 5 ? 0.6 : 0.35 },
  ];
  if (i.stage >= 6) {
    // Angled heat fins on the head sides.
    bodyShapes.push(
      { kind: 'path', d: 'M 29 19 L 22 15 L 22 26 L 29 28 Z', fill: darken(tint, 0.1) },
      { kind: 'path', d: 'M 71 19 L 78 15 L 78 26 L 71 28 Z', fill: darken(tint, 0.1) },
    );
  }
  if (i.stage >= 2) {
    bodyShapes.push(
      {
        kind: 'path',
        d: 'M 33 19 C 32 25 32 32 33 39',
        stroke: lighten(tint, 0.45),
        strokeWidth: 2.5,
        strokeLinecap: 'round',
        fill: 'none',
        opacity: 0.8,
      },
      // Chest light.
      { kind: 'circle', cx: 50, cy: 54, r: 3, fill: i.mood !== 'dozing' ? c.spark : c.textMuted },
    );
    if (i.stage >= 6) {
      // A flanking indicator pair joins the chest light.
      bodyShapes.push(
        { kind: 'circle', cx: 42.5, cy: 54, r: 1.6, fill: i.mood !== 'dozing' ? c.spark : c.textMuted, opacity: 0.85 },
        { kind: 'circle', cx: 57.5, cy: 54, r: 1.6, fill: i.mood !== 'dozing' ? c.spark : c.textMuted, opacity: 0.85 },
      );
    }
  }
  if (i.stage >= 3) {
    // Panel seams: the body detail pass.
    bodyShapes.push(
      { kind: 'line', x1: 40, y1: 68, x2: 46, y2: 68, stroke: darken(tint, 0.16), strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.6 },
      { kind: 'line', x1: 54, y1: 68, x2: 60, y2: 68, stroke: darken(tint, 0.16), strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.6 },
    );
  }
  layers.push({ id: 'body', shapes: bodyShapes, breathAmp: 0.014, breathPhase: 0 });

  // Antenna sways gently; the tip light dims while dozing. The Radiant
  // upgrade grows a full array; Luminous lights every tip.
  const lit = i.mood !== 'dozing';
  const antenna: RigShape[] = [
    { kind: 'line', x1: 50, y1: 14, x2: 50, y2: 7, stroke: darken(tint, 0.08), strokeWidth: 3 },
    { kind: 'circle', cx: 50, cy: 5, r: 3.5, fill: lit ? c.spark : c.textMuted },
  ];
  if (i.stage >= 4) {
    antenna.push(
      { kind: 'line', x1: 38, y1: 14, x2: 34, y2: 7.5, stroke: darken(tint, 0.08), strokeWidth: 2.2 },
      { kind: 'circle', cx: 33, cy: 6, r: 2.4, fill: lit && i.stage >= 5 ? c.spark : darken(tint, 0.05) },
      { kind: 'line', x1: 62, y1: 14, x2: 66, y2: 7.5, stroke: darken(tint, 0.08), strokeWidth: 2.2 },
      { kind: 'circle', cx: 67, cy: 6, r: 2.4, fill: lit && i.stage >= 5 ? c.spark : darken(tint, 0.05) },
    );
  }
  if (i.stage >= 6) {
    // The main mast earns a halo ring — a proper broadcast array.
    antenna.push({
      kind: 'ellipse',
      cx: 50,
      cy: 5,
      rx: 9,
      ry: 2.8,
      stroke: c.spark,
      strokeWidth: 1.4,
      fill: 'none',
      opacity: lit ? 0.7 : 0.3,
    });
  }
  if (i.stage >= 7) {
    // Twin drone bits hover beside the head, rocking with the antenna sway.
    const bit = (x: number): RigShape[] => [
      { kind: 'rect', x, y: 24, width: 7, height: 7, rx: 2.2, fill: darken(tint, 0.1) },
      { kind: 'circle', cx: x + 3.5, cy: 27.5, r: 1.4, fill: lit ? c.spark : c.textMuted },
    ];
    antenna.push(...bit(13), ...bit(80));
  }
  layers.push({
    id: 'front',
    shapes: antenna,
    breathAmp: 0.016,
    breathPhase: 0.3,
    sway: 2.5,
    pivot: { x: 50, y: 14 },
  });

  // Screen face: a dark visor carrying two domed lens-eyes. The glowing lens
  // (radial-shaded, with faint CRT scanlines) is fixed on the screen; a dark
  // pupil aperture + catchlights ride the renderer's range-based wander so the
  // eyes track the viewer without the whole eye sliding off the screen. Soft
  // resting bars replace them when closed.
  const big = i.stage <= 1;
  const tall = i.mood === 'alert';
  const eyeXs: [number, number] = [41.5, 58.5];
  const eyeY = 29;
  const lensW = big ? 10 : 9;
  const lensH = (tall ? 13 : 11) + (big ? 1 : 0);
  const lensRim = darken(c.spark, 0.35);
  const faceShapes: RigShape[] = [];
  let pupils: RigModel['pupils'] = null;
  if (i.eyesClosed) {
    for (const ex of eyeXs) {
      faceShapes.push(
        { kind: 'rect', x: ex - 6, y: eyeY - 2, width: 12, height: 4, rx: 2, fill: c.spark, opacity: 0.18 },
        { kind: 'rect', x: ex - 5, y: eyeY - 1.3, width: 10, height: 2.6, rx: 1.3, fill: c.spark },
      );
    }
  } else {
    const pupilShapes: RigShape[] = [];
    const pr = (big ? 3 : 2.6) - (tall ? 0.4 : 0);
    for (const ex of eyeXs) {
      faceShapes.push(
        // Soft bloom behind the lens.
        { kind: 'rect', x: ex - (lensW + 4) / 2, y: eyeY - (lensH + 4) / 2, width: lensW + 4, height: lensH + 4, rx: (lensW + 4) * 0.4, fill: c.spark, opacity: 0.16 },
        // Domed glowing lens: bright core → spark → deep rim.
        {
          kind: 'rect',
          x: ex - lensW / 2,
          y: eyeY - lensH / 2,
          width: lensW,
          height: lensH,
          rx: lensW * 0.42,
          fill: {
            type: 'radial',
            cx: ex,
            cy: eyeY - 1.6,
            r: lensH * 0.78,
            stops: [
              { offset: 0, color: lighten(c.spark, 0.55) },
              { offset: 0.55, color: c.spark },
              { offset: 1, color: lensRim },
            ],
          },
        },
        // Faint CRT scanlines across the lens.
        { kind: 'line', x1: ex - lensW / 2 + 1, y1: eyeY - 1.5, x2: ex + lensW / 2 - 1, y2: eyeY - 1.5, stroke: lensRim, strokeWidth: 0.9, opacity: 0.4 },
        { kind: 'line', x1: ex - lensW / 2 + 1, y1: eyeY + 2, x2: ex + lensW / 2 - 1, y2: eyeY + 2, stroke: lensRim, strokeWidth: 0.9, opacity: 0.3 },
      );
      pupilShapes.push(
        { kind: 'circle', cx: ex, cy: eyeY + 0.5, r: pr, fill: darken(c.spark, 0.45) },
        { kind: 'circle', cx: ex - 1.3, cy: eyeY - 1.2, r: 1.2, fill: WHITE, opacity: 0.95 },
        { kind: 'circle', cx: ex + 1, cy: eyeY + 1.8, r: 0.6, fill: WHITE, opacity: 0.55 },
      );
    }
    pupils = { shapes: pupilShapes, range: 1.6 };
  }
  if (i.mood === 'celebrating') {
    faceShapes.push({
      kind: 'path',
      d: 'M 42 36 Q 50 41 58 36',
      stroke: c.spark,
      strokeWidth: 2.5,
      strokeLinecap: 'round',
      fill: 'none',
    });
  } else {
    faceShapes.push({ kind: 'line', x1: 44, y1: 37, x2: 56, y2: 37, stroke: c.spark, strokeWidth: 2.5, strokeLinecap: 'round' });
  }
  if (i.mood === 'dozing') faceShapes.push(...sleepZs(c.textMuted));
  layers.push({ id: 'face', shapes: faceShapes, breathAmp: 0.012, breathPhase: 0.2 });

  return { layers, pupils };
}

function novaLayers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.nova;
  const ink = darken(tint, 0.72);
  const cape = darken(tint, 0.24);
  const layers: RigLayer[] = [];

  // Cape from Sprout on: flares out behind the body and sways with a lag;
  // the Radiant upgrade gilds its hem.
  if (i.stage >= 2) {
    const capeShapes: RigShape[] = [
      {
        kind: 'path',
        d: 'M 37 55 C 29 64 25 75 28 87 C 35 84 43 85 50 87 C 57 85 65 84 72 87 C 75 75 71 64 63 55 Z',
        fill: cape,
      },
      // A sheen fold so the cape reads as cloth, not a slab.
      {
        kind: 'path',
        d: 'M 40 60 C 35 68 33 76 34 83',
        stroke: lighten(cape, 0.2),
        strokeWidth: 2.5,
        strokeLinecap: 'round',
        fill: 'none',
        opacity: 0.6,
      },
    ];
    if (i.stage >= 4) {
      capeShapes.push({
        kind: 'path',
        d: 'M 28 87 C 35 84 43 85 50 87 C 57 85 65 84 72 87',
        stroke: i.colors.spark,
        strokeWidth: 2.2,
        strokeLinecap: 'round',
        fill: 'none',
        opacity: 0.9,
      });
    }
    if (i.stage >= 6) {
      // The cape turns cosmic: star specks scattered across the cloth.
      capeShapes.push(
        { kind: 'path', d: starPath(33, 68, 1.8), fill: i.colors.spark, opacity: 0.85 },
        { kind: 'path', d: starPath(67, 70, 1.8), fill: i.colors.spark, opacity: 0.85 },
        { kind: 'path', d: starPath(30, 79, 1.5), fill: i.colors.spark, opacity: 0.7 },
        { kind: 'path', d: starPath(70, 80, 1.5), fill: i.colors.spark, opacity: 0.7 },
      );
    }
    if (i.stage >= 7) {
      capeShapes.push(
        { kind: 'path', d: starPath(38, 76, 1.4), fill: i.colors.spark, opacity: 0.75 },
        { kind: 'path', d: starPath(62, 62, 1.4), fill: i.colors.spark, opacity: 0.75 },
      );
    }
    layers.push({
      id: 'back',
      shapes: capeShapes,
      breathAmp: 0.028,
      breathPhase: 0.45,
      sway: 2.5,
      pivot: { x: 50, y: 56 },
    });
  }

  // Arms end in determined little fists; at Mythic a pair of energy stars
  // rides beside them (they sway with the arms, so they read as orbiting).
  if (i.stage >= 2) {
    const armShapes: RigShape[] = [
      { kind: 'line', x1: 36, y1: 62, x2: 27, y2: 70, stroke: darken(tint, 0.06), strokeWidth: 6.5, strokeLinecap: 'round' },
      { kind: 'line', x1: 64, y1: 62, x2: 73, y2: 70, stroke: darken(tint, 0.06), strokeWidth: 6.5, strokeLinecap: 'round' },
      { kind: 'circle', cx: 26.5, cy: 70.5, r: 4.2, fill: darken(tint, 0.16) },
      { kind: 'circle', cx: 73.5, cy: 70.5, r: 4.2, fill: darken(tint, 0.16) },
    ];
    if (i.stage >= 7) {
      armShapes.push(
        { kind: 'path', d: starPath(19.5, 63, 2.2), fill: i.colors.spark, opacity: 0.9 },
        { kind: 'path', d: starPath(80.5, 63, 2.2), fill: i.colors.spark, opacity: 0.9 },
      );
    }
    layers.push({
      id: 'arms',
      shapes: armShapes,
      breathAmp: 0.03,
      breathPhase: 0.3,
      sway: 2,
      pivot: { x: 50, y: 62 },
    });
  }

  // Round head + snug suit torso; the classic hero curl on the crown.
  const bodyShapes: RigShape[] = [
    { kind: 'circle', cx: 50, cy: 34, r: 21.5, fill: bodyFill(tint, i.stage) },
    { kind: 'ellipse', cx: 50, cy: 69, rx: 15, ry: 14, fill: bodyFill(tint, i.stage) },
    ...feet(darken(tint, 0.16)),
    { kind: 'path', d: 'M 50 12.5 C 48.5 7 44 5 40.5 6.8 C 44.8 8 47.2 10.4 48 14 Z', fill: lighten(tint, 0.32) },
  ];
  if (i.stage >= 2) {
    bodyShapes.push({
      kind: 'path',
      d: 'M 36 21 C 33 25 31 30 31 35',
      stroke: lighten(tint, 0.5),
      strokeWidth: 3,
      strokeLinecap: 'round',
      fill: 'none',
      opacity: 0.7,
    });
  }
  layers.push({ id: 'body', shapes: bodyShapes, breathAmp: 0.024, breathPhase: 0 });

  // Utility belt at Grown; epaulettes at Celestial; star diadem at Mythic.
  if (i.stage >= 3) {
    const markings: RigShape[] = [
      { kind: 'rect', x: 38, y: 76, width: 24, height: 4, rx: 2, fill: darken(tint, 0.3) },
      { kind: 'circle', cx: 50, cy: 78, r: 3, fill: i.colors.spark },
    ];
    if (i.stage >= 6) {
      markings.push(
        { kind: 'ellipse', cx: 36, cy: 59.5, rx: 5.5, ry: 3.5, fill: darken(tint, 0.28) },
        { kind: 'ellipse', cx: 64, cy: 59.5, rx: 5.5, ry: 3.5, fill: darken(tint, 0.28) },
        { kind: 'path', d: 'M 32 58.5 Q 36 56.5 40 58.5', stroke: i.colors.spark, strokeWidth: 1.2, strokeLinecap: 'round', fill: 'none', opacity: 0.85 },
        { kind: 'path', d: 'M 60 58.5 Q 64 56.5 68 58.5', stroke: i.colors.spark, strokeWidth: 1.2, strokeLinecap: 'round', fill: 'none', opacity: 0.85 },
      );
    }
    if (i.stage >= 7) {
      markings.push(
        { kind: 'path', d: starPath(41, 17, 1.8), fill: i.colors.spark, opacity: 0.95 },
        { kind: 'path', d: starPath(50, 14, 2.4), fill: i.colors.spark },
        { kind: 'path', d: starPath(59, 17, 1.8), fill: i.colors.spark, opacity: 0.95 },
      );
    }
    layers.push({
      id: 'markings',
      shapes: markings,
      breathAmp: 0.024,
      breathPhase: 0,
    });
  }

  // Chest emblem: the hero star from Sprout on; ringed at Radiant, blazing
  // with an inner star at Luminous.
  if (i.stage >= 2) {
    const emblem: RigShape[] = [
      { kind: 'path', d: starPath(50, 66, i.stage >= 5 ? 6 : 5), fill: i.colors.spark },
    ];
    if (i.stage >= 4) {
      emblem.push({ kind: 'circle', cx: 50, cy: 66, r: 7.5, stroke: i.colors.spark, strokeWidth: 1.6, fill: 'none', opacity: 0.85 });
    }
    if (i.stage >= 5) {
      emblem.push({ kind: 'path', d: starPath(50, 66, 3), fill: lighten(i.colors.spark, 0.55) });
    }
    layers.push({ id: 'front', shapes: emblem, breathAmp: 0.024, breathPhase: 0.1 });
  }

  // The domino mask is the hero identity from day one; eyes sit on top of it
  // so the sclera reads as mask eye-holes.
  const mask: RigShape[] = [
    { kind: 'path', d: 'M 29.5 29 Q 50 24 70.5 29 L 70.5 40.5 Q 50 45 29.5 40.5 Z', fill: darken(tint, 0.34) },
  ];

  const { face, pupils } = cuteFace(
    i,
    { eyeXs: [42, 58], eyeY: 35, mouthY: 47.5, ink, iris: darken(tint, 0.3), blushY: 43.5 },
    mask,
  );
  layers.push(face);
  return { layers, pupils };
}

function rexLayers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.rex;
  const ink = darken(tint, 0.72);
  const plate = lighten(tint, 0.42);
  // Crown spikes go gold at Radiant.
  const spike = i.stage >= 4 ? i.colors.spark : lighten(tint, 0.3);
  const layers: RigLayer[] = [];

  // Crown spikes multiply as Rex grows; a chunky tail rests on the ground.
  const backShapes: RigShape[] = [
    { kind: 'path', d: 'M 44.5 13 L 50 3 L 55.5 13 Z', fill: spike },
    {
      kind: 'path',
      d: 'M 58 80 C 70 82 78 77 80 68 C 83 76 78 84 68 86.5 C 63 87.5 59 85 57 82 Z',
      fill: darken(tint, 0.06),
    },
  ];
  if (i.stage >= 2) {
    backShapes.push(
      { kind: 'path', d: 'M 34.5 17.5 L 38 8.5 L 44 15 Z', fill: spike },
      { kind: 'path', d: 'M 65.5 17.5 L 62 8.5 L 56 15 Z', fill: spike },
    );
  }
  if (i.stage >= 3) {
    backShapes.push(
      { kind: 'path', d: 'M 27 26 L 28 16.5 L 35.5 22 Z', fill: spike },
      { kind: 'path', d: 'M 73 26 L 72 16.5 L 64.5 22 Z', fill: spike },
      // A spike sprouts on the tail too.
      { kind: 'path', d: 'M 73 70 L 79 62.5 L 80.5 71 Z', fill: spike },
    );
  }
  if (i.stage >= 6) {
    backShapes.push(
      // Gem-bright cores light up the crown spikes...
      { kind: 'path', d: 'M 47 12 L 50 6.5 L 53 12 Z', fill: lighten(i.colors.spark, 0.4) },
      { kind: 'path', d: 'M 37.5 15.5 L 39 11.5 L 42 14.5 Z', fill: lighten(i.colors.spark, 0.4) },
      { kind: 'path', d: 'M 62.5 15.5 L 61 11.5 L 58 14.5 Z', fill: lighten(i.colors.spark, 0.4) },
      // ...and a second spike joins the tail ridge.
      { kind: 'path', d: 'M 64 77 L 69.5 69.5 L 72 78 Z', fill: spike },
    );
  }
  if (i.stage >= 7) {
    // Spread dragon wings: a swept top edge out to a clawed tip, scalloped
    // membrane returning to the shoulder — the hatchling was a dragon all
    // along.
    backShapes.push(
      { kind: 'path', d: 'M 35 53 C 28 46 18 41 11 41 Q 14 51 21 56 Q 27 61 34 63 Z', fill: darken(tint, 0.14) },
      { kind: 'path', d: 'M 34 60 C 27 56 20 51 13 44', stroke: lighten(tint, 0.25), strokeWidth: 1.4, strokeLinecap: 'round', fill: 'none', opacity: 0.6 },
      { kind: 'path', d: 'M 11 41 L 8 36.5 L 14.5 38 Z', fill: spike },
      { kind: 'path', d: 'M 65 53 C 72 46 82 41 89 41 Q 86 51 79 56 Q 73 61 66 63 Z', fill: darken(tint, 0.14) },
      { kind: 'path', d: 'M 66 60 C 73 56 80 51 87 44', stroke: lighten(tint, 0.25), strokeWidth: 1.4, strokeLinecap: 'round', fill: 'none', opacity: 0.6 },
      { kind: 'path', d: 'M 89 41 L 92 36.5 L 85.5 38 Z', fill: spike },
    );
  }
  layers.push({ id: 'back', shapes: backShapes, breathAmp: 0.022, breathPhase: 0.35, sway: 1.5 });

  if (i.stage >= 2) layers.push(stubbyArms(darken(tint, 0.05), 63));

  // Big round head over an egg tummy with a lighter belly plate.
  const bodyShapes: RigShape[] = [
    { kind: 'circle', cx: 50, cy: 33, r: 21, fill: bodyFill(tint, i.stage) },
    { kind: 'ellipse', cx: 50, cy: 69, rx: 16, ry: 15, fill: bodyFill(tint, i.stage) },
    ...feet(darken(tint, 0.12)),
  ];
  if (i.stage >= 2) {
    bodyShapes.push(
      { kind: 'ellipse', cx: 50, cy: 72, rx: 10, ry: 8.5, fill: plate, opacity: 0.9 },
      {
        kind: 'path',
        d: 'M 35 21 C 32 25 30 30 30 35',
        stroke: lighten(tint, 0.5),
        strokeWidth: 3,
        strokeLinecap: 'round',
        fill: 'none',
        opacity: 0.7,
      },
    );
  }
  layers.push({ id: 'body', shapes: bodyShapes, breathAmp: 0.026, breathPhase: 0 });

  // Belly-plate seams + freckles arrive at Grown; a gold crest at Mythic.
  if (i.stage >= 3) {
    const markings: RigShape[] = [
      { kind: 'line', x1: 44, y1: 70, x2: 56, y2: 70, stroke: darken(plate, 0.14), strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.7 },
      { kind: 'line', x1: 45, y1: 75, x2: 55, y2: 75, stroke: darken(plate, 0.14), strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.7 },
      { kind: 'circle', cx: 31, cy: 27, r: 1.8, fill: darken(tint, 0.18), opacity: 0.6 },
      { kind: 'circle', cx: 27.5, cy: 32, r: 1.4, fill: darken(tint, 0.18), opacity: 0.6 },
      { kind: 'circle', cx: 69, cy: 27, r: 1.8, fill: darken(tint, 0.18), opacity: 0.6 },
      { kind: 'circle', cx: 72.5, cy: 32, r: 1.4, fill: darken(tint, 0.18), opacity: 0.6 },
    ];
    if (i.stage >= 7) {
      markings.push({ kind: 'path', d: starPath(50, 65, 2.8), fill: i.colors.spark, opacity: 0.95 });
    }
    layers.push({
      id: 'markings',
      shapes: markings,
      breathAmp: 0.026,
      breathPhase: 0,
    });
  }

  // Lighter muzzle patch with little nostrils, under the eyes; a proud gold
  // nose horn grows in at Celestial.
  const muzzle: RigShape[] = [
    { kind: 'ellipse', cx: 50, cy: 45, rx: 10, ry: 6.5, fill: plate, opacity: 0.95 },
    { kind: 'circle', cx: 46.5, cy: 42.5, r: 1.1, fill: ink, opacity: 0.75 },
    { kind: 'circle', cx: 53.5, cy: 42.5, r: 1.1, fill: ink, opacity: 0.75 },
  ];
  if (i.stage >= 6) {
    muzzle.unshift({ kind: 'path', d: 'M 47.5 40 L 50 34 L 52.5 40 Z', fill: i.colors.spark });
  }

  const { face, pupils } = cuteFace(
    i,
    { eyeXs: [41, 59], eyeY: 33, mouthY: 46.5, ink, iris: darken(tint, 0.3), blushY: 40 },
    muzzle,
  );
  layers.push(face);
  return { layers, pupils };
}

function ottoLayers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.otto;
  const ink = darken(tint, 0.72);
  const disc = lighten(tint, 0.45);
  const layers: RigLayer[] = [];

  // Ear tufts; inner feathers at Sprout, proud points at Radiant.
  const backShapes: RigShape[] = [
    { kind: 'path', d: 'M 33 17 L 28 6 L 42 11 Z', fill: darken(tint, 0.08) },
    { kind: 'path', d: 'M 67 17 L 72 6 L 58 11 Z', fill: darken(tint, 0.08) },
  ];
  if (i.stage >= 2) {
    backShapes.push(
      { kind: 'path', d: 'M 33 15 L 30 8.5 L 38 11.5 Z', fill: lighten(tint, 0.3), opacity: 0.8 },
      { kind: 'path', d: 'M 67 15 L 70 8.5 L 62 11.5 Z', fill: lighten(tint, 0.3), opacity: 0.8 },
    );
  }
  if (i.stage >= 4) {
    backShapes.push(
      { kind: 'path', d: 'M 28 6 L 26.5 1.5 L 31 3.8 Z', fill: darken(tint, 0.08) },
      { kind: 'path', d: 'M 72 6 L 73.5 1.5 L 69 3.8 Z', fill: darken(tint, 0.08) },
    );
  }
  if (i.stage >= 7) {
    // A great lunar halo rises behind the head, with a star at each side.
    backShapes.unshift({
      kind: 'circle',
      cx: 50,
      cy: 32,
      r: 26,
      stroke: i.colors.spark,
      strokeWidth: 1.8,
      fill: 'none',
      opacity: 0.45,
    });
    backShapes.push(
      { kind: 'path', d: starPath(24, 32, 1.9), fill: i.colors.spark, opacity: 0.9 },
      { kind: 'path', d: starPath(76, 32, 1.9), fill: i.colors.spark, opacity: 0.9 },
    );
  }
  layers.push({ id: 'back', shapes: backShapes, breathAmp: 0.02, breathPhase: 0.35, sway: 1.5 });

  // Folded wings from Sprout; Luminous wings carry star specks, Celestial
  // adds a pale feather trim, Mythic scatters more stars down the edge.
  if (i.stage >= 2) {
    const wings: RigShape[] = [
      { kind: 'path', d: 'M 31 56 C 25 60 22 70 26 80 C 31 76 34 68 34 59 Z', fill: darken(tint, 0.1) },
      { kind: 'path', d: 'M 69 56 C 75 60 78 70 74 80 C 69 76 66 68 66 59 Z', fill: darken(tint, 0.1) },
    ];
    if (i.stage >= 5) {
      wings.push(
        { kind: 'path', d: starPath(28.5, 68, 2), fill: i.colors.spark, opacity: 0.9 },
        { kind: 'path', d: starPath(71.5, 68, 2), fill: i.colors.spark, opacity: 0.9 },
      );
    }
    if (i.stage >= 6) {
      wings.push(
        { kind: 'path', d: 'M 29 61 C 25.5 66 24.5 72 26.5 77.5', stroke: lighten(tint, 0.3), strokeWidth: 1.6, strokeLinecap: 'round', fill: 'none', opacity: 0.75 },
        { kind: 'path', d: 'M 71 61 C 74.5 66 75.5 72 73.5 77.5', stroke: lighten(tint, 0.3), strokeWidth: 1.6, strokeLinecap: 'round', fill: 'none', opacity: 0.75 },
      );
    }
    if (i.stage >= 7) {
      wings.push(
        { kind: 'path', d: starPath(30.5, 61, 1.5), fill: i.colors.spark, opacity: 0.8 },
        { kind: 'path', d: starPath(69.5, 61, 1.5), fill: i.colors.spark, opacity: 0.8 },
        { kind: 'path', d: starPath(27, 75, 1.5), fill: i.colors.spark, opacity: 0.8 },
        { kind: 'path', d: starPath(73, 75, 1.5), fill: i.colors.spark, opacity: 0.8 },
      );
    }
    layers.push({
      id: 'arms',
      shapes: wings,
      breathAmp: 0.024,
      breathPhase: 0.28,
      sway: 2,
      pivot: { x: 50, y: 57 },
    });
  }

  // Big round head flowing into the tummy; little talon feet.
  const bodyShapes: RigShape[] = [
    { kind: 'circle', cx: 50, cy: 34, r: 22, fill: bodyFill(tint, i.stage) },
    { kind: 'ellipse', cx: 50, cy: 68, rx: 16.5, ry: 15.5, fill: bodyFill(tint, i.stage) },
    { kind: 'ellipse', cx: 42, cy: 87.5, rx: 5, ry: 3.2, fill: darken(tint, 0.28) },
    { kind: 'ellipse', cx: 58, cy: 87.5, rx: 5, ry: 3.2, fill: darken(tint, 0.28) },
  ];
  if (i.stage >= 2) {
    bodyShapes.push({
      kind: 'path',
      d: 'M 35 21 C 32 25 30 30 30 36',
      stroke: lighten(tint, 0.5),
      strokeWidth: 3,
      strokeLinecap: 'round',
      fill: 'none',
      opacity: 0.7,
    });
  }
  layers.push({ id: 'body', shapes: bodyShapes, breathAmp: 0.022, breathPhase: 0 });

  // Chest feathers scallop in at Grown; a moon crest joins at Radiant.
  const markings: RigShape[] = [];
  if (i.stage >= 3) {
    markings.push(
      { kind: 'ellipse', cx: 50, cy: 71, rx: 11, ry: 9, fill: lighten(tint, 0.35), opacity: 0.85 },
      { kind: 'path', d: 'M 42 68 Q 46 71 50 68 Q 54 71 58 68', stroke: darken(tint, 0.06), strokeWidth: 1.6, strokeLinecap: 'round', fill: 'none', opacity: 0.55 },
      { kind: 'path', d: 'M 44 74 Q 47 77 50 74 Q 53 77 56 74', stroke: darken(tint, 0.06), strokeWidth: 1.6, strokeLinecap: 'round', fill: 'none', opacity: 0.55 },
    );
  }
  if (i.stage >= 4) {
    markings.push({
      kind: 'path',
      d: 'M 52 15 A 5 5 0 1 0 55.5 23.5 A 3.8 3.8 0 1 1 52 15 Z',
      fill: i.colors.spark,
      opacity: 0.95,
    });
  }
  if (i.stage >= 6) {
    // A companion star for the moon crest + a trio below the chest feathers.
    markings.push(
      { kind: 'path', d: starPath(60, 14, 1.8), fill: i.colors.spark, opacity: 0.9 },
      { kind: 'path', d: starPath(44.5, 80, 1.5), fill: i.colors.spark, opacity: 0.8 },
      { kind: 'path', d: starPath(50, 82, 1.7), fill: i.colors.spark, opacity: 0.85 },
      { kind: 'path', d: starPath(55.5, 80, 1.5), fill: i.colors.spark, opacity: 0.8 },
    );
  }
  if (markings.length > 0) {
    layers.push({ id: 'markings', shapes: markings, breathAmp: 0.022, breathPhase: 0 });
  }

  // Facial discs behind the huge eyes + a golden beak instead of a mouth.
  const discs: RigShape[] = [
    { kind: 'circle', cx: 41, cy: 35, r: 10.5, fill: disc, opacity: 0.9 },
    { kind: 'circle', cx: 59, cy: 35, r: 10.5, fill: disc, opacity: 0.9 },
  ];

  const { face, pupils } = cuteFace(
    i,
    {
      eyeXs: [41, 59],
      eyeY: 35,
      mouthY: 46.5,
      ink,
      iris: darken(tint, 0.28),
      blushY: 45,
      eyeScale: 1.18,
      beak: i.colors.spark,
    },
    discs,
  );
  layers.push(face);
  return { layers, pupils };
}

// ---------- the builder ----------

export function buildRig(i: RigInputs): RigModel {
  const tint = i.colors.companion[i.species];
  const layers: RigLayer[] = [groundShadow(i.colors)];
  if (i.stage >= 4) layers.push(auraLayer(tint, i.stage));

  const shell =
    i.species === 'wisp'
      ? wispLayers(i)
      : i.species === 'pip'
        ? pipLayers(i)
        : i.species === 'juno'
          ? junoLayers(i)
          : i.species === 'nova'
            ? novaLayers(i)
            : i.species === 'rex'
              ? rexLayers(i)
              : i.species === 'otto'
                ? ottoLayers(i)
                : unit7Layers(i);
  layers.push(...shell.layers);

  if (i.stage >= 5) layers.push(shimmerLayer(tint, i.stage));

  const acc = accessoryLayer(i.accessories, i.colors);
  if (acc) layers.push(acc);

  const guard = guardLayer(i.colors, i.shields ?? 0);
  if (guard) layers.push(guard);

  return {
    layers,
    baseScale: stageScale(i.stage),
    pupils: shell.pupils,
    motes: i.stage >= 4,
    // Wisp hovers — a candle-flame bob with the shadow reacting below.
    float: i.species === 'wisp' ? 1.4 : undefined,
  };
}
