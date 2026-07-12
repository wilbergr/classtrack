// The Skia draw layer for the whole rig: ONE Canvas, one <Group> per rig
// layer, continuous motion driven by Reanimated shared values fed directly
// into Skia props (first-class integration — none of the SVG-prop-animation
// fragility). Aura and shimmer layers get real GPU BlurMask glow instead of
// the SVG renderer's faked gradient stacks. The rig *model* is unchanged —
// this is a renderer swap.

import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Line,
  Oval,
  Path,
  RadialGradient,
  Rect,
  RoundedRect,
  vec,
} from '@shopify/react-native-skia';
import React from 'react';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { withAlpha } from './color';
import type { RigLayer, RigModel, RigShape } from './model';

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;

interface RigProps {
  model: RigModel;
  size: number;
  breath: SharedValue<number>;
  pulse: SharedValue<number>;
  lookX: SharedValue<number>;
  lookY: SharedValue<number>;
  calm: boolean;
}

export default function SkiaRig({ model, size, breath, pulse, lookX, lookY, calm }: RigProps) {
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      {/* The model lives in a 100×100 space; scale once at the root. */}
      <Group transform={[{ scale: size / 100 }]}>
        {model.layers.map((layer) => (
          <LayerGroup key={layer.id} layer={layer} breath={breath} pulse={pulse} calm={calm} />
        ))}
        {model.pupils && (
          <PupilGroup
            pupils={model.pupils}
            breath={breath}
            lookX={lookX}
            lookY={lookY}
            calm={calm}
          />
        )}
      </Group>
    </Canvas>
  );
}

function LayerGroup({
  layer,
  breath,
  pulse,
  calm,
}: {
  layer: RigLayer;
  breath: SharedValue<number>;
  pulse: SharedValue<number>;
  calm: boolean;
}) {
  const transform = useDerivedValue(() => {
    if (layer.pulse) {
      const p = calm ? 0.5 : Math.sin(pulse.value * TWO_PI) * 0.5 + 0.5;
      return [{ scale: 1 + 0.05 * p }];
    }
    const s = calm ? 0 : Math.sin((breath.value + layer.breathPhase) * TWO_PI) * layer.breathAmp;
    const sway = layer.sway ?? 0;
    const rot =
      calm || sway === 0
        ? 0
        : Math.sin((breath.value + layer.breathPhase + 0.25) * TWO_PI) * sway * DEG;
    return [{ scaleX: 1 + s }, { scaleY: 1 - s * 0.85 }, { rotate: rot }];
  });
  const opacity = useDerivedValue(() => {
    if (!layer.pulse) return 1;
    const p = calm ? 0.5 : Math.sin(pulse.value * TWO_PI) * 0.5 + 0.5;
    return 0.7 + 0.3 * p;
  });

  // Real glow where the SVG renderer faked it with gradient stacks.
  const blur = layer.id === 'aura' ? 5 : layer.id === 'shimmer' ? 2.5 : 0;

  return (
    <Group
      transform={transform}
      // Squash anchors at the feet so ground contact holds; pulses breathe
      // around the aura's own center.
      origin={layer.pulse ? vec(50, 56) : vec(50, 92)}
      opacity={opacity}
    >
      {blur > 0 && <BlurMask blur={blur} style="normal" />}
      {layer.shapes.map((s, i) => (
        <ShapeNode key={i} shape={s} />
      ))}
    </Group>
  );
}

function PupilGroup({
  pupils,
  breath,
  lookX,
  lookY,
  calm,
}: {
  pupils: NonNullable<RigModel['pupils']>;
  breath: SharedValue<number>;
  lookX: SharedValue<number>;
  lookY: SharedValue<number>;
  calm: boolean;
}) {
  const transform = useDerivedValue(() => {
    // Rides the same squash as the face layer, plus the wander offset.
    const s = calm ? 0 : Math.sin((breath.value + 0.22) * TWO_PI) * 0.015;
    return [
      { translateX: calm ? 0 : lookX.value * pupils.range },
      { translateY: calm ? 0 : lookY.value * pupils.range },
      { scaleX: 1 + s },
      { scaleY: 1 - s * 0.85 },
    ];
  });
  return (
    <Group transform={transform} origin={vec(50, 92)}>
      {pupils.shapes.map((s, i) => (
        <ShapeNode key={i} shape={s} />
      ))}
    </Group>
  );
}

/**
 * One RigShape → Skia element(s). Skia paints are single-style, so a shape
 * carrying both fill and stroke renders as two elements (fill under stroke).
 */
function ShapeNode({ shape }: { shape: RigShape }) {
  const hasFill = shape.fill != null && shape.fill !== 'none';
  const hasStroke = shape.stroke != null;
  return (
    <>
      {hasFill && <Primitive shape={shape} paint="fill" />}
      {hasStroke && <Primitive shape={shape} paint="stroke" />}
    </>
  );
}

function Primitive({ shape, paint }: { shape: RigShape; paint: 'fill' | 'stroke' }) {
  const gradient =
    paint === 'fill' && shape.fill != null && typeof shape.fill !== 'string' ? shape.fill : null;
  const color =
    paint === 'stroke'
      ? shape.stroke
      : typeof shape.fill === 'string'
        ? shape.fill
        : undefined; // gradient shader child supplies the fill
  const common = {
    style: paint,
    color,
    opacity: shape.opacity,
    ...(paint === 'stroke'
      ? { strokeWidth: shape.strokeWidth ?? 1, strokeCap: shape.strokeLinecap ?? 'butt' }
      : {}),
  } as const;
  const children = gradient ? (
    <RadialGradient
      c={vec(gradient.cx, gradient.cy)}
      r={gradient.r}
      colors={gradient.stops.map((st) => withAlpha(st.color, st.opacity ?? 1))}
      positions={gradient.stops.map((st) => st.offset)}
    />
  ) : null;

  switch (shape.kind) {
    case 'path':
      return (
        <Path path={shape.d} {...common}>
          {children}
        </Path>
      );
    case 'circle':
      return (
        <Circle cx={shape.cx} cy={shape.cy} r={shape.r} {...common}>
          {children}
        </Circle>
      );
    case 'ellipse':
      return (
        <Oval
          x={shape.cx - shape.rx}
          y={shape.cy - shape.ry}
          width={shape.rx * 2}
          height={shape.ry * 2}
          {...common}
        >
          {children}
        </Oval>
      );
    case 'rect':
      return shape.rx != null ? (
        <RoundedRect
          x={shape.x}
          y={shape.y}
          width={shape.width}
          height={shape.height}
          r={shape.rx}
          {...common}
        >
          {children}
        </RoundedRect>
      ) : (
        <Rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} {...common}>
          {children}
        </Rect>
      );
    case 'line':
      return (
        <Line p1={vec(shape.x1, shape.y1)} p2={vec(shape.x2, shape.y2)} {...common} />
      );
  }
}
