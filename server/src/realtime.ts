import type { Server as HttpServer } from 'node:http';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Server } from 'socket.io';
import { Types } from 'mongoose';
import { config } from './config.js';
import { postMessage } from './services/rooms.js';

/**
 * Attach Socket.IO to the HTTP server. Uses Redis adapter when REDIS_URL is set.
 */
export async function attachRealtime(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : true },
    path: '/socket.io',
  });

  if (config.REDIS_URL) {
    const pub = new Redis(config.REDIS_URL);
    const sub = pub.duplicate();
    io.adapter(createAdapter(pub, sub));
  }

  io.use((socket, next) => {
    const userId = (socket.handshake.auth?.userId ?? socket.handshake.headers['x-user-id']) as string | undefined;
    if (userId && Types.ObjectId.isValid(userId)) {
      socket.data.userId = new Types.ObjectId(userId);
    }
    next();
  });

  io.on('connection', (socket) => {
    socket.on('room:join', async (roomId: string) => {
      if (typeof roomId !== 'string') return;
      await socket.join(`room:${roomId}`);
    });

    socket.on('room:leave', async (roomId: string) => {
      if (typeof roomId !== 'string') return;
      await socket.leave(`room:${roomId}`);
    });

    socket.on('room:message', async (payload: { roomId: string; text?: string; pickId?: string }, ack?) => {
      try {
        if (!socket.data.userId) throw new Error('Sign in required');
        const msg = await postMessage({
          roomId: payload.roomId,
          userId: socket.data.userId,
          text: payload.text,
          pickId: payload.pickId,
        });
        io.to(`room:${payload.roomId}`).emit('room:message', msg);
        ack?.({ ok: true, message: msg });
      } catch (err) {
        ack?.({ ok: false, error: (err as Error).message });
      }
    });
  });

  return io;
}
