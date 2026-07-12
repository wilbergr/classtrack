// Rig v2 model: a pure parametric description of the companion —
// (species, stage, mood, theme) → layers of primitive shapes plus animation
// params. Renderers (SVG today, Skia later) draw the same model; all
// continuous motion is applied by the renderer as wrapper transforms, never
// as per-frame SVG prop changes (the New-Architecture-safe pattern).

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
  | 'body'
  | 'markings'
  | 'face'
  | 'front'
  | 'accessory';

export interface RigLayer {
  id: RigLayerId;
  shapes: RigShape[];
  /** Squash-and-stretch amplitude (0 = rigid). */
  breathAmp: number;
  /** Phase offset (0..1) — features lag the body for follow-through. */
  breathPhase: number;
  /** Gentle rotation amplitude in degrees (leaves, flames, antennae). */
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
  if (stage <= 1) return 0.85;
  if (stage === 2) return 1;
  return 1.04;
}

function bodyGradient(tint: string): RadialFill {
  return {
    type: 'radial',
    cx: 42,
    cy: 44,
    r: 58,
    stops: [
      { offset: 0, color: lighten(tint, 0.32) },
      { offset: 0.55, color: tint },
      { offset: 1, color: darken(tint, 0.18) },
    ],
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

function auraLayer(tint: string): RigLayer {
  const ring = (r: number, opacity: number): RigShape => ({
    kind: 'circle',
    cx: 50,
    cy: 56,
    r,
    fill: {
      type: 'radial',
      cx: 50,
      cy: 56,
      r,
      stops: [
        { offset: 0.55, color: tint, opacity: 0 },
        { offset: 0.85, color: tint, opacity },
        { offset: 1, color: tint, opacity: 0 },
      ],
    },
  });
  return {
    id: 'aura',
    shapes: [ring(46, 0.28), ring(41, 0.16), ring(36, 0.09)],
    breathAmp: 0,
    breathPhase: 0,
    pulse: true,
  };
}

/** Closed eyes (gentle arcs) / celebrating (happy arcs) drawn in the face layer. */
function eyeArcs(y: number, color: string, happy: boolean): RigShape[] {
  const xs = [41, 59];
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

function roundPupils(y: number, r: number, color: string): RigShape[] {
  return [41, 59].map((x): RigShape => ({ kind: 'circle', cx: x, cy: y, r, fill: color }));
}

function mouthShape(y: number, mood: CompanionMood, color: string): RigShape {
  if (mood === 'dozing') {
    return { kind: 'line', x1: 46, y1: y, x2: 54, y2: y, stroke: color, strokeWidth: 2, strokeLinecap: 'round' };
  }
  if (mood === 'alert') {
    return { kind: 'circle', cx: 50, cy: y, r: 3, fill: color };
  }
  if (mood === 'celebrating') {
    return { kind: 'path', d: `M 42 ${y - 2} Q 50 ${y + 8} 58 ${y - 2} Z`, fill: color };
  }
  return {
    kind: 'path',
    d: `M 44 ${y} Q 50 ${y + 5} 56 ${y}`,
    stroke: color,
    strokeWidth: 2.4,
    strokeLinecap: 'round',
    fill: 'none',
  };
}

function blush(y: number, color: string): RigShape[] {
  return [
    { kind: 'ellipse', cx: 33, cy: y, rx: 4.5, ry: 2.6, fill: color, opacity: 0.28 },
    { kind: 'ellipse', cx: 67, cy: y, rx: 4.5, ry: 2.6, fill: color, opacity: 0.28 },
  ];
}

/** The sleepy "z z" (path-drawn so every renderer can show it). */
function sleepZs(color: string): RigShape[] {
  return [
    {
      kind: 'path',
      d: 'M 70 20 L 79 20 L 70 29 L 79 29',
      stroke: color,
      strokeWidth: 2.4,
      strokeLinecap: 'round',
      fill: 'none',
    },
    {
      kind: 'path',
      d: 'M 80 8 L 87 8 L 80 15 L 87 15',
      stroke: color,
      strokeWidth: 2,
      strokeLinecap: 'round',
      fill: 'none',
      opacity: 0.7,
    },
  ];
}

/** Shop accessories, species-generic (same anchors as the v1 rig). */
function accessoryLayer(keys: string[], c: ThemeColors): RigLayer | null {
  const shapes: RigShape[] = [];
  if (keys.includes('halo')) {
    shapes.push({
      kind: 'ellipse',
      cx: 50,
      cy: 7,
      rx: 16,
      ry: 4.5,
      stroke: c.spark,
      strokeWidth: 3,
      fill: 'none',
    });
  }
  if (keys.includes('scarf')) {
    shapes.push(
      { kind: 'path', d: 'M 30 80 Q 50 90 70 80 L 70 87 Q 50 96 30 87 Z', fill: c.danger },
      { kind: 'rect', x: 60, y: 82, width: 8, height: 14, rx: 3, fill: c.danger },
    );
  }
  if (keys.includes('bowtie')) {
    shapes.push(
      { kind: 'path', d: 'M 50 84 L 38 78 L 38 90 Z', fill: c.primary },
      { kind: 'path', d: 'M 50 84 L 62 78 L 62 90 Z', fill: c.primary },
      { kind: 'circle', cx: 50, cy: 84, r: 3, fill: c.primary },
    );
  }
  if (shapes.length === 0) return null;
  return { id: 'accessory', shapes, breathAmp: 0.02, breathPhase: 0.05 };
}

// ---------- species shells ----------

interface FaceSpec {
  eyeY: number;
  eyeColor: string;
  mouthY: number;
  mouthColor: string;
  blushY?: number;
  blushColor?: string;
}

/** Face + pupils shared across the organic species. */
function organicFace(
  i: RigInputs,
  spec: FaceSpec,
  extra: RigShape[] = [],
): { face: RigLayer; pupils: RigModel['pupils'] } {
  const shapes: RigShape[] = [...extra];
  let pupils: RigModel['pupils'] = null;
  if (i.eyesClosed) {
    shapes.push(...eyeArcs(spec.eyeY, spec.eyeColor, false));
  } else if (i.mood === 'celebrating') {
    shapes.push(...eyeArcs(spec.eyeY, spec.eyeColor, true));
  } else {
    const r = i.mood === 'alert' ? 5.5 : 4.5;
    pupils = { shapes: roundPupils(spec.eyeY, r, spec.eyeColor), range: 2.2 };
  }
  if (spec.blushY && spec.blushColor) shapes.push(...blush(spec.blushY, spec.blushColor));
  shapes.push(mouthShape(spec.mouthY, i.mood, spec.mouthColor));
  if (i.mood === 'dozing') shapes.push(...sleepZs(i.colors.textMuted));
  return {
    face: { id: 'face', shapes, breathAmp: 0.015, breathPhase: 0.22 },
    pupils,
  };
}

function wispLayers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.wisp;
  const layers: RigLayer[] = [];

  if (i.stage >= 2) {
    layers.push({
      id: 'back',
      shapes: [
        { kind: 'path', d: 'M 16 66 C 12 56 16 48 22 42 C 22 52 24 58 28 64 Z', fill: darken(tint, 0.06), opacity: 0.8 },
        { kind: 'path', d: 'M 84 66 C 88 56 84 48 78 42 C 78 52 76 58 72 64 Z', fill: darken(tint, 0.06), opacity: 0.8 },
      ],
      breathAmp: 0.03,
      breathPhase: 0.4,
      sway: 2.5,
    });
  }

  layers.push({
    id: 'body',
    shapes: [
      {
        kind: 'path',
        d: 'M 50 8 C 66 26 78 40 78 58 C 78 78 65 92 50 92 C 35 92 22 78 22 58 C 22 40 34 26 50 8 Z',
        fill: bodyGradient(tint),
      },
      // Rim light along the upper left, inner glow core.
      {
        kind: 'path',
        d: 'M 41 20 C 33 30 27 40 26 52',
        stroke: lighten(tint, 0.5),
        strokeWidth: 3,
        strokeLinecap: 'round',
        fill: 'none',
        opacity: 0.7,
      },
      { kind: 'ellipse', cx: 50, cy: 64, rx: 17, ry: 15, fill: '#FFFFFF', opacity: 0.4 },
    ],
    breathAmp: 0.022,
    breathPhase: 0,
  });

  const { face, pupils } = organicFace(i, {
    eyeY: 58,
    eyeColor: i.colors.text,
    mouthY: 70,
    mouthColor: i.colors.text,
    blushY: 65,
    blushColor: '#FFFFFF',
  });
  layers.push(face);
  return { layers, pupils };
}

function pipLayers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.pip;
  const layers: RigLayer[] = [];

  layers.push({
    id: 'body',
    shapes: [
      { kind: 'ellipse', cx: 50, cy: 59, rx: 33, ry: 31, fill: bodyGradient(tint) },
      // Belly patch + rim light + toe bumps.
      { kind: 'ellipse', cx: 50, cy: 70, rx: 16, ry: 11, fill: lighten(tint, 0.28), opacity: 0.55 },
      {
        kind: 'path',
        d: 'M 27 44 C 24 50 23 56 24 63',
        stroke: lighten(tint, 0.5),
        strokeWidth: 3,
        strokeLinecap: 'round',
        fill: 'none',
        opacity: 0.7,
      },
      { kind: 'ellipse', cx: 38, cy: 42, rx: 9, ry: 6, fill: '#FFFFFF', opacity: 0.3 },
    ],
    breathAmp: 0.024,
    breathPhase: 0,
  });

  layers.push({
    id: 'markings',
    shapes: [
      { kind: 'circle', cx: 31, cy: 66, r: 4.5, fill: '#FFFFFF', opacity: 0.35 },
      { kind: 'circle', cx: 69, cy: 66, r: 4.5, fill: '#FFFFFF', opacity: 0.35 },
    ],
    breathAmp: 0.024,
    breathPhase: 0,
  });

  if (i.stage >= 2) {
    layers.push({
      id: 'front',
      shapes: [
        { kind: 'line', x1: 50, y1: 28, x2: 50, y2: 16, stroke: darken(tint, 0.1), strokeWidth: 2.5, strokeLinecap: 'round' },
        { kind: 'ellipse', cx: 56, cy: 13, rx: 6.5, ry: 4, fill: i.colors.done },
        { kind: 'ellipse', cx: 45, cy: 15, rx: 4.5, ry: 3, fill: i.colors.done, opacity: 0.85 },
      ],
      breathAmp: 0.02,
      breathPhase: 0.3,
      sway: 3,
    });
  }

  const { face, pupils } = organicFace(i, {
    eyeY: 55,
    eyeColor: '#FFFFFF',
    mouthY: 68,
    mouthColor: '#FFFFFF',
    blushY: 61,
    blushColor: '#FFFFFF',
  });
  layers.push(face);
  return { layers, pupils };
}

function junoLayers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.juno;
  const layers: RigLayer[] = [];

  // Ears lag the body a touch — organic follow-through.
  layers.push({
    id: 'back',
    shapes: [
      { kind: 'path', d: 'M 26 44 L 22 18 L 42 32 Z', fill: darken(tint, 0.08) },
      { kind: 'path', d: 'M 74 44 L 78 18 L 58 32 Z', fill: darken(tint, 0.08) },
      { kind: 'path', d: 'M 27 41 L 25 25 L 38 34 Z', fill: lighten(tint, 0.35), opacity: 0.7 },
      { kind: 'path', d: 'M 73 41 L 75 25 L 62 34 Z', fill: lighten(tint, 0.35), opacity: 0.7 },
    ],
    breathAmp: 0.02,
    breathPhase: 0.35,
    sway: 1.5,
  });

  layers.push({
    id: 'body',
    shapes: [
      { kind: 'circle', cx: 50, cy: 60, r: 31, fill: bodyGradient(tint) },
      { kind: 'ellipse', cx: 50, cy: 74, rx: 14, ry: 10, fill: lighten(tint, 0.3), opacity: 0.5 },
      {
        kind: 'path',
        d: 'M 28 47 C 25 53 24 59 25 66',
        stroke: lighten(tint, 0.5),
        strokeWidth: 3,
        strokeLinecap: 'round',
        fill: 'none',
        opacity: 0.7,
      },
    ],
    breathAmp: 0.022,
    breathPhase: 0,
  });

  const markings: RigShape[] = [];
  if (i.stage >= 2) {
    markings.push(
      { kind: 'line', x1: 44, y1: 33, x2: 44, y2: 40, stroke: '#FFFFFF', strokeWidth: 2.5, strokeLinecap: 'round', opacity: 0.4 },
      { kind: 'line', x1: 50, y1: 31, x2: 50, y2: 39, stroke: '#FFFFFF', strokeWidth: 2.5, strokeLinecap: 'round', opacity: 0.4 },
      { kind: 'line', x1: 56, y1: 33, x2: 56, y2: 40, stroke: '#FFFFFF', strokeWidth: 2.5, strokeLinecap: 'round', opacity: 0.4 },
    );
  }
  if (markings.length > 0) {
    layers.push({ id: 'markings', shapes: markings, breathAmp: 0.022, breathPhase: 0 });
  }

  const whiskers: RigShape[] = [
    { kind: 'line', x1: 18, y1: 62, x2: 34, y2: 64, stroke: '#FFFFFF', strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.65 },
    { kind: 'line', x1: 18, y1: 70, x2: 34, y2: 69, stroke: '#FFFFFF', strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.65 },
    { kind: 'line', x1: 82, y1: 62, x2: 66, y2: 64, stroke: '#FFFFFF', strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.65 },
    { kind: 'line', x1: 82, y1: 70, x2: 66, y2: 69, stroke: '#FFFFFF', strokeWidth: 1.6, strokeLinecap: 'round', opacity: 0.65 },
    { kind: 'path', d: 'M 47 66 L 53 66 L 50 70 Z', fill: '#FFFFFF' },
  ];

  const { face, pupils } = organicFace(
    i,
    { eyeY: 56, eyeColor: '#FFFFFF', mouthY: 74, mouthColor: '#FFFFFF', blushY: 63, blushColor: '#FFFFFF' },
    whiskers,
  );
  layers.push(face);
  return { layers, pupils };
}

function unit7Layers(i: RigInputs): { layers: RigLayer[]; pupils: RigModel['pupils'] } {
  const tint = i.colors.companion.unit7;
  const c = i.colors;
  const layers: RigLayer[] = [];

  if (i.stage >= 2) {
    layers.push({
      id: 'back',
      shapes: [
        { kind: 'rect', x: 12, y: 50, width: 9, height: 16, rx: 3, fill: darken(tint, 0.1) },
        { kind: 'rect', x: 79, y: 50, width: 9, height: 16, rx: 3, fill: darken(tint, 0.1) },
      ],
      breathAmp: 0.018,
      breathPhase: 0.3,
    });
  }

  layers.push({
    id: 'body',
    shapes: [
      { kind: 'rect', x: 22, y: 30, width: 56, height: 52, rx: 12, fill: bodyGradient(tint) },
      // Screen inset + a faint spark-colored rim so the face reads lit.
      { kind: 'rect', x: 28, y: 38, width: 44, height: 36, rx: 8, fill: c.text, opacity: 0.85 },
      { kind: 'rect', x: 28, y: 38, width: 44, height: 36, rx: 8, stroke: c.spark, strokeWidth: 1.5, fill: 'none', opacity: 0.35 },
      {
        kind: 'path',
        d: 'M 26 36 C 25 44 25 52 26 60',
        stroke: lighten(tint, 0.45),
        strokeWidth: 2.5,
        strokeLinecap: 'round',
        fill: 'none',
        opacity: 0.8,
      },
    ],
    breathAmp: 0.014,
    breathPhase: 0,
  });

  // Antenna sways gently; the tip light dims while dozing.
  layers.push({
    id: 'front',
    shapes: [
      { kind: 'line', x1: 50, y1: 30, x2: 50, y2: 16, stroke: darken(tint, 0.08), strokeWidth: 3 },
      { kind: 'circle', cx: 50, cy: 13, r: 4.5, fill: i.mood === 'dozing' ? c.textMuted : c.spark },
    ],
    breathAmp: 0.016,
    breathPhase: 0.3,
    sway: 2.5,
  });

  // Screen face: rect eyes wander slightly; arcs replace them when closed.
  const faceShapes: RigShape[] = [];
  let pupils: RigModel['pupils'] = null;
  if (i.eyesClosed) {
    faceShapes.push(
      { kind: 'rect', x: 36, y: 52, width: 10, height: 2.5, rx: 1.2, fill: c.spark },
      { kind: 'rect', x: 54, y: 52, width: 10, height: 2.5, rx: 1.2, fill: c.spark },
    );
  } else {
    const tall = i.mood === 'alert';
    pupils = {
      shapes: [
        { kind: 'rect', x: 36, y: tall ? 46 : 48, width: 10, height: tall ? 10 : 8, rx: 2, fill: c.spark },
        { kind: 'rect', x: 54, y: tall ? 46 : 48, width: 10, height: tall ? 10 : 8, rx: 2, fill: c.spark },
      ],
      range: 1.6,
    };
  }
  if (i.mood === 'celebrating') {
    faceShapes.push({
      kind: 'path',
      d: 'M 40 64 Q 50 70 60 64',
      stroke: c.spark,
      strokeWidth: 2.5,
      strokeLinecap: 'round',
      fill: 'none',
    });
  } else {
    faceShapes.push({ kind: 'line', x1: 42, y1: 66, x2: 58, y2: 66, stroke: c.spark, strokeWidth: 2.5, strokeLinecap: 'round' });
  }
  if (i.mood === 'dozing') faceShapes.push(...sleepZs(c.textMuted));
  layers.push({ id: 'face', shapes: faceShapes, breathAmp: 0.012, breathPhase: 0.2 });

  return { layers, pupils };
}

// ---------- the builder ----------

export function buildRig(i: RigInputs): RigModel {
  const tint = i.colors.companion[i.species];
  const layers: RigLayer[] = [groundShadow(i.colors)];
  if (i.stage >= 3) layers.push(auraLayer(tint));

  const shell =
    i.species === 'wisp'
      ? wispLayers(i)
      : i.species === 'pip'
        ? pipLayers(i)
        : i.species === 'juno'
          ? junoLayers(i)
          : unit7Layers(i);
  layers.push(...shell.layers);

  const acc = accessoryLayer(i.accessories, i.colors);
  if (acc) layers.push(acc);

  return { layers, baseScale: stageScale(i.stage), pupils: shell.pupils };
}
