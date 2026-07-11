// Local reminder scheduling via expo-notifications (SDK 57).
// Everything is on-device: no push tokens, no server.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getAssignmentWithSubject, setAssignmentNotificationIds } from './db/database';
import { formatDayLabel, formatTime } from './dates';
import type { AssignmentType } from './types';
import { ASSIGNMENT_TYPE_LABELS } from './types';

export const REMINDER_CHANNEL_ID = 'assignment-reminders';

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
    const id = await scheduleReminderAsync(t, a.title, a.type, a.subjectName, a.dueAt);
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
  title: string,
  type: AssignmentType,
  subjectName: string,
  dueAt: number,
): Promise<string | null> {
  const dayLabel = formatDayLabel(dueAt, t.fireAt.getTime());
  const day = ['Today', 'Tomorrow'].includes(dayLabel) ? dayLabel.toLowerCase() : `on ${dayLabel}`;
  const when = `${day} at ${formatTime(dueAt)}`;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: `${subjectName} ${ASSIGNMENT_TYPE_LABELS[type].toLowerCase()}`,
        body: `"${title}" is due ${when}.`,
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
