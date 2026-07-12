// Local reminder scheduling via expo-notifications (SDK 57).
// Everything is on-device: no push tokens, no server.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  countOpenDueBetween,
  countOpenOverdue,
  getAssignmentWithSubject,
  setAssignmentNotificationIds,
} from './db/database';
import { addDays, formatDayLabel, formatTime, startOfDay } from './dates';
import { pickTemplate, VOICE_PACKS, type ReminderSlot } from './gamification/copy';
import { getCachedSettings, getSettingAsync, setSettingAsync } from './settings';
import type { AssignmentType } from './types';
import { ASSIGNMENT_TYPE_LABELS } from './types';

export const REMINDER_CHANNEL_ID = 'assignment-reminders';
/** Separate channel so digests can be silenced independently of reminders. */
export const DIGEST_CHANNEL_ID = 'daily-digest';

/** The rolling "plan your evening" digest fires at 4:00 PM local time. */
export const DIGEST_HOUR = 16;
/** How many upcoming days one refresh schedules digests for. */
export const DIGEST_DAYS = 7;

// Settings keys (personality system state).
const RECENT_TEMPLATES_KEY = 'recentReminderTemplates';
const FIRST_REMINDER_KEY = 'firstReminderShown';
const DIGEST_IDS_KEY = 'digestNotificationIds';
/** Never repeat any of the last N reminder bodies. */
const RECENT_RING_SIZE = 6;

/** Evening-before reminder fires at 6:00 PM local time. */
export const EVENING_BEFORE_HOUR = 18;
export const EVENING_BEFORE_MINUTE = 0;
/** Morning-of reminder fires at 7:30 AM local time. */
export const MORNING_OF_HOUR = 7;
export const MORNING_OF_MINUTE = 30;

// How foreground notifications behave while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * One-time startup work: create the Android channel. Permission is requested
 * lazily, the first time a reminder is actually scheduled (or from Settings).
 */
export async function initNotificationsAsync(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
      name: 'Assignment reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync(DIGEST_CHANNEL_ID, {
      name: 'Daily digest',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** True if we may deliver notifications, requesting permission if needed. */
export async function ensureNotificationPermissionAsync(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) return true;
  if (!current.canAskAgain) return false;
  const requested = await Notifications.requestPermissionsAsync();
  return isGranted(requested);
}

/** Current permission state without prompting. */
export async function getNotificationPermissionAsync(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  const current = await Notifications.getPermissionsAsync();
  if (isGranted(current)) return 'granted';
  return current.canAskAgain ? 'undetermined' : 'denied';
}

function isGranted(p: Notifications.NotificationPermissionsStatus): boolean {
  return p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
}

export async function cancelRemindersAsync(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)),
  );
}

/**
 * Recompute the reminders for one assignment: cancel whatever was scheduled,
 * then (if it is still open and due in the future) schedule the evening-before
 * and morning-of reminders and persist their ids. Call after any create,
 * edit, or complete/un-complete.
 */
export async function refreshAssignmentRemindersAsync(assignmentId: number): Promise<void> {
  const a = await getAssignmentWithSubject(assignmentId);
  if (!a) return;

  await cancelRemindersAsync(a.notificationIds);
  if (a.completed) {
    await setAssignmentNotificationIds(a.id, []);
    return;
  }

  const ok = await ensureNotificationPermissionAsync();
  if (!ok) {
    await setAssignmentNotificationIds(a.id, []);
    return;
  }

  const ids: string[] = [];
  for (const t of reminderTimes(a.dueAt)) {
    const id = await scheduleReminderAsync(t, a.id, a.title, a.type, a.subjectName, a.dueAt);
    if (id) ids.push(id);
  }
  await setAssignmentNotificationIds(a.id, ids);
}

interface ReminderTime {
  fireAt: Date;
  kind: 'evening-before' | 'morning-of';
}

function reminderTimes(dueAt: number): ReminderTime[] {
  const eveningBefore = new Date(dueAt);
  eveningBefore.setDate(eveningBefore.getDate() - 1);
  eveningBefore.setHours(EVENING_BEFORE_HOUR, EVENING_BEFORE_MINUTE, 0, 0);

  const morningOf = new Date(dueAt);
  morningOf.setHours(MORNING_OF_HOUR, MORNING_OF_MINUTE, 0, 0);

  const now = Date.now();
  return [
    { fireAt: eveningBefore, kind: 'evening-before' as const },
    { fireAt: morningOf, kind: 'morning-of' as const },
  ].filter((t) => t.fireAt.getTime() > now && t.fireAt.getTime() < dueAt);
}

async function scheduleReminderAsync(
  t: ReminderTime,
  assignmentId: number,
  title: string,
  type: AssignmentType,
  subjectName: string,
  dueAt: number,
): Promise<string | null> {
  const dayLabel = formatDayLabel(dueAt, t.fireAt.getTime());
  const day = ['Today', 'Tomorrow'].includes(dayLabel) ? dayLabel.toLowerCase() : `on ${dayLabel}`;
  const when = `${day} at ${formatTime(dueAt)}`;
  const body = await composeReminderBodyAsync(t, assignmentId, title, type, subjectName, dueAt, when);
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        // Title stays information-first; the body carries the personality.
        title: `${subjectName} ${ASSIGNMENT_TYPE_LABELS[type].toLowerCase()}`,
        body,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: t.fireAt,
        channelId: REMINDER_CHANNEL_ID,
      },
    });
  } catch {
    // Scheduling can fail (e.g. permission revoked mid-flight); the app must
    // keep working without reminders.
    return null;
  }
}

/**
 * Reminder copy from the active voice pack: deterministic hash pick with a
 * persisted recent-ring so the last few bodies never repeat. Because every
 * mutation cancels + reschedules, copy naturally re-rolls on edits.
 */
async function composeReminderBodyAsync(
  t: ReminderTime,
  assignmentId: number,
  title: string,
  type: AssignmentType,
  subjectName: string,
  dueAt: number,
  whenPhrase: string,
): Promise<string> {
  const ctx = {
    title,
    subjectName,
    typeLabel: ASSIGNMENT_TYPE_LABELS[type].toLowerCase(),
    whenPhrase,
  };
  const packId = getCachedSettings().voicePack;
  const pack = VOICE_PACKS[packId];
  const slot: ReminderSlot = t.kind === 'evening-before' ? 'eveningBefore' : 'morningOf';

  try {
    // The very first reminder this install ever schedules gets a hello.
    const firstShown = await getSettingAsync(FIRST_REMINDER_KEY, false);
    if (!firstShown) {
      await setSettingAsync(FIRST_REMINDER_KEY, true);
      return pack.firstEver[0](ctx);
    }

    // Heavy due-day (≥3 items): the evening-before reminder says so.
    let pool = pack.reminders[slot][type];
    let poolKey = `${packId}:${slot}:${type}`;
    if (slot === 'eveningBefore') {
      const dayStart = startOfDay(dueAt);
      const dueCount = await countOpenDueBetween(dayStart, addDays(dayStart, 1));
      if (dueCount >= 3 && pack.bigDay.length > 0) {
        pool = pack.bigDay;
        poolKey = `${packId}:bigDay`;
      }
    }

    const recent = await getSettingAsync<string[]>(RECENT_TEMPLATES_KEY, []);
    const picked = pickTemplate(pool, poolKey, assignmentId, t.fireAt.getTime(), recent);
    await setSettingAsync(
      RECENT_TEMPLATES_KEY,
      [...recent, picked.key].slice(-RECENT_RING_SIZE),
    );
    return picked.value(ctx);
  } catch {
    // Copy selection must never block a reminder.
    return `"${title}" is due ${whenPhrase}.`;
  }
}

/**
 * Cancel + reschedule the rolling 4:00 PM "plan your evening" digests: one
 * per upcoming day whose NEXT day has due items as of scheduling (empty days
 * are skipped entirely). Overdue items are only ever mentioned here, gently.
 * Ids persist in settings (same persist-ids invariant, app-level).
 * Call on app open.
 */
export async function refreshDailyDigestsAsync(): Promise<void> {
  const oldIds = await getSettingAsync<string[]>(DIGEST_IDS_KEY, []);
  await cancelRemindersAsync(oldIds);
  await setSettingAsync(DIGEST_IDS_KEY, []);

  if ((await getNotificationPermissionAsync()) !== 'granted') return;

  const pack = VOICE_PACKS[getCachedSettings().voicePack];
  const now = Date.now();
  const ids: string[] = [];
  for (let d = 0; d < DIGEST_DAYS; d++) {
    const fireAt = new Date(addDays(startOfDay(now), d));
    fireAt.setHours(DIGEST_HOUR, 0, 0, 0);
    if (fireAt.getTime() <= now) continue;

    const targetStart = addDays(startOfDay(fireAt.getTime()), 1);
    const dueCount = await countOpenDueBetween(targetStart, addDays(targetStart, 1));
    if (dueCount === 0) continue;
    const overdueCount = await countOpenOverdue(fireAt.getTime());

    const template = pack.digest[(d + dueCount) % pack.digest.length];
    const { title, body } = template({ dueCount, overdueCount });
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title, body, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireAt,
          channelId: DIGEST_CHANNEL_ID,
        },
      });
      ids.push(id);
    } catch {
      // Keep going; a failed digest is not worth surfacing.
    }
  }
  await setSettingAsync(DIGEST_IDS_KEY, ids);
}
