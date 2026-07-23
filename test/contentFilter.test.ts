// Unit tests for the local content filter (src/contentFilter.ts).
//
// This project has no React-Native test harness (no jest-expo), so these run on
// Node's built-in test runner with native TypeScript type-stripping — the same
// lightweight approach the overdude backend uses (`node --test`). The filter is
// pure and has zero RN imports, so it loads directly. See package.json "test".
//
// The screen-level block is exercised at the guard-function seam that the screens
// actually call (`checkTextFields`) plus a modeled save flow, rather than by
// mounting a RN component — see the "save flow" test below for what that covers
// and what it does not.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BLOCK_MESSAGE,
  checkTextFields,
  flagContent,
  isContentAllowed,
} from '../src/contentFilter.ts';

describe('flagContent — clean text passes', () => {
  const clean = [
    'Read chapter 4 of Biology', // "Biology" must NOT trip (substring paranoia)
    'Math worksheet p. 12–14',
    'Study for the classics exam', // "class"/"assess"-style near-misses stay clean
    'Photosynthesis lab writeup',
    'Bring cockpit diagram for aviation club', // "cockpit" ≠ "cock"
    'Analyze the grape harvest data', // "grape" ≠ "rape"
    'Essay on the Cold War', // no violence-word substring
    'Weekend reading',
    '', // empty
    '   ', // whitespace only
  ];
  for (const text of clean) {
    it(JSON.stringify(text), () => {
      assert.equal(flagContent(text), null);
      assert.equal(isContentAllowed(text), true);
    });
  }
});

describe('flagContent — each category is caught', () => {
  const cases: { text: string; category: string }[] = [
    { text: 'what the fuck is this', category: 'profanity' },
    { text: 'this is bullshit', category: 'profanity' },
    { text: 'watch some porn later', category: 'sexual' },
    { text: 'send nudes', category: 'sexual' },
    { text: 'I will murder the final', category: 'violence' }, // word-list is literal; see limitations
    { text: 'notes on the massacre', category: 'violence' },
    { text: 'score some cocaine', category: 'drugs' },
    { text: 'hide the bong', category: 'drugs' },
  ];
  for (const { text, category } of cases) {
    it(`${category}: ${JSON.stringify(text)}`, () => {
      assert.equal(flagContent(text), category);
      assert.equal(isContentAllowed(text), false);
    });
  }
});

describe('flagContent — matching details', () => {
  it('is case-insensitive', () => {
    assert.equal(flagContent('FUCK this'), 'profanity');
    assert.equal(flagContent('CoCaInE'), 'drugs');
  });
  it('matches common inflections (suffixes)', () => {
    assert.equal(flagContent('stop fucking around'), 'profanity');
    assert.equal(flagContent('two bongs'), 'drugs');
  });
  it('respects word boundaries (no Scunthorpe over-match)', () => {
    assert.equal(flagContent('cockpit'), null);
    assert.equal(flagContent('assassin classic'), null);
  });
});

describe('flagContent — documented FALSE-NEGATIVE gaps (word-list is leaky)', () => {
  // These SHOULD arguably be blocked but a plain word-list cannot catch them.
  // Encoded as expectations so the limitation is explicit, not accidental — if a
  // future change starts catching them, that is an improvement to celebrate here.
  it('obfuscation slips through', () => {
    assert.equal(flagContent('f*ck'), null);
    assert.equal(flagContent('sh1t'), null);
    assert.equal(flagContent('c o c a i n e'), null);
  });
});

describe('checkTextFields — the screen save-guard', () => {
  it('returns null when every field is clean', () => {
    assert.equal(checkTextFields(['Read chapter 4', 'bring calculator']), null);
  });
  it('returns the gentle block message when any field is flagged', () => {
    assert.equal(checkTextFields(['clean title', 'some porn notes']), BLOCK_MESSAGE);
  });
  it('ignores null/undefined/empty fields', () => {
    assert.equal(checkTextFields([null, undefined, '', 'homework']), null);
  });
  it('block message carries no shame and never names the category (copy rulebook)', () => {
    const lower = BLOCK_MESSAGE.toLowerCase();
    for (const banned of ['fail', 'broke', 'inappropriate', 'profan', 'violat', 'bad', 'wrong']) {
      assert.ok(!lower.includes(banned), `message should not contain "${banned}"`);
    }
  });
});

describe('save flow — a flagged field prevents the persist (models AssignmentEditScreen.save)', () => {
  // Faithfully mirrors the guard AssignmentEditScreen.save() runs before it calls
  // createAssignment: `const blocked = checkTextFields([title, notes]); if (blocked)
  // { setContentError(blocked); return; }`. We cannot mount the RN screen here
  // (no jest-expo), so this reproduces that exact control flow against a spy to
  // prove the block short-circuits the write. The real screen wiring is verified
  // by tsc + code review.
  function attemptSave(
    title: string,
    notes: string,
    persist: (input: { title: string; notes: string }) => void,
  ): string | null {
    const blocked = checkTextFields([title.trim(), notes]);
    if (blocked) return blocked; // early return — nothing is persisted
    persist({ title: title.trim(), notes });
    return null;
  }

  it('does NOT persist when the title is flagged', () => {
    let persisted = false;
    const result = attemptSave('go watch porn', 'clean notes', () => {
      persisted = true;
    });
    assert.equal(persisted, false);
    assert.equal(result, BLOCK_MESSAGE);
  });

  it('does NOT persist when only the notes are flagged', () => {
    let persisted = false;
    const result = attemptSave('Read chapter 4', 'score some cocaine after', () => {
      persisted = true;
    });
    assert.equal(persisted, false);
    assert.equal(result, BLOCK_MESSAGE);
  });

  it('DOES persist clean input', () => {
    let persisted: { title: string; notes: string } | null = null;
    const result = attemptSave('Read chapter 4', 'bring the calculator', (input) => {
      persisted = input;
    });
    assert.equal(result, null);
    assert.deepEqual(persisted, { title: 'Read chapter 4', notes: 'bring the calculator' });
  });
});
