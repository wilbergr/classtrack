// The grace-shield glyph: a hand-drawn rounded badge in the tab-icon house
// style — filled with a punched-out sparkle while the shield is ready, a calm
// outline while it rests. State is carried by fill-vs-outline plus the text
// label beside it, never by dimming or color alone.

import React from 'react';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../theme';

const VIEW = 26;

// Soft shoulders, gentle taper — same rounded hand as the tab glyphs.
const SHIELD =
  'M 13 2.6 C 15.9 4.4 19.1 5.5 22.2 6 L 22.2 12.4 C 22.2 18.1 18.6 22 13 24.2 ' +
  'C 7.4 22 3.8 18.1 3.8 12.4 L 3.8 6 C 6.9 5.5 10.1 4.4 13 2.6 Z';

// 4-point sparkle punched out of the filled badge (the rig's star shape).
const STAR = (() => {
  const cx = 13;
  const cy = 12.4;
  const r = 4.4;
  const q = r * 0.28;
  return (
    `M ${cx} ${cy - r} L ${cx + q} ${cy - q} L ${cx + r} ${cy} L ${cx + q} ${cy + q} ` +
    `L ${cx} ${cy + r} L ${cx - q} ${cy + q} L ${cx - r} ${cy} L ${cx - q} ${cy - q} Z`
  );
})();

interface Props {
  /** Ready = filled + sparkle; resting = outline. */
  ready: boolean;
  size?: number;
}

export default function ShieldIcon({ ready, size = 18 }: Props) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      <Path
        d={SHIELD}
        fill={ready ? colors.spark : 'none'}
        stroke={ready ? undefined : colors.textMuted}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {ready && <Path d={STAR} fill={colors.card} />}
    </Svg>
  );
}
