// The SVG draw layer for one rig layer: maps RigShape primitives to
// react-native-svg elements. Purely static per render — all motion lives on
// the Animated.View wrappers in Companion.tsx. Swappable for a Skia layer.

import React from 'react';
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

import type { Fill, RigShape } from './model';

interface Props {
  shapes: RigShape[];
  size: number;
  /** Unique per layer so gradient ids never collide. */
  idPrefix: string;
}

export default function SvgRigLayer({ shapes, size, idPrefix }: Props) {
  const gradients: { id: string; fill: Exclude<Fill, string> }[] = [];
  shapes.forEach((s, i) => {
    if (s.fill && typeof s.fill !== 'string') {
      gradients.push({ id: `${idPrefix}-g${i}`, fill: s.fill });
    }
  });

  const fillOf = (s: RigShape, i: number): string | undefined => {
    if (s.fill == null) return undefined;
    if (typeof s.fill === 'string') return s.fill;
    return `url(#${idPrefix}-g${i})`;
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {gradients.length > 0 && (
        <Defs>
          {gradients.map((g) => (
            <RadialGradient
              key={g.id}
              id={g.id}
              cx={g.fill.cx}
              cy={g.fill.cy}
              r={g.fill.r}
              gradientUnits="userSpaceOnUse"
            >
              {g.fill.stops.map((st, j) => (
                <Stop key={j} offset={st.offset} stopColor={st.color} stopOpacity={st.opacity ?? 1} />
              ))}
            </RadialGradient>
          ))}
        </Defs>
      )}
      {shapes.map((s, i) => {
        const common = {
          fill: fillOf(s, i),
          stroke: s.stroke,
          strokeWidth: s.strokeWidth,
          strokeLinecap: s.strokeLinecap,
          opacity: s.opacity,
        };
        switch (s.kind) {
          case 'path':
            return <Path key={i} d={s.d} {...common} />;
          case 'circle':
            return <Circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
          case 'ellipse':
            return <Ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} {...common} />;
          case 'rect':
            return <Rect key={i} x={s.x} y={s.y} width={s.width} height={s.height} rx={s.rx} {...common} />;
          case 'line':
            return <Line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...common} />;
        }
      })}
    </Svg>
  );
}
