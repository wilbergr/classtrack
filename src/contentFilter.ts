// Local, network-free content filter for free-text a student types (assignment
// title/notes, subject name, companion name, onboarding name). ClassTrack has
// ZERO backend and ZERO network calls (see AGENTS.md "Architecture"), so unlike
// a server that can call a moderation endpoint this is a plain SYNCHRONOUS,
// on-device word-list check — no API, no LLM, no I/O. Adapted in spirit from the
// overdude backend's local profanity word-list (wilbergr/overdude PR #9,
// backend/src/moderation.ts), but here it is the ONLY line of defense and covers
// four categories rather than backstopping an endpoint.
//
// ─────────────────────────────────────────────────────────────────────────────
// KNOWN LIMITATIONS — a word-list is leaky in BOTH directions; do not read more
// coverage into this than a word-list actually provides:
//   * FALSE NEGATIVES: obfuscation ("f*ck", "sh1t", "s h i t", spacing/leetspeak)
//     and any term not on the list slip straight through. The lists are
//     deliberately small and English-only.
//   * FALSE POSITIVES: despite word-boundary matching (which avoids the worst
//     Scunthorpe cases like "cockpit"/"classic"/"assess"), a substring-shaped
//     term can still over-match. Ambiguous-but-legitimate school vocabulary is
//     deliberately OMITTED to protect real study topics — e.g. "kill" (casual
//     "this homework is killing me"), "shoot" (basketball / photo shoot),
//     "crack" ("crack the code"), "weed" (plant biology), and the clinical
//     anatomy terms a Biology assignment legitimately needs ("penis"/"vagina").
//     This mirrors how the overdude list omits mild words to avoid fighting a
//     legitimate register.
// The lists below are a PRODUCT decision — tune them, don't treat them as
// exhaustive. This is a gentle guardrail, not a guarantee.
// ─────────────────────────────────────────────────────────────────────────────

export type ContentCategory = 'profanity' | 'sexual' | 'violence' | 'drugs';

// Each list holds unambiguous, strong terms only (see the false-positive note
// above for what is intentionally left out). Case-insensitive; matched with word
// boundaries + a small set of common English suffixes so "fuck"/"fucking",
// "rape"/"raping", "bong"/"bongs" all match while "cockpit" does not.
const TERMS: Record<ContentCategory, readonly string[]> = {
  profanity: [
    'fuck',
    'motherfucker',
    'shit',
    'bullshit',
    'bitch',
    'bastard',
    'asshole',
    'dickhead',
    'cunt',
    'slut',
    'whore',
    'douchebag',
    'wanker',
    'bollocks',
    'twat',
    'prick',
  ],
  sexual: [
    'porn',
    'blowjob',
    'handjob',
    'dildo',
    'boob',
    'boobs',
    'titties',
    'horny',
    'orgasm',
    'masturbate',
    'pussy',
    'cock', // \bcock\b does not match "cockpit" (no word boundary before "pit")
    'boner',
    'cum',
    'nude',
    'nudes',
  ],
  violence: [
    'rape',
    'murder',
    'behead',
    'decapitate',
    'strangle',
    'slaughter',
    'massacre',
    'mutilate',
    'molest',
    'lynch',
    'torture',
  ],
  drugs: [
    'cocaine',
    'heroin',
    'meth',
    'methamphetamine',
    'marijuana',
    'cannabis',
    'bong',
    'fentanyl',
    'oxycontin',
    'ketamine',
    'ecstasy',
  ],
};

// One compiled regex per category. Suffix group mirrors the overdude list so
// simple inflections match; it is deliberately generic and will occasionally
// over- or under-reach (documented above).
const SUFFIX = '(?:s|es|ed|ing|er|ers|y|ies)?';
const PATTERNS: { category: ContentCategory; re: RegExp }[] = (
  Object.entries(TERMS) as [ContentCategory, readonly string[]][]
).map(([category, list]) => ({
  category,
  re: new RegExp(`\\b(?:${list.join('|')})${SUFFIX}\\b`, 'i'),
}));

/**
 * The first category `text` trips, or `null` if it looks clean. Pure and
 * synchronous — safe to call at save/submit time. Best-effort only (see the
 * limitations note at the top of this file).
 */
export function flagContent(text: string): ContentCategory | null {
  if (!text) return null;
  for (const { category, re } of PATTERNS) {
    if (re.test(text)) return category;
  }
  return null;
}

/** Convenience boolean wrapper around {@link flagContent}. */
export function isContentAllowed(text: string): boolean {
  return flagContent(text) === null;
}

/**
 * Save-time guard for a screen: given the free-text fields it is about to
 * persist, return a gentle, category-free message to show inline when ANY field
 * is flagged, or `null` when everything is clean (so the caller proceeds).
 *
 * The message is deliberately the SAME regardless of which category tripped: it
 * never names the category or echoes the word (that would read as accusatory and
 * leak what matched), and it follows the AGENTS.md copy rulebook — no shame, no
 * diagnosis, nothing punitive. Screens call this in their save/submit handler
 * and early-return when it is non-null. Because voice-capture transcripts land
 * in the same field state before saving (VoiceCaptureButton only calls
 * `onTranscript`), checking here covers typed AND dictated input.
 */
export function checkTextFields(fields: (string | null | undefined)[]): string | null {
  for (const field of fields) {
    if (field && flagContent(field) !== null) return BLOCK_MESSAGE;
  }
  return null;
}

/** Gentle, non-shaming inline copy shown when a field is blocked. */
export const BLOCK_MESSAGE = "Let's use different words for this one ✦";
