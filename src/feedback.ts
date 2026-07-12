// Sound + haptic feedback, gated by the user's settings. Sounds are tiny
// synthesized WAVs bundled with the app (no network, no licensing). Every
// call is fail-safe: feedback must never break a data operation.

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

import bellWav from '../assets/sounds/bell.wav';
import captureWav from '../assets/sounds/capture.wav';
import completeWav from '../assets/sounds/complete.wav';
import levelupWav from '../assets/sounds/levelup.wav';
import tickWav from '../assets/sounds/tick.wav';
import whooshWav from '../assets/sounds/whoosh.wav';
import { getCachedSettings } from './settings';

export type SoundKind = 'capture' | 'complete' | 'levelup' | 'tick' | 'whoosh' | 'bell';

const SOURCES: Record<SoundKind, number> = {
  capture: captureWav,
  complete: completeWav,
  levelup: levelupWav,
  tick: tickWav,
  whoosh: whooshWav,
  bell: bellWav,
};

const players = new Map<SoundKind, AudioPlayer>();

export function playSound(kind: SoundKind): void {
  if (!getCachedSettings().soundOn) return;
  try {
    let p = players.get(kind);
    if (!p) {
      p = createAudioPlayer(SOURCES[kind]);
      players.set(kind, p);
    }
    p.seekTo(0).catch(() => undefined);
    p.play();
  } catch {
    // Native audio module unavailable (e.g. stale dev client) — stay silent.
  }
}

function hapticsEnabled(): boolean {
  return getCachedSettings().hapticsOn;
}

export function hapticCapture(): void {
  if (!hapticsEnabled()) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function hapticComplete(): void {
  if (!hapticsEnabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function hapticLevelUp(): void {
  if (!hapticsEnabled()) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

export function hapticSelect(): void {
  if (!hapticsEnabled()) return;
  Haptics.selectionAsync().catch(() => undefined);
}
