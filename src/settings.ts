// Typed get/set over the `settings` table (JSON values) with an in-memory
// cache so UI code can read synchronously after the app-start load.

import { getDb } from './db/database';
import type { AppSettings } from './types';

/**
 * Out of the box the app is playful and celebratory: Hype vibe, lively Pop
 * theme, Wisp companion, sound/haptics on. The calm/quiet experience
 * (Balanced/Chill, muted theme, Plain/Sage voice, no companion) is the
 * opt-down a user chooses in onboarding or Settings.
 */
export const DEFAULT_SETTINGS: AppSettings = {
  vibe: 'hype',
  themeId: 'pop',
  darkMode: 'system',
  companion: 'wisp',
  companionName: 'Wisp',
  launchScreen: 'home',
  voicePack: 'ember',
  soundOn: true,
  hapticsOn: true,
  reduceEffects: false,
  celebrationStyle: 'burst',
  accessories: [],
  voiceCaptureOn: false,
};

const APP_KEY = 'app';

const cache = new Map<string, unknown>();
let appSettings: AppSettings = { ...DEFAULT_SETTINGS };
let loaded = false;

type Listener = (s: AppSettings) => void;
const listeners = new Set<Listener>();

export function onSettingsChange(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notify(): void {
  for (const cb of listeners) cb(appSettings);
}

/** Read any settings key (JSON-decoded), falling back when absent/corrupt. */
export async function getSettingAsync<T>(key: string, fallback: T): Promise<T> {
  if (cache.has(key)) return cache.get(key) as T;
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key,
  );
  if (!row) return fallback;
  try {
    const v = JSON.parse(row.value) as T;
    cache.set(key, v);
    return v;
  } catch {
    return fallback;
  }
}

export async function setSettingAsync<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    JSON.stringify(value),
  );
  cache.set(key, value);
}

/** Load the app settings into the cache. Call once at app start. */
export async function loadSettingsAsync(): Promise<AppSettings> {
  const stored = await getSettingAsync<Partial<AppSettings>>(APP_KEY, {});
  appSettings = { ...DEFAULT_SETTINGS, ...stored };
  loaded = true;
  notify();
  return appSettings;
}

/** Synchronous read; defaults until `loadSettingsAsync` has run. */
export function getCachedSettings(): AppSettings {
  return appSettings;
}

export function settingsLoaded(): boolean {
  return loaded;
}

export async function updateSettingsAsync(patch: Partial<AppSettings>): Promise<AppSettings> {
  appSettings = { ...appSettings, ...patch };
  await setSettingAsync(APP_KEY, appSettings);
  notify();
  return appSettings;
}
