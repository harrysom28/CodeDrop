/**
 * Chat moderation helpers for match rooms.
 * Blocks "sure odds" / "fixed match" language, phone numbers, and external TG/WA links.
 */

const BLOCKED = [
  /\bsure\s*odds?\b/i,
  /\bfixed\s*(match|game|odds?)?\b/i,
  /\bguaranteed\b/i,
  /\b(whats?\s*app|wa\.me|t\.me|telegram\.me)\b/i,
  /(?:\+?234|0)\s*\d[\d\s-]{8,}\d/,
];

export function filterRoomMessage(text: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, reason: 'Empty message' };
  if (trimmed.length > 500) return { ok: false, reason: 'Max 500 characters' };
  for (const re of BLOCKED) {
    if (re.test(trimmed)) {
      return { ok: false, reason: 'Message blocked by room rules' };
    }
  }
  return { ok: true };
}

/** Slow-mode: default 5s between messages in match rooms. */
export function slowModeBlocked(lastSentAt: Date | undefined, now: Date, gapMs = 5000): boolean {
  if (!lastSentAt) return false;
  return now.getTime() - lastSentAt.getTime() < gapMs;
}
