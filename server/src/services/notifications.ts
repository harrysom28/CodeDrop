import { Types } from 'mongoose';
import { Notification, User } from '../models/index.js';

export const NOTIFICATION_TYPES = [
  'channel_claimed',
  'tipster_pick',
  'bet_settled',
  'room_live',
  'mention',
  'escrow',
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface PushPrefs {
  tipsterPick: boolean;
  betSettled: boolean;
  roomLive: boolean;
  mention: boolean;
  escrow: boolean;
  quietHoursStart: number; // 0–23 local hour
  quietHoursEnd: number;
}

export const DEFAULT_PUSH_PREFS: PushPrefs = {
  tipsterPick: true,
  betSettled: true,
  roomLive: true,
  mention: true,
  escrow: true,
  quietHoursStart: 1,
  quietHoursEnd: 7,
};

const TYPE_PREF: Partial<Record<NotificationType, keyof PushPrefs>> = {
  tipster_pick: 'tipsterPick',
  bet_settled: 'betSettled',
  room_live: 'roomLive',
  mention: 'mention',
  escrow: 'escrow',
};

/** In-memory rate limit: 1 push per tipster per 10 minutes per user. */
const tipsterPushAt = new Map<string, number>();

export function inQuietHours(prefs: PushPrefs, now = new Date(), timeZone = 'Africa/Lagos'): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hour12: false, timeZone }).format(now),
  );
  const { quietHoursStart: start, quietHoursEnd: end } = prefs;
  if (start === end) return false;
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end;
}

export function allowTipsterPush(userId: string, tipsterId: string, now = Date.now()): boolean {
  const key = `${userId}:${tipsterId}`;
  const last = tipsterPushAt.get(key) ?? 0;
  if (now - last < 10 * 60_000) return false;
  tipsterPushAt.set(key, now);
  return true;
}

/** Test helper. */
export function resetTipsterPushRateLimit() {
  tipsterPushAt.clear();
}

export async function enqueueNotification(input: {
  userId: Types.ObjectId | string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  tipsterId?: string;
  now?: Date;
}): Promise<{ created: boolean; pushed: boolean; reason?: string }> {
  const user = await User.findById(input.userId).lean();
  if (!user) return { created: false, pushed: false, reason: 'user_missing' };

  const prefs: PushPrefs = { ...DEFAULT_PUSH_PREFS, ...(user.pushPrefs as Partial<PushPrefs> | undefined) };
  const prefKey = TYPE_PREF[input.type];
  if (prefKey && prefs[prefKey] === false) {
    return { created: false, pushed: false, reason: 'toggled_off' };
  }

  if (input.type === 'tipster_pick' && input.tipsterId) {
    if (!allowTipsterPush(String(input.userId), input.tipsterId, (input.now ?? new Date()).getTime())) {
      return { created: false, pushed: false, reason: 'rate_limited' };
    }
  }

  const quiet = inQuietHours(prefs, input.now);
  const doc = await Notification.create({
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data,
    pushedAt: quiet ? undefined : new Date(),
  });

  // Real Expo push is wired when the user has device tokens (Phase 1.6 send path).
  if (!quiet && user.expoPushTokens?.length) {
    await sendExpoPush(user.expoPushTokens, { title: input.title, body: input.body, data: input.data });
  }

  return { created: true, pushed: !quiet && !!doc.pushedAt };
}

async function sendExpoPush(
  tokens: string[],
  message: { title: string; body: string; data?: Record<string, unknown> },
) {
  const payload = tokens.map((to) => ({
    to,
    sound: 'default',
    title: message.title,
    body: message.body,
    data: message.data,
  }));
  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Soft-fail: notification remains in-app even if Expo is unreachable.
  }
}
