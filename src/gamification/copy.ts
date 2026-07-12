// Voice packs: the companion is the sender, the pack is its voice. Titles
// stay information-first (subject + type — a glanced notification is never
// less informative than v1); the BODY carries the personality.
//
// Copy rules (report §10): no guilt, no sarcasm at the user, no "you still
// haven't", no diagnosis vocabulary; misses are never mentioned; overdue is
// digest-only, "whenever you're ready" register.

import type { AssignmentType, VoicePackId } from '../types';

export interface ReminderCtx {
  /** Assignment title. */
  title: string;
  subjectName: string;
  /** "homework" | "test" | "project" (lowercased label). */
  typeLabel: string;
  /** e.g. "tomorrow at 8:00 AM". */
  whenPhrase: string;
}

export interface DigestCtx {
  dueCount: number;
  overdueCount: number;
}

export type ReminderSlot = 'eveningBefore' | 'morningOf';

type Template = (ctx: ReminderCtx) => string;
type DigestTemplate = (ctx: DigestCtx) => { title: string; body: string };

export interface VoicePack {
  reminders: Record<ReminderSlot, Record<AssignmentType, Template[]>>;
  /** Evening-before variant when the due day is heavy (≥3 items). */
  bigDay: Template[];
  /** The very first reminder this install ever shows. */
  firstEver: Template[];
  digest: DigestTemplate[];
}

const things = (n: number) => (n === 1 ? '1 thing' : `${n} things`);

// ---------- Ember: the energetic coach ----------

const ember: VoicePack = {
  reminders: {
    eveningBefore: {
      homework: [
        (c) => `"${c.title}" wants a word — due ${c.whenPhrase}. You've got this. ✦`,
        (c) => `Heads up: "${c.title}" is due ${c.whenPhrase}. Tonight's your moment. ✦`,
        (c) => `One quick win available: "${c.title}", due ${c.whenPhrase}. Future you says thanks.`,
        (c) => `"${c.title}" is due ${c.whenPhrase}. Knock it out tonight and coast tomorrow. ✦`,
      ],
      test: [
        (c) => `${c.subjectName} test ${c.whenPhrase}. A little review tonight goes a long way. ✦`,
        (c) => `Test alert: "${c.title}" is ${c.whenPhrase}. Tonight's prep is tomorrow's calm.`,
        (c) => `"${c.title}" ${c.whenPhrase}. Review now, walk in ready. You've got this. ✦`,
        (c) => `Big one: ${c.subjectName} test ${c.whenPhrase}. Even 20 minutes tonight counts. ✦`,
      ],
      project: [
        (c) => `Project check: "${c.title}" is due ${c.whenPhrase}. A chunk tonight keeps it easy. ✦`,
        (c) => `"${c.title}" lands ${c.whenPhrase}. Ship a piece of it tonight. ✦`,
        (c) => `Almost showtime — "${c.title}" is due ${c.whenPhrase}. Final touches tonight?`,
      ],
    },
    morningOf: {
      homework: [
        (c) => `"${c.title}" is due ${c.whenPhrase}. Grab it on the way out! ✦`,
        (c) => `Morning! "${c.title}" turns in ${c.whenPhrase}. In the bag? ✦`,
        (c) => `Today's the day for "${c.title}" — due ${c.whenPhrase}. Easy points. ✦`,
        (c) => `Quick check: "${c.title}" is due ${c.whenPhrase}. You're already ahead. ✦`,
      ],
      test: [
        (c) => `${c.subjectName} test ${c.whenPhrase}. Deep breath — you prepped for this. ✦`,
        (c) => `Game day: "${c.title}" ${c.whenPhrase}. Walk in like you own it. ✦`,
        (c) => `Test ${c.whenPhrase}. One more skim over your notes and go get it. ✦`,
        (c) => `"${c.title}" is ${c.whenPhrase}. You've done the work — trust it. ✦`,
      ],
      project: [
        (c) => `"${c.title}" is due ${c.whenPhrase}. Pack it, hand it in, done. ✦`,
        (c) => `Launch day: "${c.title}" goes in ${c.whenPhrase}. ✦`,
        (c) => `Don't forget "${c.title}" — due ${c.whenPhrase}. It's ready to shine. ✦`,
      ],
    },
  },
  bigDay: [
    (c) => `Big day tomorrow — "${c.title}" (due ${c.whenPhrase}) and friends. Pick one tonight and get ahead. ✦`,
    (c) => `Tomorrow's stacked. Start with "${c.title}" (due ${c.whenPhrase}) — momentum loves a head start. ✦`,
  ],
  firstEver: [
    (c) => `First reminder, reporting for duty ✦ "${c.title}" is due ${c.whenPhrase}. I'll keep watch — you do the winning.`,
  ],
  digest: [
    ({ dueCount, overdueCount }) => ({
      title: "Tonight's lineup ✦",
      body:
        `${things(dueCount)} due tomorrow — let's keep it warm.` +
        (overdueCount > 0 ? ` And ${things(overdueCount)} from before, whenever you're ready.` : ''),
    }),
    ({ dueCount, overdueCount }) => ({
      title: 'Evening game plan ✦',
      body:
        `${things(dueCount)} on deck for tomorrow. A little now beats a lot later.` +
        (overdueCount > 0 ? ` Plus ${things(overdueCount)} from before — no rush.` : ''),
    }),
  ],
};

// ---------- Sage: calm ----------

const sage: VoicePack = {
  reminders: {
    eveningBefore: {
      homework: [
        (c) => `A quiet heads-up: "${c.title}" is due ${c.whenPhrase}. Tonight's a good window.`,
        (c) => `"${c.title}" is due ${c.whenPhrase}. A little time this evening would cover it.`,
        (c) => `When you have a moment: "${c.title}", due ${c.whenPhrase}.`,
        (c) => `Gentle note — "${c.title}" is due ${c.whenPhrase}. No hurry, just awareness.`,
      ],
      test: [
        (c) => `${c.subjectName} test ${c.whenPhrase}. An unhurried review tonight would serve you well.`,
        (c) => `"${c.title}" is ${c.whenPhrase}. A calm look at your notes tonight is plenty.`,
        (c) => `Heads-up: test ${c.whenPhrase}. Rest matters as much as review.`,
      ],
      project: [
        (c) => `"${c.title}" is due ${c.whenPhrase}. An evening pass would settle it nicely.`,
        (c) => `A note: "${c.title}" arrives ${c.whenPhrase}. Steady progress tonight is enough.`,
      ],
    },
    morningOf: {
      homework: [
        (c) => `Good morning. "${c.title}" is due ${c.whenPhrase}.`,
        (c) => `A reminder with your morning: "${c.title}", due ${c.whenPhrase}.`,
        (c) => `"${c.title}" is due ${c.whenPhrase} — worth a glance before you head out.`,
      ],
      test: [
        (c) => `${c.subjectName} test ${c.whenPhrase}. Breathe — you know more than you think.`,
        (c) => `Test ${c.whenPhrase}. A calm mind carries you; the notes are already in there.`,
        (c) => `"${c.title}" is ${c.whenPhrase}. Steady on.`,
      ],
      project: [
        (c) => `"${c.title}" goes in ${c.whenPhrase}. Everything in the bag?`,
        (c) => `Morning note: "${c.title}" is due ${c.whenPhrase}.`,
      ],
    },
  },
  bigDay: [
    (c) => `Tomorrow holds a few things, "${c.title}" among them (due ${c.whenPhrase}). Choosing one tonight lightens the morning.`,
  ],
  firstEver: [
    (c) => `Hello — I'll leave gentle reminders here. First one: "${c.title}" is due ${c.whenPhrase}.`,
  ],
  digest: [
    ({ dueCount, overdueCount }) => ({
      title: 'This evening, briefly',
      body:
        `${things(dueCount)} due tomorrow. Tonight has room for a start.` +
        (overdueCount > 0 ? ` There ${overdueCount === 1 ? 'is' : 'are'} also ${things(overdueCount)} from before, whenever you're ready.` : ''),
    }),
    ({ dueCount, overdueCount }) => ({
      title: 'A look at tomorrow',
      body:
        `${things(dueCount)} arrive tomorrow. A calm evening pass is plenty.` +
        (overdueCount > 0 ? ` And ${things(overdueCount)} from earlier — no rush at all.` : ''),
    }),
  ],
};

// ---------- Dot: deadpan/dry ----------

const dot: VoicePack = {
  reminders: {
    eveningBefore: {
      homework: [
        (c) => `"${c.title}". ${cap(c.whenPhrase)}. Just saying. ✦`,
        (c) => `Reminder exists: "${c.title}", due ${c.whenPhrase}. Do with this what you will.`,
        (c) => `"${c.title}" is due ${c.whenPhrase}. The couch will still be there after.`,
        (c) => `Tonight's optional side quest: "${c.title}". Due ${c.whenPhrase}.`,
      ],
      test: [
        (c) => `${c.subjectName} test. ${cap(c.whenPhrase)}. Notes exist. Coincidence? No.`,
        (c) => `"${c.title}" ${c.whenPhrase}. Studying tonight: statistically excellent idea.`,
        (c) => `Test ${c.whenPhrase}. This is your dramatic foreshadowing.`,
      ],
      project: [
        (c) => `"${c.title}". Due ${c.whenPhrase}. Projects hate being remembered at 11 PM.`,
        (c) => `Status check: "${c.title}" lands ${c.whenPhrase}. That is all.`,
      ],
    },
    morningOf: {
      homework: [
        (c) => `"${c.title}". Due ${c.whenPhrase}. Backpack. Now. ✦`,
        (c) => `Morning. "${c.title}" is due ${c.whenPhrase}. You knew this.`,
        (c) => `Friendly robot voice: "${c.title}", ${c.whenPhrase}. Beep.`,
      ],
      test: [
        (c) => `${c.subjectName} test ${c.whenPhrase}. Go be mildly brilliant.`,
        (c) => `Test ${c.whenPhrase}. Pencils: recommended.`,
        (c) => `"${c.title}" is ${c.whenPhrase}. You've survived 100% of tests so far.`,
      ],
      project: [
        (c) => `"${c.title}" due ${c.whenPhrase}. It would like to leave the house with you.`,
        (c) => `Project handoff ${c.whenPhrase}. The dramatic conclusion.`,
      ],
    },
  },
  bigDay: [
    (c) => `Tomorrow is a lot. "${c.title}" (due ${c.whenPhrase}) plus others. Starting one tonight: pro move.`,
  ],
  firstEver: [
    (c) => `First reminder ever. Historic. "${c.title}" is due ${c.whenPhrase}. ✦`,
  ],
  digest: [
    ({ dueCount, overdueCount }) => ({
      title: 'Tomorrow: a forecast',
      body:
        `${things(dueCount)} due. Evening-you could make morning-you look great.` +
        (overdueCount > 0 ? ` Also ${things(overdueCount)} from before. Whenever. No pressure.` : ''),
    }),
    ({ dueCount, overdueCount }) => ({
      title: 'The nightly bulletin ✦',
      body:
        `${things(dueCount)} due tomorrow. This concludes the bulletin.` +
        (overdueCount > 0 ? ` (${things(overdueCount)} from earlier still hanging around, whenever you're ready.)` : ''),
    }),
  ],
};

// ---------- Plain: no personality (exactly the v1 style) ----------

const plainTemplate: Template = (c) => `"${c.title}" is due ${c.whenPhrase}.`;

const plain: VoicePack = {
  reminders: {
    eveningBefore: {
      homework: [plainTemplate],
      test: [plainTemplate],
      project: [plainTemplate],
    },
    morningOf: {
      homework: [plainTemplate],
      test: [plainTemplate],
      project: [plainTemplate],
    },
  },
  bigDay: [plainTemplate],
  firstEver: [plainTemplate],
  digest: [
    ({ dueCount, overdueCount }) => ({
      title: 'Due tomorrow',
      body:
        `${dueCount} assignment${dueCount === 1 ? '' : 's'} due tomorrow.` +
        (overdueCount > 0 ? ` ${overdueCount} older item${overdueCount === 1 ? '' : 's'} still open.` : ''),
    }),
  ],
};

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export const VOICE_PACKS: Record<VoicePackId, VoicePack> = { ember, sage, dot, plain };

export const VOICE_PACK_META: { id: VoicePackId; label: string; sample: string }[] = [
  { id: 'ember', label: 'Ember', sample: '"Math worksheet wants a word — you\'ve got this. ✦"' },
  { id: 'sage', label: 'Sage', sample: '"A quiet heads-up: due tomorrow morning."' },
  { id: 'dot', label: 'Dot', sample: '"History essay. Tomorrow. Just saying. ✦"' },
  { id: 'plain', label: 'Plain', sample: '"Read chapter 4" is due tomorrow at 8:00 AM.' },
];

/**
 * Deterministic template pick: hash(assignmentId, fireDate) over the pool,
 * skipping recently-used template keys so back-to-back reminders never
 * repeat a body. Returns the body and the key to record.
 */
export function pickTemplate<T>(
  pool: T[],
  poolKeyPrefix: string,
  assignmentId: number,
  fireAt: number,
  recent: string[],
): { value: T; key: string } {
  const start = Math.abs((assignmentId * 31 + Math.floor(fireAt / 60000)) % pool.length);
  for (let i = 0; i < pool.length; i++) {
    const idx = (start + i) % pool.length;
    const key = `${poolKeyPrefix}:${idx}`;
    if (!recent.includes(key)) return { value: pool[idx], key };
  }
  return { value: pool[start], key: `${poolKeyPrefix}:${start}` };
}
