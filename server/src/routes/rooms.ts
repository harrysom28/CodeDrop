import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { HttpError } from '../errors.js';
import { requireAdmin, requireUser } from '../middleware/auth.js';
import { Room, RoomBan, RoomMessage } from '../models/rooms.js';
import {
  agreeMessage,
  listRooms,
  moderationQueue,
  postMessage,
  reportMessage,
} from '../services/rooms.js';

export function roomsRouter() {
  const r = Router();

  r.get('/rooms', async (_req, res) => {
    res.json({ items: await listRooms() });
  });

  r.get('/rooms/:id/messages', async (req, res) => {
    if (!Types.ObjectId.isValid(req.params.id)) throw new HttpError(404, 'Room not found');
    const items = await RoomMessage.find({ roomId: req.params.id, hidden: { $ne: true } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ items: items.reverse() });
  });

  r.post('/rooms/:id/messages', requireUser, async (req, res) => {
    const roomId = String(req.params.id);
    const body = z
      .object({ text: z.string().max(500).optional(), pickId: z.string().optional() })
      .refine((v) => v.text || v.pickId, { message: 'Send text or pickId' })
      .parse(req.body);
    const msg = await postMessage({ roomId, userId: req.userId!, ...body });
    res.status(201).json(msg);
  });

  r.post('/rooms/messages/:id/report', requireUser, async (req, res) => {
    const msg = await reportMessage(String(req.params.id), req.userId!);
    res.json({ reportCount: msg.reportCount, hidden: msg.hidden });
  });

  r.post('/rooms/messages/:id/agree', requireUser, async (req, res) => {
    const msg = await agreeMessage(String(req.params.id), req.userId!);
    res.json({ agreeCount: msg.agreeCount });
  });

  r.post('/rooms/:id/mute', requireUser, requireAdmin, async (req, res) => {
    const body = z
      .object({ userId: z.string(), minutes: z.number().int().min(1).max(7 * 24 * 60).default(60) })
      .parse(req.body);
    await RoomBan.updateOne(
      { roomId: req.params.id, userId: body.userId },
      { $set: { mutedUntil: new Date(Date.now() + body.minutes * 60_000) } },
      { upsert: true },
    );
    res.status(204).end();
  });

  r.post('/rooms/:id/ban', requireUser, requireAdmin, async (req, res) => {
    const body = z.object({ userId: z.string(), reason: z.string().max(200).optional() }).parse(req.body);
    await RoomBan.updateOne(
      { roomId: req.params.id, userId: body.userId },
      { $set: { banned: true, reason: body.reason } },
      { upsert: true },
    );
    res.status(204).end();
  });

  r.get('/admin/moderation', requireUser, requireAdmin, async (_req, res) => {
    res.json({ items: await moderationQueue() });
  });

  r.post('/admin/rooms/fixture', requireUser, requireAdmin, async (req, res) => {
    const body = z
      .object({
        fixtureId: z.string().min(1),
        title: z.string().min(1).max(120),
        kickoff: z.coerce.date(),
      })
      .parse(req.body);
    const opensAt = new Date(body.kickoff.getTime() - 60 * 60_000);
    const closesAt = new Date(body.kickoff.getTime() + 4 * 60 * 60_000); // ~2h after typical FT
    const room = await Room.findOneAndUpdate(
      { kind: 'fixture', key: body.fixtureId },
      { $set: { title: body.title, opensAt, closesAt, closed: false, slowModeMs: 5000 } },
      { upsert: true, new: true },
    );
    res.json(room);
  });

  return r;
}
