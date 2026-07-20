// Scene model: a pure parametric description of the Home backdrop — an
// illustrated little room the companion stands in, in the spirit of Finch's
// home. Same pattern as the companion rig (companion/model.ts): (themeId,
// colors, dayPhase) → layers of primitive shapes. The renderer (Scenery.tsx)
// draws it as static react-native-svg art; because the model is pure TS it
// also serializes to SVG for offline spot-checks (scripts/preview-scenery.js),
// exactly like scripts/generate-branding.js does for the rig.
//
// Every color is derived from the active palette's tokens (the palette is
// already companion-driven), so the scene is themed per companion with no
// hardcoded colors — the only literal is white, matching the rig.
//
// Coordinate space: 100 (w) × 176 (h), rendered "slice" to cover the screen.
// The wall runs 0→FLOOR_Y; the companion stands on the floor line ~FLOOR_Y.

import type { ThemeColors } from '../../theme';
import type { ThemeId } from '../../types';
import type { RigShape } from '../companion/model';
import { darken, lighten, mix } from '../companion/color';

export type SkyKind = 'sun' | 'day' | 'moon' | 'stars' | 'sea';
export type WallKind = 'wood' | 'plain' | 'panel';
export type PropKind = 'plantLeft' | 'plantRight' | 'shelf' | 'bookshelf';
export type MoteKind = 'spark' | 'leaf' | 'bubble' | 'star' | 'none';
export type DayPhase = 'morning' | 'day' | 'evening';

export interface SceneMotif {
  sky: SkyKind;
  wall: WallKind;
  props: PropKind[];
  motes: MoteKind;
  curtains?: boolean;
}

export const SCENE_W = 100;
export const SCENE_H = 176;
/** Wall/floor horizon; the companion's feet read as planted just above it. */
export const FLOOR_Y = 108;

const WHITE = '#FFFFFF';

/**
 * One motif per theme. The palette already reflects the chosen companion, so
 * this only picks the *scenery* flavor (hearth vs garden vs study nook …) so
 * each sidekick's room feels its own. Companion signature themes are the
 * headline scenes; the à-la-carte themes reuse the closest mood.
 */
export const SCENE_MOTIF: Record<ThemeId, SceneMotif> = {
  // Companion signature themes.
  ember: { sky: 'sun', wall: 'wood', props: ['plantRight', 'shelf'], motes: 'spark' }, // wisp — warm hearth
  meadow: { sky: 'day', wall: 'plain', props: ['plantLeft', 'plantRight'], motes: 'leaf' }, // pip — garden
  dusk: { sky: 'moon', wall: 'plain', props: ['shelf'], motes: 'star', curtains: true }, // juno — twilight
  circuit: { sky: 'stars', wall: 'panel', props: ['shelf'], motes: 'star' }, // unit7 — workshop
  rocket: { sky: 'stars', wall: 'plain', props: ['shelf'], motes: 'star' }, // nova — comic sky
  lagoon: { sky: 'sea', wall: 'plain', props: ['plantRight'], motes: 'bubble' }, // rex — splash pool
  nocturne: { sky: 'moon', wall: 'wood', props: ['bookshelf'], motes: 'star', curtains: true }, // otto — study nook
  // À-la-carte themes (no companion of their own).
  slate: { sky: 'day', wall: 'plain', props: ['plantLeft'], motes: 'none' },
  pop: { sky: 'day', wall: 'plain', props: ['plantRight'], motes: 'star' },
  paper: { sky: 'sun', wall: 'wood', props: ['plantLeft'], motes: 'none' },
  mono: { sky: 'day', wall: 'plain', props: ['plantLeft'], motes: 'none' },
  midnight: { sky: 'moon', wall: 'plain', props: ['shelf'], motes: 'star' },
  neon: { sky: 'stars', wall: 'panel', props: [], motes: 'star' },
  ocean: { sky: 'sea', wall: 'plain', props: ['plantLeft'], motes: 'bubble' },
  aurora: { sky: 'moon', wall: 'plain', props: [], motes: 'star' },
};

export interface SceneModel {
  /** Ordered back→front; the renderer paints them in array order. */
  shapes: RigShape[];
  /** Foreground drifting particle kind (renderer animates wrapper transforms). */
  motes: MoteKind;
  /** Tint for the foreground drift motes. */
  moteTint: string;
}

// ---------- palette roles derived from tokens ----------

interface Roles {
  wall: string;
  wallTrim: string;
  wainscot: string;
  floor: string;
  floorLine: string;
  frame: string;
  ink: string;
  light: string;
  sky: string;
  skyLow: string;
  foliage: string;
  foliageDeep: string;
  pot: string;
  accent: string;
}

function roles(c: ThemeColors, motif: SceneMotif, phase: DayPhase): Roles {
  const dim = c.statusBar === 'light'; // dark surface
  // Wall: the room tone, nudged off the screen bg toward the primary accent so
  // the scene reads as a lit space behind the flat UI, deeper than bg.
  const wallBase = mix(c.bg, c.primary, dim ? 0.12 : 0.07);
  const wall = motif.wall === 'wood' ? mix(wallBase, c.spark, 0.1) : wallBase;
  // Sky base per phase (night skies ignore phase).
  const daySky = mix(c.upcoming, WHITE, dim ? 0.12 : 0.5);
  const skyByPhase =
    phase === 'evening'
      ? mix(daySky, c.dayPhase.evening, 0.5)
      : phase === 'morning'
        ? mix(daySky, c.dayPhase.morning, 0.35)
        : daySky;
  return {
    wall,
    wallTrim: darken(wall, dim ? 0.12 : 0.08),
    wainscot: mix(wall, c.border, dim ? 0.45 : 0.6),
    floor: darken(mix(c.bg, c.primary, dim ? 0.16 : 0.1), dim ? 0.1 : 0.05),
    floorLine: darken(mix(c.bg, c.text, 0.14), 0.05),
    frame: motif.wall === 'wood' ? darken(mix(c.spark, c.text, 0.25), 0.1) : mix(c.border, c.text, 0.2),
    ink: mix(c.text, c.bg, 0.15),
    light: lighten(c.spark, dim ? 0.1 : 0.2),
    sky: skyByPhase,
    skyLow: mix(skyByPhase, c.spark, 0.25),
    foliage: c.done,
    foliageDeep: darken(c.done, 0.2),
    pot: mix(c.spark, c.overdue, 0.35),
    accent: c.primary,
  };
}

// ---------- radial-glow helper (only gradient the shape union has) ----------

function glow(cx: number, cy: number, r: number, color: string, inner: number, outer = 0): RigShape {
  return {
    kind: 'circle',
    cx,
    cy,
    r,
    fill: {
      type: 'radial',
      cx,
      cy,
      r,
      stops: [
        { offset: 0, color, opacity: inner },
        { offset: 1, color, opacity: outer },
      ],
    },
  };
}

function starPath(cx: number, cy: number, r: number): string {
  const q = r * 0.3;
  return (
    `M ${cx} ${cy - r} L ${cx + q} ${cy - q} L ${cx + r} ${cy} L ${cx + q} ${cy + q} ` +
    `L ${cx} ${cy + r} L ${cx - q} ${cy + q} L ${cx - r} ${cy} L ${cx - q} ${cy - q} Z`
  );
}

// ---------- wall + floor ----------

function room(r: Roles, motif: SceneMotif): RigShape[] {
  const shapes: RigShape[] = [
    { kind: 'rect', x: -2, y: -2, width: 104, height: FLOOR_Y + 2, fill: r.wall },
    // A soft ambient wash high on the wall so the top never reads as a flat band.
    glow(50, 8, 78, r.light, 0.14),
    // Wainscot / lower paneling band, like Finch's wood-panelled lower wall.
    { kind: 'rect', x: -2, y: FLOOR_Y - 30, width: 104, height: 30, fill: r.wainscot },
    { kind: 'rect', x: -2, y: FLOOR_Y - 31, width: 104, height: 2, fill: r.wallTrim },
    // Floor.
    { kind: 'rect', x: -2, y: FLOOR_Y, width: 104, height: SCENE_H - FLOOR_Y + 2, fill: r.floor },
  ];
  if (motif.wall === 'wood') {
    // Vertical plank seams across the wainscot.
    for (let x = 8; x < 100; x += 15) {
      shapes.push({ kind: 'line', x1: x, y1: FLOOR_Y - 29, x2: x, y2: FLOOR_Y - 1, stroke: r.wallTrim, strokeWidth: 0.8, opacity: 0.6 });
    }
  } else if (motif.wall === 'panel') {
    // Tech panel seams: a couple of horizontal rails + rivet dots.
    for (const y of [26, 60]) {
      shapes.push({ kind: 'line', x1: -2, y1: y, x2: 102, y2: y, stroke: r.wallTrim, strokeWidth: 0.7, opacity: 0.5 });
    }
    for (let x = 12; x < 100; x += 22) {
      shapes.push({ kind: 'circle', cx: x, cy: 26, r: 0.9, fill: r.accent, opacity: 0.4 });
    }
  }
  // Floorboards + the companion's grounding shadow rug.
  for (let y = FLOOR_Y + 12; y < SCENE_H; y += 16) {
    shapes.push({ kind: 'line', x1: -2, y1: y, x2: 102, y2: y, stroke: r.floorLine, strokeWidth: 0.8, opacity: 0.35 });
  }
  shapes.push({ kind: 'ellipse', cx: 50, cy: FLOOR_Y + 8, rx: 34, ry: 7, fill: r.floorLine, opacity: 0.22 });
  return shapes;
}

// ---------- hanging lamp (every scene) ----------

function lamp(r: Roles, c: ThemeColors): RigShape[] {
  const shade = mix(c.primary, c.text, 0.15);
  return [
    // Cast light pool behind the bulb.
    glow(50, 26, 40, r.light, 0.5),
    { kind: 'line', x1: 50, y1: -2, x2: 50, y2: 16, stroke: r.ink, strokeWidth: 1.1, opacity: 0.8 },
    { kind: 'path', d: 'M 41 16 Q 50 11 59 16 L 56 24 Q 50 27 44 24 Z', fill: shade },
    { kind: 'path', d: 'M 44 24 Q 50 27 56 24 L 56 25 Q 50 28 44 25 Z', fill: darken(shade, 0.15) },
    { kind: 'circle', cx: 50, cy: 27, r: 3.4, fill: r.light },
    { kind: 'circle', cx: 50, cy: 27, r: 1.8, fill: lighten(r.light, 0.4) },
  ];
}

// ---------- window + sky ----------

function windowFrame(r: Roles): RigShape[] {
  // Frame + pane; the sky content paints inside the pane rect (30,28)-(70,92).
  return [
    { kind: 'rect', x: 27, y: 25, width: 46, height: 70, rx: 5, fill: r.frame },
    { kind: 'rect', x: 30, y: 28, width: 40, height: 64, rx: 3, fill: r.sky },
  ];
}

function windowMuntins(r: Roles): RigShape[] {
  return [
    { kind: 'line', x1: 50, y1: 28, x2: 50, y2: 92, stroke: r.frame, strokeWidth: 2 },
    { kind: 'line', x1: 30, y1: 60, x2: 70, y2: 60, stroke: r.frame, strokeWidth: 2 },
    // Sill.
    { kind: 'rect', x: 24, y: 93, width: 52, height: 3.5, rx: 1.5, fill: r.frame },
  ];
}

function curtains(r: Roles, c: ThemeColors): RigShape[] {
  const cloth = mix(c.upcoming, c.text, 0.15);
  return [
    { kind: 'path', d: 'M 24 24 Q 33 55 27 95 L 23 95 Q 20 55 22 24 Z', fill: cloth },
    { kind: 'path', d: 'M 76 24 Q 67 55 73 95 L 77 95 Q 80 55 78 24 Z', fill: cloth },
    { kind: 'rect', x: 21, y: 23, width: 58, height: 3, rx: 1.5, fill: darken(cloth, 0.15) },
  ];
}

/** Sky content clipped to the pane by construction (all inside 30..70, 28..92). */
function sky(kind: SkyKind, r: Roles, c: ThemeColors, phase: DayPhase): RigShape[] {
  const s: RigShape[] = [];
  const night = kind === 'moon' || kind === 'stars';
  if (night) {
    const deep = mix(c.bg, c.upcoming, 0.3);
    s.push({ kind: 'rect', x: 30, y: 28, width: 40, height: 64, fill: darken(deep, 0.1) });
    s.push(glow(50, 40, 30, r.skyLow, 0.3));
  }
  if (kind === 'sun') {
    // Warm sky with a low sun near the sill and soft hills.
    s.push(glow(50, 78, 44, r.light, 0.6));
    s.push({ kind: 'circle', cx: 50, cy: 74, r: 8, fill: lighten(c.spark, 0.25) });
    s.push({ kind: 'path', d: 'M 30 92 Q 42 80 52 86 Q 62 92 70 84 L 70 92 Z', fill: mix(r.foliageDeep, c.spark, 0.3), opacity: 0.85 });
  } else if (kind === 'day') {
    s.push({ kind: 'circle', cx: 60, cy: 40, r: 6.5, fill: lighten(c.spark, 0.2), opacity: 0.9 });
    s.push({ kind: 'ellipse', cx: 41, cy: 45, rx: 8, ry: 3.4, fill: WHITE, opacity: 0.85 });
    s.push({ kind: 'ellipse', cx: 47, cy: 43, rx: 5, ry: 2.6, fill: WHITE, opacity: 0.85 });
    s.push({ kind: 'path', d: 'M 30 92 Q 44 82 54 87 Q 63 91 70 85 L 70 92 Z', fill: r.foliage, opacity: 0.8 });
    if (phase === 'evening') s.push(...[62, 37, 55].map((x, i) => ({ kind: 'path' as const, d: starPath(x, 34 + i * 3, 1), fill: WHITE, opacity: 0.7 })));
  } else if (kind === 'sea') {
    s.push({ kind: 'circle', cx: 58, cy: 40, r: 6, fill: lighten(c.spark, 0.2), opacity: 0.9 });
    const water = mix(c.primary, c.upcoming, 0.4);
    s.push({ kind: 'rect', x: 30, y: 66, width: 40, height: 26, fill: water });
    for (const y of [72, 80, 88]) {
      s.push({ kind: 'path', d: `M 32 ${y} q 5 -2.5 10 0 t 10 0 t 10 0`, stroke: lighten(water, 0.3), strokeWidth: 1, strokeLinecap: 'round', fill: 'none', opacity: 0.7 });
    }
  } else if (kind === 'moon') {
    s.push({ kind: 'circle', cx: 58, cy: 42, r: 8, fill: lighten(c.spark, 0.35) });
    s.push({ kind: 'circle', cx: 54.5, cy: 39.5, r: 6.5, fill: darken(mix(c.bg, c.upcoming, 0.3), 0.1), opacity: 0.9 });
    [42, 62, 37, 66, 45].forEach((x, i) => s.push({ kind: 'path', d: starPath(x, 34 + (i % 3) * 8 + (i > 2 ? 20 : 0), 1.2), fill: WHITE, opacity: 0.8 }));
  } else if (kind === 'stars') {
    [40, 60, 34, 66, 50, 44, 58].forEach((x, i) =>
      s.push({ kind: 'path', d: starPath(x, 33 + (i * 8) % 52, i % 2 ? 1.6 : 1), fill: i % 3 === 0 ? c.spark : WHITE, opacity: 0.85 }),
    );
    // A shooting streak.
    s.push({ kind: 'line', x1: 38, y1: 40, x2: 46, y2: 36, stroke: WHITE, strokeWidth: 1.2, strokeLinecap: 'round', opacity: 0.8 });
  }
  return s;
}

// ---------- props ----------

function pottedPlant(x: number, r: Roles, c: ThemeColors): RigShape[] {
  const base = FLOOR_Y + 2;
  const leaf = r.foliage;
  return [
    // Leaves fanning up out of the pot.
    { kind: 'path', d: `M ${x} ${base - 6} Q ${x - 9} ${base - 20} ${x - 4} ${base - 30} Q ${x} ${base - 20} ${x} ${base - 6} Z`, fill: leaf },
    { kind: 'path', d: `M ${x} ${base - 6} Q ${x + 9} ${base - 20} ${x + 4} ${base - 30} Q ${x} ${base - 20} ${x} ${base - 6} Z`, fill: darken(leaf, 0.1) },
    { kind: 'path', d: `M ${x} ${base - 6} Q ${x - 2} ${base - 24} ${x} ${base - 34} Q ${x + 2} ${base - 24} ${x} ${base - 6} Z`, fill: lighten(leaf, 0.12) },
    // Pot.
    { kind: 'path', d: `M ${x - 8} ${base - 6} L ${x + 8} ${base - 6} L ${x + 6} ${base + 8} L ${x - 6} ${base + 8} Z`, fill: r.pot },
    { kind: 'rect', x: x - 9, y: base - 8, width: 18, height: 3, rx: 1.5, fill: darken(r.pot, 0.1) },
  ];
}

function shelf(r: Roles, c: ThemeColors): RigShape[] {
  // A little wall shelf upper-left with a potted succulent + a framed picture.
  const y = 44;
  return [
    { kind: 'rect', x: 6, y, width: 22, height: 2.5, rx: 1, fill: r.frame },
    { kind: 'path', d: `M 10 ${y} L 16 ${y} L 15 ${y - 5} L 11 ${y - 5} Z`, fill: r.pot },
    { kind: 'circle', cx: 11, cy: y - 6, r: 2, fill: r.foliage },
    { kind: 'circle', cx: 14, cy: y - 7, r: 2.2, fill: darken(r.foliage, 0.1) },
    { kind: 'rect', x: 20, y: y - 9, width: 6, height: 9, rx: 1, fill: r.frame },
    { kind: 'rect', x: 21, y: y - 8, width: 4, height: 7, rx: 0.5, fill: mix(c.card, c.spark, 0.3) },
  ];
}

function bookshelf(r: Roles, c: ThemeColors): RigShape[] {
  // A study-nook shelf upper-left with tilted book spines in varied tints.
  const y = 48;
  const spines: RigShape[] = [
    { kind: 'rect', x: 6, y: y - 12, width: 24, height: 2.5, rx: 1, fill: r.frame },
    { kind: 'rect', x: 6, y, width: 24, height: 2.5, rx: 1, fill: r.frame },
  ];
  const tints = [c.primary, c.spark, c.upcoming, c.done, c.overdue];
  let x = 8;
  for (let i = 0; i < 5; i++) {
    const w = 2.6 + (i % 2) * 0.8;
    spines.push({ kind: 'rect', x, y: y - 11, width: w, height: 11, rx: 0.6, fill: mix(tints[i], c.card, 0.15) });
    x += w + 0.7;
  }
  // A leaning book at the end.
  spines.push({ kind: 'path', d: `M ${x + 1} ${y} l 4 -1 l 1.5 -9 l -4 1 Z`, fill: mix(c.spark, c.card, 0.2) });
  return spines;
}

// ---------- assemble ----------

export function buildScene(
  themeId: ThemeId,
  colors: ThemeColors,
  phase: DayPhase = 'day',
): SceneModel {
  const motif = SCENE_MOTIF[themeId] ?? SCENE_MOTIF.slate;
  const r = roles(colors, motif, phase);
  const shapes: RigShape[] = [];

  shapes.push(...room(r, motif));
  if (motif.props.includes('shelf')) shapes.push(...shelf(r, colors));
  if (motif.props.includes('bookshelf')) shapes.push(...bookshelf(r, colors));
  shapes.push(...windowFrame(r));
  shapes.push(...sky(motif.sky, r, colors, phase));
  shapes.push(...windowMuntins(r));
  if (motif.curtains) shapes.push(...curtains(r, colors));
  shapes.push(...lamp(r, colors));
  if (motif.props.includes('plantLeft')) shapes.push(...pottedPlant(12, r, colors));
  if (motif.props.includes('plantRight')) shapes.push(...pottedPlant(88, r, colors));

  const moteTint =
    motif.motes === 'leaf'
      ? colors.done
      : motif.motes === 'bubble'
        ? lighten(colors.upcoming, 0.2)
        : motif.motes === 'star'
          ? colors.spark
          : colors.spark;

  return { shapes, motes: motif.motes, moteTint };
}
