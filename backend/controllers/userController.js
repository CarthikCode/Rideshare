import { z } from 'zod';
import { prisma } from '../config/db.js';
import { displayName } from '../utils/users.js';
import { HttpError } from '../utils/asyncHandler.js';

export async function getMe(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw new HttpError(404, 'User not found');
  res.json({ user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt } });
}

export async function updateMe(req, res) {
  const { name } = z
    .object({ name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60) })
    .parse(req.body);
  const user = await prisma.user.update({ where: { id: req.userId }, data: { name } });
  res.json({ user: { id: user.id, name: user.name, email: user.email, createdAt: user.createdAt } });
}

export async function listBlocks(req, res) {
  const blocks = await prisma.block.findMany({
    where: { blockerId: req.userId },
    orderBy: { createdAt: 'desc' },
    include: { blocked: true },
  });
  res.json({
    blocks: blocks.map((b) => ({
      id: b.id,
      createdAt: b.createdAt,
      user: { id: b.blocked.id, displayName: displayName(b.blocked.name) },
    })),
  });
}

async function cancelRequestsBetween(userA, userB) {
  const requests = await prisma.joinRequest.findMany({
    where: {
      status: { in: ['PENDING', 'ACCEPTED'] },
      OR: [
        { requesterId: userA, ride: { ownerId: userB } },
        { requesterId: userB, ride: { ownerId: userA } },
      ],
    },
    include: { ride: true },
  });
  for (const rq of requests) {
    await prisma.$transaction(async (tx) => {
      if (rq.status === 'ACCEPTED') {
        const seatsAvailable = Math.min(rq.ride.seatsTotal, rq.ride.seatsAvailable + 1);
        await tx.ride.update({
          where: { id: rq.rideId },
          data: {
            seatsAvailable,
            status: rq.ride.status === 'FULL' ? 'ACTIVE' : rq.ride.status,
          },
        });
      }
      await tx.joinRequest.update({ where: { id: rq.id }, data: { status: 'CANCELLED' } });
    });
  }
  return requests;
}

export async function blockUser(req, res) {
  const targetId = req.params.id;
  if (targetId === req.userId) throw new HttpError(400, 'You cannot block yourself');
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw new HttpError(404, 'User not found');
  await prisma.block.upsert({
    where: { blockerId_blockedId: { blockerId: req.userId, blockedId: targetId } },
    update: {},
    create: { blockerId: req.userId, blockedId: targetId },
  });
  const cancelled = await cancelRequestsBetween(req.userId, targetId);
  const io = req.app.get('io');
  for (const rq of cancelled) {
    io?.to(`user:${targetId}`).emit('request:update', { type: 'cancelled', requestId: rq.id, rideId: rq.rideId });
  }
  res.json({ ok: true });
}

export async function unblockUser(req, res) {
  await prisma.block.deleteMany({ where: { blockerId: req.userId, blockedId: req.params.id } });
  res.json({ ok: true });
}

export async function reportUser(req, res) {
  const { reason } = z
    .object({ reason: z.string().trim().min(3, 'Please give a short reason').max(500) })
    .parse(req.body);
  const targetId = req.params.id;
  if (targetId === req.userId) throw new HttpError(400, 'You cannot report yourself');
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw new HttpError(404, 'User not found');
  await prisma.report.create({
    data: { reporterId: req.userId, reportedId: targetId, reason },
  });
  res.status(201).json({ ok: true });
}
