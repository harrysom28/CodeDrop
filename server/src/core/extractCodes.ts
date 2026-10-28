import type { Bookie } from './types.js';

/**
 * Finds booking codes in free text from Telegram / X posts.
 *
 * Tipster posts are messy: "SPORTY CODE: 3F8KQ2 🔥 5 odds", "Bet9ja ➡️ 9J4X7TQ",
 * several bookies in one post, emojis, times, odds and phone numbers mixed in.
 * We keep this deliberately conservative: a false code costs a wasted bookie lookup,
 * a missed code costs nothing visible.
 */

export interface ExtractedCode {
  code: string;
  bookie: Bookie | 'unknown';
}

const BOOKIE_PATTERNS: Array<[Bookie, RegExp]> = [
  ['sportybet', /\bsporty(?:\s*bet)?\b/i],
  ['bet9ja', /\b(?:bet\s*9ja|b9ja|9ja)\b/i],
  ['betking', /\bbet\s*king\b/i],
  ['msport', /\bm\s*sport\b/i],
  ['betway', /\bbet\s*way\b/i],
  ['1xbet', /\b1\s*x\s*bet\b/i],
  ['22bet', /\b22\s*bet\b/i],
];

/** Words that look like codes but are not (mixed letters+digits). */
const STOPWORDS = new Set([
  'MP3', 'MP4', 'H2H', 'U19', 'U20', 'U21', 'U23', '1X2', 'BTTS', 'GG', 'NG',
  'OV25', 'UN25', 'O2', 'U2', 'X2', '1X', '12', 'HT', 'FT', '2ODDS', '3ODDS', '5ODDS', '10ODDS',
]);

const CODE_KEYWORD = /\b(?:code|booking|book|bc)\b/i;
const TOKEN = /\b[A-Za-z0-9]{5,10}\b/g;

function detectBookie(text: string): Bookie | undefined {
  const found = BOOKIE_PATTERNS.filter(([, re]) => re.test(text)).map(([b]) => b);
  return found.length === 1 ? found[0] : undefined;
}

function looksLikeCode(token: string, lineHasCodeKeyword: boolean): boolean {
  const upper = token.toUpperCase();
  if (STOPWORDS.has(upper)) return false;
  // Codes are written in capitals; ordinary lowercase words are never codes.
  if (token !== upper) return false;
  if (/^\d+ODDS?$/.test(upper)) return false;
  const hasDigit = /\d/.test(upper);
  const hasLetter = /[A-Z]/.test(upper);
  if (hasDigit && hasLetter) return true;
  // Pure-digit or pure-letter tokens only when the line explicitly says "code".
  if (!lineHasCodeKeyword) return false;
  if (!hasLetter) return upper.length >= 6 && upper.length <= 9 && !/^0\d{9,}$/.test(upper);
  return !hasDigit && upper.length >= 6 && upper.length <= 8;
}

export function extractCodes(text: string): ExtractedCode[] {
  const postBookie = detectBookie(text);
  const out = new Map<string, ExtractedCode>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/[^\p{L}\p{N}\s:.\-+/]/gu, ' ');
    const lineBookie = detectBookie(line);
    const hasKeyword = CODE_KEYWORD.test(line) || lineBookie !== undefined;

    for (const match of line.matchAll(TOKEN)) {
      const token = match[0];
      // Skip the bookie names themselves and clock/odds fragments.
      if (BOOKIE_PATTERNS.some(([, re]) => re.test(token))) continue;
      if (!looksLikeCode(token, hasKeyword)) continue;
      const code = token.toUpperCase();
      if (!out.has(code)) {
        out.set(code, { code, bookie: lineBookie ?? postBookie ?? 'unknown' });
      }
    }
  }
  return [...out.values()];
}
