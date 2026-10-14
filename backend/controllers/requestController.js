import { z } from 'zod';
import { prisma } from '../config/db.js';
import { displayName } from '../utils/users.js';
import { isBlockedEitherWay } from '../utils/blocks.js';
import { HttpError } from '../utils/asyncHandler.js';
import { rideDTO } from './rideController.js';

export const requestDTO = (rq) => ({
  id: rq.id,
  rideId: rq.rideId,
  requesterId: rq.requesterId,
  status: rq.status,
  createdAt: rq.createdAt,
  requester: rq.requester
    ? { id: rq.requester.id, displayName: displayName(rq.requester.name) }
    : undefined,
  ride: rq.ride ? rideDTO(rq.ride) : undefined,
});

const notify = (req, userId, payload) => {
  const io = req.app.get('io');
  io?.to(`user:${userId}`).emit('request:update', payload);
};

export async function createRequest(req, res) {
  const { rideId } = z.object({ rideId: z.string().uuid() }).parse(req.body);
  const ride = await prisma.ride.findUnique({ where: { id: rideId } });
  if (!ride || ride.status === 'CANCELLED' || ride.status === 'EXPIRED') {
    throw new HttpError(404, 'Ride not available');
  }
  if (ride.ownerId === req.userId) throw new HttpError(400, 'You cannot join your own ride');
  if (await isBlockedEitherWay(req.userId, ride.ownerId)) {
    throw new HttpError(403, 'You cannot request this ride');
  }
  if (ride.status !== 'ACTIVE' || ride.seatsAvailable <= 0) {
    throw new HttpError(400, 'No seats available on this ride');
  }
  if (ride.departureAt <= new Date()) throw new HttpError(400, 'This ride has already departed');
  const duplicate = await prisma.joinRequest.findFirst({
    where: { rideId, requesterId: req.userId, status: { in: ['PENDING', 'ACCEPTED'] } },
  });
  if (duplicate) throw new HttpError(409, 'You already have an active request for this ride');
  const request = await prisma.joinRequest.create({
    data: { rideId, requesterId: req.userId },
    include: { requester: true, ride: { include: { owner: true } } },
  });
  notify(req, ride.ownerId, { type: 'created', requestId: request.id, rideId });
  res.status(201).json({ request: requestDTO(request) });
}

export async function acceptRequest(req, res) {
  const result = await prisma.$transaction(async (tx) => {
    const rq = await tx.joinRequest.findUnique({
      where: { id: req.params.id },
      include: { ride: true },
    });
    if (!rq) throw new HttpError(404, 'Request not found');
    if (rq.ride.ownerId !== req.userId) throw new HttpError(403, 'This is not your ride');
    if (rq.status !== 'PENDING') throw new HttpError(400, 'Request is no longer pending');
    if (rq.ride.status !== 'ACTIVE' || rq.ride.seatsAvailable <= 0) {
      throw new HttpError(400, 'No seats available');
    }
    const seatsAvailable = rq.ride.seatsAvailable - 1;
    await tx.ride.update({
      where: { id: rq.rideId },
      data: { seatsAvailable, status: seatsAvailable === 0 ? 'FULL' : 'ACTIVE' },
    });
    return tx.joinRequest.update({
      where: { id: rq.id },
      data: { status: 'ACCEPTED' },
      include: { requester: true, ride: { include: { owner: true } } },
    });
  });
  notify(req, result.requesterId, { type: 'accepted', requestId: result.id, rideId: result.rideId });
  res.json({ request: requestDTO(result) });
}

export async function rejectRequest(req, res) {
  const rq = await prisma.joinRequest.findUnique({
    where: { id: req.params.id },
    include: { ride: true },
  });
  if (!rq) throw new HttpError(404, 'Request not found');
  if (rq.ride.ownerId !== req.userId) throw new HttpError(403, 'This is not your ride');
  if (rq.status !== 'PENDING') throw new HttpError(400, 'Request is no longer pending');
  const updated = await prisma.joinRequest.update({
    where: { id: rq.id },
    data: { status: 'REJECTED' },
    include: { requester: true, ride: { include: { owner: true } } },
  });
  notify(req, updated.requesterId, { type: 'rejected', requestId: updated.id, rideId: updated.rideId });
  res.json({ request: requestDTO(updated) });
}

export async function cancelRequest(req, res) {
  const updated = await prisma.$transaction(async (tx) => {
    const rq = await tx.joinRequest.findUnique({
      where: { id: req.params.id },
      include: { ride: true },
    });
    if (!rq) throw new HttpError(404, 'Request not found');
    if (rq.requesterId !== req.userId) throw new HttpError(403, 'This is not your request');
    if (rq.status !== 'PENDING' && rq.status !== 'ACCEPTED') {
      throw new HttpError(400, 'This request can no longer be cancelled');
    }
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
    return tx.joinRequest.update({
      where: { id: rq.id },
      data: { status: 'CANCELLED' },
      include: { requester: true, ride: { include: { owner: true } } },
    });
  });
  notify(req, updated.ride.ownerId, { type: 'cancelled', requestId: updated.id, rideId: updated.rideId });
  res.json({ request: requestDTO(updated) });
}

export async function incomingRequests(req, res) {
  const requests = await prisma.joinRequest.findMany({
    where: { ride: { ownerId: req.userId }, status: { in: ['PENDING', 'ACCEPTED'] } },
    orderBy: { createdAt: 'desc' },
    include: { requester: true, ride: { include: { owner: true } } },
  });
  res.json({ requests: requests.map(requestDTO) });
}

export async function sentRequests(req, res) {
  const requests = await prisma.joinRequest.findMany({
    where: { requesterId: req.userId },
    orderBy: { createdAt: 'desc' },
    include: { requester: true, ride: { include: { owner: true } } },
  });
  res.json({ requests: requests.map(requestDTO) });
}

export async function activeChats(req, res) {
  const requests = await prisma.joinRequest.findMany({
    where: {
      status: 'ACCEPTED',
      ride: { status: { in: ['ACTIVE', 'FULL'] } },
      OR: [{ requesterId: req.userId }, { ride: { ownerId: req.userId } }],
    },
    orderBy: { createdAt: 'desc' },
    include: { requester: true, ride: { include: { owner: true } } },
  });
  const chats = [];
  for (const rq of requests) {
    const otherId = rq.requesterId === req.userId ? rq.ride.ownerId : rq.requesterId;
    if (await isBlockedEitherWay(req.userId, otherId)) continue;
    const other = rq.requesterId === req.userId ? rq.ride.owner : rq.requester;
    chats.push({
      ...requestDTO(rq),
      otherParty: { id: other.id, displayName: displayName(other.name) },
    });
  }
  res.json({ chats });
}
