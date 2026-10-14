import { verifyToken } from '../utils/jwt.js';
import { prisma } from '../config/db.js';
import { isBlockedEitherWay } from '../utils/blocks.js';
import { displayName } from '../utils/users.js';

const MAX_MESSAGES_PER_10S = 8;

export function setupSockets(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const payload = verifyToken(token);
      socket.userId = payload.sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    const sentAt = [];

    const chatAccess = async (requestId) => {
      const rq = await prisma.joinRequest.findUnique({
        where: { id: requestId },
        include: { ride: true },
      });
      if (!rq || rq.status !== 'ACCEPTED') return null;
      if (rq.requesterId !== socket.userId && rq.ride.ownerId !== socket.userId) return null;
      const otherId = rq.requesterId === socket.userId ? rq.ride.ownerId : rq.requesterId;
      if (await isBlockedEitherWay(socket.userId, otherId)) return null;
      return rq;
    };

    socket.on('chat:join', async (payload, cb) => {
      try {
        const requestId = String(payload?.requestId || '');
        const rq = await chatAccess(requestId);
        if (!rq) return cb?.({ ok: false, error: 'Chat is not available' });
        socket.join(`request:${requestId}`);
        cb?.({ ok: true });
      } catch {
        cb?.({ ok: false, error: 'Chat is not available' });
      }
    });

    socket.on('chat:send', async (payload, cb) => {
      try {
        const requestId = String(payload?.requestId || '');
        const body = String(payload?.body ?? '').trim();
        if (!body || body.length > 1000) {
          return cb?.({ ok: false, error: 'Messages must be 1-1000 characters' });
        }
        const now = Date.now();
        while (sentAt.length && now - sentAt[0] > 10000) sentAt.shift();
        if (sentAt.length >= MAX_MESSAGES_PER_10S) {
          return cb?.({ ok: false, error: 'You are sending messages too fast' });
        }
        const rq = await chatAccess(requestId);
        if (!rq) return cb?.({ ok: false, error: 'Chat is not available' });
        sentAt.push(now);
        const msg = await prisma.message.create({
          data: { requestId, senderId: socket.userId, body },
          include: { sender: true },
        });
        io.to(`request:${requestId}`).emit('chat:message', {
          id: msg.id,
          requestId,
          body: msg.body,
          createdAt: msg.createdAt,
          sender: { id: msg.senderId, displayName: displayName(msg.sender.name) },
        });
        cb?.({ ok: true });
      } catch {
        cb?.({ ok: false, error: 'Could not send message' });
      }
    });
  });
}
