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
  | 'accessory';

export interface RigLayer {
  id: RigLayerId;
  shapes: RigShape[];
  /** Squash-and-stretch amplitude (0 = rigid). */
  breathAmp: number;
  /** Phase offset (0..1) — features lag the body for follow-through. */
  breathPhase: number;
  /** Gentle rotation amplitude in degrees (leaves, flames, tails, arms). */
  sway?: number;
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
  /** Ambient tint motes drift around the companion (stages 4–5). */
  motes: boolean;
}

export interface RigInputs {
  species: CompanionSpecies;
  stage: number;
  mood: CompanionMood;
  eyesClosed: boolean;
  colors: ThemeColors;
  accessories: string[];
}

// ---------- shared pieces ----------

/** Per-stage overall scale: hatchling-small up to a touch over full size. */
export function stageScale(stage: number): number {
  if (stage <= 1) return 0.78;
  if (stage <= 3) return 1;
  if (stage === 4) return 1.04;
  return 1.08;
}

const WHITE = '#FFFFFF';

function bodyGradient(tint: string): RadialFill {
  return {
    type: 'radial',
    cx: 42,
    cy: 34,
    r: 62,
    stops: [
      { offset: 0, color: lighten(tint, 0.32) },
      { offset: 0.55, color: tint },
      { offset: 1, color: darken(tint, 0.18) },
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

/** Luminous-stage shimmer: tiny sparkles over the character, gently pulsing. */
function shimmerLayer(tint: string): RigLayer {
  const spark = lighten(tint, 0.6);
  return {
    id: 'shimmer',
    shapes: [
      { kind: 'path', d: starPath(33, 30, 3), fill: spark, opacity: 0.8 },
      { kind: 'path', d: starPath(68, 24, 2.4), fill: spark, opacity: 0.7 },
      { kind: 'path', d: starPath(70, 72, 2.8), fill: spark, opacity: 0.75 },
      { kind: 'path', d: starPath(30, 76, 2.2), fill: spark, opacity: 0.65 },
    ],
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
  if (shapes.length === 0) return null;
  return { id: 'accessory', shapes, breathAmp: 0.02, breathPhase: 0.05 };
}

// ---------- the cartoon face (organic species) ----------

interface FaceSpec {
  /** Eye centers, symmetric on the head. */
  eyeXs: [number, number];
  eyeY: number;
  mouthY: number;
  /** Deep species-dark used for pupils, arcs and the mouth. */
  ink: string;
  blushY?: number;
}

/**
 * Big-cartoon-eyes face shared by the organic species: white sclera in the
 * face layer, wandering pupil + specular highlight in the pupil group.
 * Hatchlings get even bigger eyes; blush arrives at Grown.
 */
function cuteFace(
  i: RigInputs,
  spec: FaceSpec,
  extra: RigShape[] = [],
): { face: RigLayer; pupils: RigModel['pupils'] } {
  const shapes: RigShape[] = [...extra];
  let pupils: RigModel['pupils'] = null;
  const big = i.stage <= 1;
  const scleraRx = big ? 7.2 : 6;
  const scleraRy = big ? 8.4 : 7;
  const pupilR = (big ? 4.6 : 3.9) + (i.mood === 'alert' ? 0.6 : 0);
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
    const pupilShapes: RigShape[] = [lx, rx].flatMap((x): RigShape[] => [
      { kind: 'circle', cx: x, cy: spec.eyeY + 0.6, r: pupilR, fill: spec.ink },
      { kind: 'circle', cx: x + 1.4, cy: spec.eyeY - 1.2, r: 1.5, fill: WHITE, opacity: 0.95 },
    ]);
    pupils = { shapes: pupilShapes, range: 2.2 };
  }
  if (i.stage >= 3 && spec.blushY != null) {
    shapes.push(...blush(spec.blushY, WHITE));
  }
  shapes.push(mouthShape(spec.mouthY, i.mood, spec.ink));
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

  // Side flames flank the head from Sprout on.
  if (i.stage >= 2) {
    layers.push({
      id: 'back',
      shapes: [
        { kind: 'path', d: 'M 28 44 C 22 36 24 26 30 20 C 29 30 31 37 36 43 Z', fill: darken(tint, 0.06), opacity: 0.8 },
        { kind: 'path', d: 'M 72 44 C 78 36 76 26 70 20 C 71 30 69 37 64 43 Z', fill: darken(tint, 0.06), opacity: 0.8 },
      ],
      breathAmp: 0.03,
      breathPhase: 0.4,
      sway: 2.5,
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
    layers.push({
      id: 'markings',
      shapes: [
        { kind: 'path', d: 'M 40 63 C 39 67 39 72 40 76', stroke: darken(tint, 0.14), strokeWidth: 2.2, strokeLinecap: 'round', fill: 'none', opacity: 0.5 },
        { kind: 'path', d: 'M 60 63 C 61 67 61 72 60 76', stroke: darken(tint, 0.14), strokeWidth: 2.2, strokeLinecap: 'round', fill: 'none', opacity: 0.5 },
      ],
      breathAmp: 0.022,
      breathPhase: 0,
    });
  }

  // Tail flame (always) + crown-flame at Radiant; Luminous lights a tongue.
  const front: RigShape[] = [
    { kind: 'path', d: 'M 50 81 C 55 85 53 91 50 94 C 47 91 45 85 50 81 Z', fill: lighten(tint, 0.2), opacity: 0.95 },
  ];
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
  }
  layers.push({ id: 'front', shapes: front, breathAmp: 0.026, breathPhase: 0.35, sway: 3 });

  const { face, pupils } = cuteFace(i, {
    eyeXs: [42, 58],
    eyeY: 36,
    mouthY: 47,
    ink,
    blushY: 43,
  });
  layers.push(face);
  return { layers, pupils };
}

function pipLayers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.pip;
  const ink = darken(tint, 0.72);
  const layers: RigLayer[] = [];

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
    layers.push({
      id: 'markings',
      shapes: [
        { kind: 'circle', cx: 37, cy: 68, r: 3.5, fill: WHITE, opacity: 0.35 },
        { kind: 'circle', cx: 63, cy: 68, r: 3.5, fill: WHITE, opacity: 0.35 },
      ],
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
    layers.push({ id: 'front', shapes: sprout, breathAmp: 0.02, breathPhase: 0.3, sway: 3 });
  }

  const { face, pupils } = cuteFace(i, {
    eyeXs: [42, 58],
    eyeY: 34,
    mouthY: 45,
    ink,
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
    { eyeXs: [41, 59], eyeY: 35, mouthY: 48, ink, blushY: 42 },
    whiskers,
  );
  layers.push(face);
  return { layers, pupils };
}

function unit7Layers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.unit7;
  const c = i.colors;
  const layers: RigLayer[] = [];

  // Side fins from Sprout on (behind the arms).
  if (i.stage >= 2) {
    layers.push({
      id: 'back',
      shapes: [
        { kind: 'rect', x: 21, y: 51, width: 6, height: 13, rx: 3, fill: darken(tint, 0.1) },
        { kind: 'rect', x: 73, y: 51, width: 6, height: 13, rx: 3, fill: darken(tint, 0.1) },
      ],
      breathAmp: 0.018,
      breathPhase: 0.3,
    });
  }

  if (i.stage >= 2) {
    layers.push({
      id: 'arms',
      shapes: [
        { kind: 'rect', x: 26, y: 52, width: 7, height: 16, rx: 3.5, fill: darken(tint, 0.1) },
        { kind: 'rect', x: 67, y: 52, width: 7, height: 16, rx: 3.5, fill: darken(tint, 0.1) },
      ],
      breathAmp: 0.02,
      breathPhase: 0.28,
      sway: 1.5,
    });
  }

  // Big screen head on a boxy little torso with chunky boots.
  const bodyShapes: RigShape[] = [
    { kind: 'rect', x: 29, y: 14, width: 42, height: 32, rx: 10, fill: bodyFill(tint, i.stage) },
    { kind: 'rect', x: 35, y: 48, width: 30, height: 28, rx: 8, fill: bodyFill(tint, i.stage) },
    { kind: 'rect', x: 37, y: 78, width: 11, height: 8, rx: 3.5, fill: darken(tint, 0.12) },
    { kind: 'rect', x: 52, y: 78, width: 11, height: 8, rx: 3.5, fill: darken(tint, 0.12) },
    // Screen inset + a faint spark-colored rim so the face reads lit.
    { kind: 'rect', x: 34, y: 20, width: 32, height: 22, rx: 6, fill: c.text, opacity: 0.85 },
    { kind: 'rect', x: 34, y: 20, width: 32, height: 22, rx: 6, stroke: c.spark, strokeWidth: 1.5, fill: 'none', opacity: i.stage >= 5 ? 0.6 : 0.35 },
  ];
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
  layers.push({
    id: 'front',
    shapes: antenna,
    breathAmp: 0.016,
    breathPhase: 0.3,
    sway: 2.5,
  });

  // Screen face: big rounded rect eyes wander; arcs replace them when closed.
  const big = i.stage <= 1;
  const eyeW = big ? 9 : 8;
  const eyeH = big ? 11 : 10;
  const faceShapes: RigShape[] = [];
  let pupils: RigModel['pupils'] = null;
  if (i.eyesClosed) {
    faceShapes.push(
      { kind: 'rect', x: 37, y: 28, width: 9, height: 2.5, rx: 1.2, fill: c.spark },
      { kind: 'rect', x: 54, y: 28, width: 9, height: 2.5, rx: 1.2, fill: c.spark },
    );
  } else {
    const tall = i.mood === 'alert';
    pupils = {
      shapes: [
        { kind: 'rect', x: 41.5 - eyeW / 2, y: tall ? 22.5 : 24, width: eyeW, height: tall ? eyeH + 1.5 : eyeH, rx: 2.5, fill: c.spark },
        { kind: 'rect', x: 58.5 - eyeW / 2, y: tall ? 22.5 : 24, width: eyeW, height: tall ? eyeH + 1.5 : eyeH, rx: 2.5, fill: c.spark },
      ],
      range: 1.6,
    };
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
          : unit7Layers(i);
  layers.push(...shell.layers);

  if (i.stage >= 5) layers.push(shimmerLayer(tint));

  const acc = accessoryLayer(i.accessories, i.colors);
  if (acc) layers.push(acc);

  return {
    layers,
    baseScale: stageScale(i.stage),
    pupils: shell.pupils,
    motes: i.stage >= 4,
  };
}
