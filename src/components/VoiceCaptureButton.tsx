// Mic-to-field dictation (Quick Add title, editor title/notes). The transcript
// only ever lands in its field — it never auto-commits. Prefers on-device
// recognition when the OS supports it; ships default-off with a disclosure in
// Settings because some devices route OS speech recognition through vendor
// servers.

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';

import { hapticSelect } from '../feedback';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

// Hand-drawn glyphs in the tab-bar icon style (see TabBarIcon.tsx):
// static SVG, rounded strokes, themed via useTheme() — never a raw emoji.
const VIEW = 22;

/** Outline mic: capsule body, cradle arc, stem and base. */
function MicGlyph({ color }: { color: string }) {
  return (
    <Svg width={VIEW} height={VIEW} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      <Rect x={8} y={2.5} width={6} height={10.5} rx={3} fill="none" stroke={color} strokeWidth={2} />
      <Path
        d="M 5.5 10.5 A 5.5 5.5 0 0 0 16.5 10.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
      />
      <Line x1={11} y1={16} x2={11} y2={19} stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Line x1={7.5} y1={19.5} x2={14.5} y2={19.5} stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

/** Filled rounded stop square for the "tap to stop" state. */
function StopGlyph({ color }: { color: string }) {
  return (
    <Svg width={VIEW} height={VIEW} viewBox={`0 0 ${VIEW} ${VIEW}`}>
      <Rect x={5.5} y={5.5} width={11} height={11} rx={3} fill={color} />
    </Svg>
  );
}

interface Props {
  /** Called with the (interim or final) transcript as the user speaks. */
  onTranscript: (text: string) => void;
}

export default function VoiceCaptureButton({ onTranscript }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [listening, setListening] = useState(false);

  useSpeechRecognitionEvent('result', (event) => {
    // Recognition events are module-global; when several buttons are mounted
    // (e.g. title + notes on the edit screen) only the one that started the
    // session may consume the transcript.
    if (!listening) return;
    const transcript = event.results[0]?.transcript;
    if (transcript) onTranscript(transcript);
  });
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', () => setListening(false));

  const toggle = useCallback(async () => {
    hapticSelect();
    try {
      if (listening) {
        ExpoSpeechRecognitionModule.stop();
        setListening(false);
        return;
      }
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) return;
      ExpoSpeechRecognitionModule.start({
        interimResults: true,
        // Keep audio on-device wherever the OS can.
        requiresOnDeviceRecognition: ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
      });
      setListening(true);
    } catch {
      // Recognition unavailable (no engine / stale dev client) — stay quiet.
      setListening(false);
    }
  }, [listening]);

  return (
    <Pressable
      onPress={toggle}
      style={[styles.button, listening && styles.listening]}
      accessibilityRole="button"
      accessibilityLabel={listening ? 'Stop voice capture' : 'Start voice capture'}
      accessibilityState={{ selected: listening }}
    >
      {listening ? <StopGlyph color={colors.danger} /> : <MicGlyph color={colors.text} />}
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    button: {
      width: 48,
      height: 48,
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: spacing.sm,
    },
    listening: { borderColor: colors.danger, backgroundColor: colors.highlight },
  });
