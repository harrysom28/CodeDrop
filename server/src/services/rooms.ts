import { Types } from 'mongoose';
import { filterRoomMessage, slowModeBlocked } from '../core/moderation.js';
import { HttpError } from '../errors.js';
import { PickModel, User } from '../models/index.js';
import { Room, RoomBan, RoomMessage } from '../models/rooms.js';

const lastSent = new Map<string, Date>();

export async function ensureGeneralRoom() {
  return Room.findOneAndUpdate(
    { kind: 'general', key: 'general' },
    { $setOnInsert: { title: 'General banter', slowModeMs: 3000 } },
    { upsert: true, new: true },
  );
}

export async function listRooms() {
  await ensureGeneralRoom();
  const now = new Date();
  return Room.find({
    $or: [
      { kind: { $in: ['general', 'club', 'tipster'] }, closed: { $ne: true } },
      { kind: 'fixture', closed: { $ne: true }, opensAt: { $lte: now }, closesAt: { $gt: now } },
    ],
  })
    .sort({ kind: 1, title: 1 })
    .limit(100)
    .lean();
}

export async function postMessage(input: {
  roomId: string;
  userId: Types.ObjectId;
  text?: string;
  pickId?: string;
}) {
  const room = await Room.findById(input.roomId);
  if (!room || room.closed) throw new HttpError(404, 'Room not found');

  const ban = await RoomBan.findOne({ roomId: room._id, userId: input.userId }).lean();
  if (ban?.banned) throw new HttpError(403, 'You are banned from this room');
  if (ban?.mutedUntil && ban.mutedUntil > new Date()) throw new HttpError(403, 'You are muted in this room');

  const key = `${room.id}:${input.userId}`;
  if (slowModeBlocked(lastSent.get(key), new Date(), room.slowModeMs ?? 5000)) {
    throw new HttpError(429, 'Slow mode — wait a few seconds');
  }

  if (input.pickId) {
    const user = await User.findById(input.userId).lean();
    if (user?.role !== 'tipster' && user?.role !== 'admin') {
      throw new HttpError(403, 'Only verified tipsters can share slips here');
    }
    const pick = await PickModel.findById(input.pickId).lean();
    if (!pick || !pick.tipsterId.equals(input.userId)) throw new HttpError(404, 'Pick not found');
    const msg = await RoomMessage.create({
      roomId: room._id,
      userId: input.userId,
      kind: 'slip',
      pickId: pick._id,
      text: input.text?.slice(0, 500),
    });
    lastSent.set(key, new Date());
    return msg;
  }

  const text = input.text ?? '';
  const filtered = filterRoomMessage(text);
  if (!filtered.ok) throw new HttpError(400, filtered.reason);
  const msg = await RoomMessage.create({
    roomId: room._id,
    userId: input.userId,
    kind: 'text',
    text: text.trim(),
  });
  lastSent.set(key, new Date());
  return msg;
}

export async function reportMessage(messageId: string, reporterId: Types.ObjectId) {
  const msg = await RoomMessage.findById(messageId);
  if (!msg || msg.hidden) throw new HttpError(404, 'Message not found');
  if (msg.reportedBy.some((id) => id.equals(reporterId))) {
    return msg;
  }
  msg.reportedBy.push(reporterId);
  msg.reportCount = msg.reportedBy.length;
  if (msg.reportCount >= 5) msg.hidden = true;
  await msg.save();
  return msg;
}

export async function agreeMessage(messageId: string, userId: Types.ObjectId) {
  const msg = await RoomMessage.findById(messageId);
  if (!msg || msg.hidden) throw new HttpError(404, 'Message not found');
  if (msg.agreedBy.some((id) => id.equals(userId))) return msg;
  msg.agreedBy.push(userId);
  msg.agreeCount = msg.agreedBy.length;
  await msg.save();
  return msg;
}

export async function moderationQueue() {
  return RoomMessage.find({ reportCount: { $gte: 1 } })
    .sort({ reportCount: -1, createdAt: -1 })
    .limit(100)
    .lean();
}
