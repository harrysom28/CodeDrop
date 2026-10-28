import { randomBytes } from 'node:crypto';
import { Types } from 'mongoose';
import { scoreTipster } from '../core/ranking.js';
import { HttpError } from '../errors.js';
import { Channel, SpottedSlip } from '../models/index.js';

const VERIFY_RE = /\bcodedrop-verify\s+([A-Z0-9]{4,12})\b/i;

export function newClaimToken(): string {
  return randomBytes(3).toString('hex').toUpperCase().slice(0, 4);
}

export function claimVerifyLine(token: string): string {
  return `codedrop-verify ${token}`;
}

export function extractClaimToken(text: string): string | undefined {
  const m = text.match(VERIFY_RE);
  return m?.[1]?.toUpperCase();
}

export async function startChannelClaim(username: string, userId: Types.ObjectId) {
  const handle = username.replace(/^@/, '').toLowerCase();
  const channel = await Channel.findOne({ source: 'telegram', username: handle });
  if (!channel || channel.optedOut || !channel.enabled) {
    throw new HttpError(404, 'Channel not tracked or has opted out');
  }
  if (channel.claimedBy && !channel.claimedBy.equals(userId)) {
    throw new HttpError(409, 'This channel is already claimed');
  }
  const token = newClaimToken();
  channel.claimToken = token;
  channel.claimRequestedBy = userId;
  await channel.save();
  return {
    username: handle,
    token,
    verifyLine: claimVerifyLine(token),
    instructions: [
      'Post the verify line exactly as shown in your channel.',
      'We watch public posts only — no private groups.',
      'Claiming usually completes within a minute of the post appearing.',
    ],
  };
}

/** Complete claim when the verify line matches a pending token. */
export async function completeClaim(channelUsername: string, text: string): Promise<{
  claimed: boolean;
  userId?: Types.ObjectId;
}> {
  const token = extractClaimToken(text);
  if (!token) return { claimed: false };
  const handle = channelUsername.replace(/^@/, '').toLowerCase();
  const channel = await Channel.findOne({
    source: 'telegram',
    username: handle,
    claimToken: token,
    optedOut: { $ne: true },
  });
  if (!channel?.claimRequestedBy) return { claimed: false };
  if (channel.claimedBy) return { claimed: true, userId: channel.claimedBy };

  channel.claimedBy = channel.claimRequestedBy;
  channel.claimToken = undefined;
  await channel.save();
  return { claimed: true, userId: channel.claimedBy };
}

export async function channelRecordFor(username: string) {
  const handle = `@${username.replace(/^@/, '').toLowerCase()}`;
  const slips = await SpottedSlip.find(
    { 'sightings.channel': handle, result: { $in: ['won', 'lost'] } },
    { result: 1, totalOdds: 1 },
  ).lean();
  const stats = slips.map((s) => ({
    stakeUnits: 1,
    profitUnits: s.result === 'won' ? s.totalOdds - 1 : -1,
  }));
  const score = scoreTipster(handle, stats);
  const hits = slips.filter((s) => s.result === 'won').length;
  return {
    channel: handle,
    label: 'Spotted history',
    note: 'Spotted history is kept separate from locked picks and never mixed into leaderboard ranking.',
    ...score,
    hitRate: slips.length ? hits / slips.length : null,
  };
}
