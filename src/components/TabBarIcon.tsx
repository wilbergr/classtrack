// Custom tab-bar glyphs: hand-drawn, rounded, on-brand SVG icons — filled
// when active, outline when idle — sitting in a soft highlight pill that
// carries the selected state (never color alone: the label bolds too).
// Static SVG only: the navigator cross-fades a focused and an unfocused
// render, so nothing here animates per-frame (the New-Architecture rule).

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import type { TabParamList } from '../navigation';
import { useTheme } from '../theme';

const VIEW = 26;

interface GlyphProps {
  /** Tint from the navigator (primary when active, textMuted when idle). */
  color: string;
  /** Punched-out details on a filled glyph (guaranteed contrast on primary). */
  detail: string;
  focused: boolean;
}

/** The buddy: round head, ear nubs, a little smile — Home is its house. */
function HomeGlyph({ color, detail, focused }: GlyphProps) {
  const face = focused ? detail : color;
  return (
    <Svg width={VIEW} height={VIEW} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      <Circle cx={7.5} cy={7} r={2.8} fill={focused ? color : 'none'} stroke={color} strokeWidth={2} />
      <Circle cx={18.5} cy={7} r={2.8} fill={focused ? color : 'none'} stroke={color} strokeWidth={2} />
      <Circle cx={13} cy={14.5} r={8.5} fill={focused ? color : 'none'} stroke={color} strokeWidth={2} />
      <Circle cx={9.8} cy={13.2} r={1.4} fill={face} />
      <Circle cx={16.2} cy={13.2} r={1.4} fill={face} />
      <Path
        d="M 10 16.6 Q 13 19.2 16 16.6"
        stroke={face}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** A friendly calendar page with a done-check. */
function TodayGlyph({ color, detail, focused }: GlyphProps) {
  return (
    <Svg width={VIEW} height={VIEW} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      <Rect
        x={3.5}
        y={5}
        width={19}
        height={17.5}
        rx={4}
        fill={focused ? color : 'none'}
        stroke={color}
        strokeWidth={2}
      />
      <Line x1={8.5} y1={2.5} x2={8.5} y2={7} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Line x1={17.5} y1={2.5} x2={17.5} y2={7} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
      <Path
        d="M 8.5 14.5 L 11.5 17.5 L 17.5 11"
        stroke={focused ? detail : color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}

/** An open book, spine down the middle. */
function SubjectsGlyph({ color, detail, focused }: GlyphProps) {
  return (
    <Svg width={VIEW} height={VIEW} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      <Path
        d="M 13 6.2 C 10.6 4.6 7.4 4.2 4.5 4.8 L 4.5 19 C 7.4 18.4 10.6 18.8 13 20.4
           C 15.4 18.8 18.6 18.4 21.5 19 L 21.5 4.8 C 18.6 4.2 15.4 4.6 13 6.2 Z"
        fill={focused ? color : 'none'}
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Line
        x1={13}
        y1={6.6}
        x2={13}
        y2={20}
        stroke={focused ? detail : color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Rounded 8-tooth gear, computed once at module load (static path). */
function gearPath(cx: number, cy: number, rOuter: number, rInner: number, teeth: number): string {
  const step = (Math.PI * 2) / teeth;
  const toothHalf = step * 0.2;
  const gapHalf = step * 0.36;
  const pt = (ang: number, r: number) =>
    `${(cx + Math.cos(ang) * r).toFixed(2)} ${(cy + Math.sin(ang) * r).toFixed(2)}`;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = i * step - Math.PI / 2;
    d += `${i === 0 ? 'M' : 'L'} ${pt(a - toothHalf, rOuter)} L ${pt(a + toothHalf, rOuter)} `;
    d += `L ${pt(a + gapHalf, rInner)} L ${pt(a + step - gapHalf, rInner)} `;
  }
  return `${d}Z`;
}

const GEAR = gearPath(13, 13, 10.2, 7.4, 8);

function SettingsGlyph({ color, detail, focused }: GlyphProps) {
  return (
    <Svg width={VIEW} height={VIEW} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      <Path
        d={GEAR}
        fill={focused ? color : 'none'}
        stroke={color}
        strokeWidth={focused ? 0 : 1.8}
        strokeLinejoin="round"
      />
      <Circle
        cx={13}
        cy={13}
        r={3.4}
        fill={focused ? detail : 'none'}
        stroke={focused ? 'none' : color}
        strokeWidth={1.8}
      />
    </Svg>
  );
}

const GLYPHS: Record<keyof TabParamList, React.ComponentType<GlyphProps>> = {
  Home: HomeGlyph,
  Today: TodayGlyph,
  Subjects: SubjectsGlyph,
  Settings: SettingsGlyph,
};

interface Props {
  name: keyof TabParamList;
  focused: boolean;
  color: string;
}

export default function TabBarIcon({ name, focused, color }: Props) {
  const { colors } = useTheme();
  const Glyph = GLYPHS[name];
  return (
    <View style={[styles.pill, focused && { backgroundColor: colors.highlight }]}>
      <Glyph focused={focused} color={color} detail={colors.primaryText} />
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: 54,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
