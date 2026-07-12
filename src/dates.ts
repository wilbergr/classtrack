// Date helpers. Hand-rolled formatting (no Intl dependency) so behavior is
// identical on Hermes/Android/iOS and fully offline.

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function addDays(ts: number, days: number): number {
  const d = new Date(ts);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function isSameDay(a: number, b: number): boolean {
  return startOfDay(a) === startOfDay(b);
}

/** Monday 00:00 of the week containing `ts`. */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return d.getTime();
}

/** "3:05 PM" */
export function formatTime(ts: number): string {
  const d = new Date(ts);
  const h24 = d.getHours();
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** "Today" / "Tomorrow" / "Yesterday" / "Mon, Sep 8" */
export function formatDayLabel(ts: number, now: number = Date.now()): string {
  const day = startOfDay(ts);
  const today = startOfDay(now);
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  if (day === addDays(today, -1)) return 'Yesterday';
  const d = new Date(ts);
  return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Today, 3:05 PM" — day label plus time. */
export function formatDueLabel(ts: number, now: number = Date.now()): string {
  return `${formatDayLabel(ts, now)}, ${formatTime(ts)}`;
}

export type DueStatus = 'done' | 'overdue' | 'today' | 'upcoming';

export function dueStatus(
  a: { dueAt: number; completed: boolean },
  now: number = Date.now(),
): DueStatus {
  if (a.completed) return 'done';
  if (a.dueAt < now) return 'overdue';
  if (isSameDay(a.dueAt, now)) return 'today';
  return 'upcoming';
}
