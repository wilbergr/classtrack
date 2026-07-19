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

// ---------- Speech bubbles: the Home guidance voice ----------
//
// The same four personalities gain an on-screen mouth. Same copy rules as
// reminders: no guilt, no "still haven't", nothing clinical; misses are never
// mentioned; overdue is always "whenever you're ready"; the dozing companion
// is asleep, never sad. Slots with an empty pool are simply skipped.

/** Everything a bubble line can mention — all derived from on-device data. */
export interface BubbleCtx {
  /** Companion display name. */
  name: string;
  dueToday: number;
  dueTomorrow: number;
  overdue: number;
  /** Title of the single most relevant open item ('' when none). */
  nudgeTitle: string;
  /** Proximity phrase for the nudge target, e.g. "tonight", "tomorrow morning". */
  nudgeWhen: string;
  level: number;
  momentum: number;
  /** Sparks earned by the action being celebrated. */
  earned: number;
  /** Display name of the companion's evolution stage (e.g. "Sprout"). */
  stage: string;
  /** True at the last evolution stage — growth talk becomes pride talk. */
  finalForm: boolean;
}

export type BubbleSlot =
  | 'greetingMorning'
  | 'greetingAfternoon'
  | 'greetingEvening'
  | 'daySummary'
  | 'daySummaryBig'
  | 'nudge'
  | 'allClear'
  | 'overdueGentle'
  | 'comeback'
  | 'celebrate'
  | 'levelUp'
  | 'evolve'
  | 'windDown'
  | 'weekend'
  | 'idlePoke'
  | 'dozing'
  /** Name + stage-progress intro — replaces the old Home name/stage label. */
  | 'identity';

export type BubbleTemplate = (ctx: BubbleCtx) => string;
export type BubbleSet = Record<BubbleSlot, BubbleTemplate[]>;

const emberBubbles: BubbleSet = {
  greetingMorning: [
    () => 'Morning!! Fresh day, fresh points on the table. ✦',
    () => "Good morning! I've got the list warm whenever you are. ✦",
    () => "Morning! Let's make today look easy. ✦",
  ],
  greetingAfternoon: [
    () => 'Hey hey! Afternoon check-in — I saved you a seat. ✦',
    () => "Afternoon! Plenty of day left and I'm feeling lucky. ✦",
    () => 'There you are! The afternoon is wide open. ✦',
  ],
  greetingEvening: [
    () => 'Evening! Still here, still cheering. ✦',
    () => 'Good evening! Low lights, high spirits. ✦',
    () => "Evening shift, reporting in. I don't sleep on your wins. ✦",
  ],
  daySummary: [
    (c) => `${cap(things(c.dueToday))} due today — want to knock one out early? ✦`,
    (c) => `Today's menu: ${things(c.dueToday)}. Pick a fun one first. ✦`,
    (c) => `${cap(things(c.dueToday))} on today's board. Totally doable. ✦`,
  ],
  daySummaryBig: [
    (c) => `Big day: ${c.dueToday} due. One at a time — pick your opener. ✦`,
    (c) => `${c.dueToday} due today. Deep breath — we chip, we don't boulder. ✦`,
    (c) => `Stacked day (${c.dueToday} due). First one's the hardest; I'll be loud for it. ✦`,
  ],
  nudge: [
    (c) => `"${c.nudgeTitle}" is due ${c.nudgeWhen}. Twenty minutes and it's toast. ✦`,
    (c) => `Hot tip: "${c.nudgeTitle}" lands ${c.nudgeWhen}. Strike now, coast later. ✦`,
    (c) => `"${c.nudgeTitle}", due ${c.nudgeWhen}. Easy Sparks with your name on them. ✦`,
  ],
  allClear: [
    () => 'Nothing due today. Legend behavior. ✦',
    () => 'All clear today! Go do something ridiculous. ✦',
    () => 'Zero due today. I take partial credit. Mostly yours though. ✦',
  ],
  overdueGentle: [
    (c) =>
      `${cap(things(c.overdue))} from before ${c.overdue === 1 ? 'is' : 'are'} still hanging around — whenever you're ready, I'll cheer.`,
    (c) => `${cap(things(c.overdue))} from earlier, still on the bench. Any time you like. ✦`,
  ],
  comeback: [
    () => "There you are!! I kept your spot warm. What's first? ✦",
    () => 'Welcome back!! Best part of my day. The board is ready when you are. ✦',
    () => "Hey, you're here! That's the whole battle. Let's go. ✦",
  ],
  celebrate: [
    (c) => `+${c.earned} ✦!! That's the stuff!`,
    (c) => `+${c.earned} Sparks! I am FED. ✦`,
    () => 'Yes!! Another one on the board. ✦',
  ],
  levelUp: [
    (c) => `LEVEL ${c.level}!! I feel taller. Do I look taller? ✦`,
    (c) => `LEVEL ${c.level}!! You did this. I'm just glowing about it. ✦`,
  ],
  evolve: [
    () => 'WHOA. New form unlocked. You did this. ✦',
    () => 'EVOLUTION!! Look at me. Look at US. ✦',
  ],
  windDown: [
    (c) =>
      `Evening check: tomorrow has ${things(c.dueTomorrow)}. Future-you says hi and thanks. ✦`,
    (c) => `Tomorrow: ${things(c.dueTomorrow)}. A ten-minute head start tonight? Chef's kiss. ✦`,
  ],
  weekend: [
    () => 'Weekend mode! Anything you add now is a gift to Monday-you. ✦',
    () => "It's a weekend. Rest counts as strategy. ✦",
  ],
  idlePoke: [
    () => 'Hi hi hi ✦',
    () => 'Poke received. Morale +10. ✦',
    () => 'That tickles! ✦',
    (c) => `Level ${c.level} and climbing. Just saying. ✦`,
  ],
  dozing: [() => '…zzz… (tap to say hi)'],
  identity: [
    (c) =>
      c.finalForm
        ? `${c.name} here — ${c.stage} form! Fully grown, and it's all thanks to you. ✦`
        : `${c.name} here — ${c.stage} form! Keep the Sparks coming and I get even bigger. ✦`,
    (c) =>
      c.finalForm
        ? `It's me, ${c.name}! Level ${c.level}, final form, maximum sparkle. ✦`
        : `It's me, ${c.name}! Level ${c.level} ${c.stage} — my next form is already wiggling. ✦`,
  ],
};

const sageBubbles: BubbleSet = {
  greetingMorning: [
    () => 'Good morning. The day has room in it.',
    () => 'Morning. No rush — everything is where you left it.',
    () => 'Good morning. One thing at a time is plenty.',
  ],
  greetingAfternoon: [
    () => 'Good afternoon. The day is going fine.',
    () => 'Afternoon. There is still plenty of light to work with.',
  ],
  greetingEvening: [
    () => 'Good evening. Quiet hours are good hours.',
    () => 'Evening. Whatever got done today was enough.',
  ],
  daySummary: [
    (c) => `Today holds ${things(c.dueToday)}; there's room for ${c.dueToday === 1 ? 'it' : 'all of them'}.`,
    (c) => `${cap(things(c.dueToday))} due today. A steady pace covers it.`,
  ],
  daySummaryBig: [
    (c) => `A fuller day: ${c.dueToday} due. Begin anywhere; beginning is the whole trick.`,
    (c) => `${c.dueToday} things today. They go one at a time, same as always.`,
  ],
  nudge: [
    (c) => `"${c.nudgeTitle}" is due ${c.nudgeWhen}. This evening has a good window.`,
    (c) => `When you have a moment: "${c.nudgeTitle}", due ${c.nudgeWhen}.`,
    (c) => `"${c.nudgeTitle}" arrives ${c.nudgeWhen}. A calm start now would settle it.`,
  ],
  allClear: [
    () => 'Nothing due today. Enjoy the open water.',
    () => "A clear day. They're earned, you know.",
  ],
  overdueGentle: [
    (c) =>
      `${cap(things(c.overdue))} from earlier ${c.overdue === 1 ? 'is' : 'are'} still open. ${c.overdue === 1 ? 'It' : 'They'}'ll keep — whenever you're ready.`,
  ],
  comeback: [
    () => 'Welcome back. Nothing to catch up on but hello.',
    () => 'There you are. The list kept itself; sit down whenever you like.',
  ],
  celebrate: [
    (c) => `Well done — ${c.earned} Sparks.`,
    () => "That's one more thing carried across. Nicely done.",
  ],
  levelUp: [
    (c) => `Level ${c.level}. Growth suits you.`,
    (c) => `Level ${c.level} — steady work, adding up.`,
  ],
  evolve: [
    () => 'A new form. Grown from steady work — thank you.',
    () => "I've grown. Your Sparks did this, you know.",
  ],
  windDown: [
    (c) => `Tomorrow holds ${things(c.dueTomorrow)}. Tonight can be gentle about it.`,
    (c) => `An evening note: ${things(c.dueTomorrow)} tomorrow. Rest is preparation too.`,
  ],
  weekend: [
    () => 'A weekend. Rest is part of the work.',
    () => 'Weekend hours. Anything you do now is a bonus, not a debt.',
  ],
  idlePoke: [
    () => 'Hello.',
    () => 'Here, as always.',
    () => 'Hm? Oh — hello.',
  ],
  dozing: [() => 'Resting… (tap to say hi)'],
  identity: [
    (c) =>
      c.finalForm
        ? `I'm ${c.name} — ${c.stage} stage, my last form. Grown entirely from your steady work.`
        : `I'm ${c.name} — ${c.stage} stage for now. Every Spark grows me a little.`,
    (c) =>
      c.finalForm
        ? `${c.name}, level ${c.level}. I've finished growing; the rest is just company.`
        : `${c.name}, level ${c.level}. My next form arrives in its own time — no rush.`,
  ],
};

const dotBubbles: BubbleSet = {
  greetingMorning: [
    () => 'Morning. The sun is up. Precedent suggests you can be too.',
    () => 'Good morning. Systems nominal. Snacks not included.',
  ],
  greetingAfternoon: [
    () => 'Afternoon. The homework is aware of you too.',
    () => 'Good afternoon. I have been standing here the whole time. Normal.',
  ],
  greetingEvening: [
    () => 'Evening. The day is mostly used. Remainder: yours.',
    () => 'Good evening. Night mode: engaged. Enthusiasm: internal.',
  ],
  daySummary: [
    (c) => `${cap(things(c.dueToday))} due today. That's the whole announcement. Beep.`,
    (c) => `Today's forecast: ${things(c.dueToday)}. Chance of finishing: high, historically.`,
  ],
  daySummaryBig: [
    (c) => `${c.dueToday} due today. Statistically, they fall one at a time.`,
    (c) => `Busy day detected (${c.dueToday} due). Deploying moral support: beep.`,
  ],
  nudge: [
    (c) => `"${c.nudgeTitle}". ${cap(c.nudgeWhen)}. That's the whole announcement. Beep.`,
    (c) => `"${c.nudgeTitle}" is due ${c.nudgeWhen}. The couch will still be there after.`,
    (c) => `Priority item: "${c.nudgeTitle}", ${c.nudgeWhen}. This message will not self-destruct. It just sits here.`,
  ],
  allClear: [
    () => 'Zero items due. Suspicious. Enjoy it.',
    () => 'Nothing due today. I checked twice. Beep.',
  ],
  overdueGentle: [
    (c) =>
      `${cap(things(c.overdue))} from earlier, still open. No timer on ${c.overdue === 1 ? 'it' : 'them'}. Whenever you're ready.`,
  ],
  comeback: [
    () => "You're back. I did not move. Efficient reunion. Beep.",
    () => 'Welcome back. The spot was kept warm by standing very still.',
  ],
  celebrate: [
    (c) => `+${c.earned} Sparks logged. Internally, I am doing a backflip.`,
    () => 'Task consumed. Delicious. Beep.',
  ],
  levelUp: [
    (c) => `Level ${c.level}. I have evolved. You did the work. Team effort.`,
    (c) => `Level ${c.level} acquired. Adjusting altitude. Beep.`,
  ],
  evolve: [
    () => 'Evolution complete. New body, same beep.',
    () => 'I have upgraded. The work was yours; the glow-up is mine.',
  ],
  windDown: [
    (c) => `Tomorrow: ${things(c.dueTomorrow)}. Tonight: optional heroics.`,
    (c) => `Forecast for tomorrow: ${things(c.dueTomorrow)}. This concludes the bulletin.`,
  ],
  weekend: [
    () => 'Weekend detected. Productivity: optional. Vibes: mandatory.',
    () => 'It is the weekend. I will be here, motionless, either way.',
  ],
  idlePoke: [
    () => 'Yes?',
    () => 'Poke registered. Filing under "affection".',
    () => 'Beep.',
    () => 'You rang. I have no bell. Mysterious.',
  ],
  dozing: [() => 'zzz… (tap to reboot)'],
  identity: [
    (c) =>
      `Designation: ${c.name}. Form: ${c.stage}. ${c.finalForm ? 'Upgrades: complete. Beep.' : 'Next upgrade: brewing. Beep.'}`,
    (c) => `${c.name}. Level ${c.level}. ${c.stage} form. Status: pleased to be here.`,
  ],
};

const plainBubbles: BubbleSet = {
  greetingMorning: [],
  greetingAfternoon: [],
  greetingEvening: [],
  daySummary: [
    (c) =>
      c.dueTomorrow > 0
        ? `${c.dueToday} due today, ${c.dueTomorrow} due tomorrow.`
        : `${c.dueToday} due today.`,
  ],
  daySummaryBig: [
    (c) =>
      c.dueTomorrow > 0
        ? `${c.dueToday} due today, ${c.dueTomorrow} due tomorrow.`
        : `${c.dueToday} due today.`,
  ],
  nudge: [(c) => `"${c.nudgeTitle}" is due ${c.nudgeWhen}.`],
  allClear: [() => 'Nothing due today.'],
  overdueGentle: [
    (c) => `${c.overdue} older item${c.overdue === 1 ? '' : 's'} still open — whenever you're ready.`,
  ],
  comeback: [() => 'Welcome back.'],
  celebrate: [(c) => `+${c.earned} sparks.`],
  levelUp: [(c) => `Level ${c.level}.`],
  evolve: [(c) => `Level ${c.level}.`],
  windDown: [(c) => `${c.dueTomorrow} due tomorrow.`],
  weekend: [],
  idlePoke: [() => 'Hi.'],
  dozing: [() => 'Resting. Tap to say hi.'],
  identity: [(c) => `${c.name} — ${c.stage}, level ${c.level}.`],
};

export const BUBBLES: Record<VoicePackId, BubbleSet> = {
  ember: emberBubbles,
  sage: sageBubbles,
  dot: dotBubbles,
  plain: plainBubbles,
};

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
