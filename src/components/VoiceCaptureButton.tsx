// Mic-to-title for Quick Add. The transcript only ever lands in the title
// field — it never auto-commits. Prefers on-device recognition when the OS
// supports it; ships default-off with a disclosure in Settings because some
// devices route OS speech recognition through vendor servers.

import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { hapticSelect } from '../feedback';
import { radius, spacing, useTheme, type ThemeColors } from '../theme';

interface Props {
  /** Called with the (interim or final) transcript as the user speaks. */
  onTranscript: (text: string) => void;
}

export default function VoiceCaptureButton({ onTranscript }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [listening, setListening] = useState(false);

  useSpeechRecognitionEvent('result', (event) => {
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
      <Text style={styles.icon}>{listening ? '⏹' : '🎤'}</Text>
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
    icon: { fontSize: 18 },
  });
