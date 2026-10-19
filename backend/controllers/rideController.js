import { z } from 'zod';
import { prisma } from '../config/db.js';
import { settings } from '../config/settings.js';
import { haversineMeters, boundingBox } from '../utils/geo.js';
import { displayName } from '../utils/users.js';
import { blockedUserIds } from '../utils/blocks.js';
import { HttpError } from '../utils/asyncHandler.js';
import { requestDTO } from './requestController.js';

const VEHICLES = ['CAR', 'BIKE', 'AUTO', 'SHARED_CAB'];

export const rideDTO = (r, extra = {}) => ({
  id: r.id,
  ownerId: r.ownerId,
  startLabel: r.startLabel,
  startLat: r.startLat,
  startLng: r.startLng,
  endLabel: r.endLabel,
  endLat: r.endLat,
  endLng: r.endLng,
  departureAt: r.departureAt,
  vehicleType: r.vehicleType,
  seatsTotal: r.seatsTotal,
  seatsAvailable: r.seatsAvailable,
  note: r.note,
  status: r.status,
  createdAt: r.createdAt,
  owner: r.owner ? { id: r.owner.id, displayName: displayName(r.owner.name) } : undefined,
  ...extra,
});

const createSchema = z.object({
  startLabel: z.string().trim().min(1).max(200),
  startLat: z.number().min(-90).max(90),
  startLng: z.number().min(-180).max(180),
  endLabel: z.string().trim().min(1).max(200),
  endLat: z.number().min(-90).max(90),
  endLng: z.number().min(-180).max(180),
  departureAt: z.string().min(1).refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
  vehicleType: z.enum(VEHICLES),
  seatsTotal: z.number().int().min(1).max(6),
  note: z.string().trim().max(200).optional().nullable(),
});

export async function findMatches(userId, q) {
  const radius = settings.matchRadiusMeters;
  const windowMs = settings.matchTimeWindowMinutes * 60000;
  const t = new Date(q.departureAt);
  const startBox = boundingBox(q.startLat, q.startLng, radius);
  const endBox = boundingBox(q.endLat, q.endLng, radius);
  const now = new Date();

  const candidates = await prisma.ride.findMany({
    where: {
      status: 'ACTIVE',
      seatsAvailable: { gt: 0 },
      ownerId: { not: userId },
      departureAt: {
        gte: new Date(t.getTime() - windowMs),
        lte: new Date(t.getTime() + windowMs),
        gt: now,
      },
      startLat: { gte: startBox.minLat, lte: startBox.maxLat },
      startLng: { gte: startBox.minLng, lte: startBox.maxLng },
      endLat: { gte: endBox.minLat, lte: endBox.maxLat },
      endLng: { gte: endBox.minLng, lte: endBox.maxLng },
    },
    include: { owner: true },
  });

  const blocked = await blockedUserIds(userId);
  const matches = [];
  for (const ride of candidates) {
    if (blocked.has(ride.ownerId)) continue;
    const startDistance = haversineMeters(q.startLat, q.startLng, ride.startLat, ride.startLng);
    const endDistance = haversineMeters(q.endLat, q.endLng, ride.endLat, ride.endLng);
    if (startDistance <= radius && endDistance <= radius) {
      matches.push({ ride, startDistance, endDistance });
    }
  }
  matches.sort((a, b) => a.startDistance + a.endDistance - (b.startDistance + b.endDistance));
  return matches.map((m) =>
    rideDTO(m.ride, {
      startDistanceMeters: Math.round(m.startDistance),
      endDistanceMeters: Math.round(m.endDistance),
    })
  );
}

export async function createRide(req, res) {
  const data = createSchema.parse(req.body);
  const departureAt = new Date(data.departureAt);
  if (departureAt.getTime() <= Date.now()) {
    return res.status(400).json({ error: 'Departure time must be in the future' });
  }
  const ride = await prisma.ride.create({
    data: {
      ownerId: req.userId,
      startLabel: data.startLabel,
      startLat: data.startLat,
      startLng: data.startLng,
      endLabel: data.endLabel,
      endLat: data.endLat,
      endLng: data.endLng,
      departureAt,
      vehicleType: data.vehicleType,
      seatsTotal: data.seatsTotal,
      seatsAvailable: data.seatsTotal,
      note: data.note || null,
    },
    include: { owner: true },
  });
  const matches = await findMatches(req.userId, {
    startLat: data.startLat,
    startLng: data.startLng,
    endLat: data.endLat,
    endLng: data.endLng,
    departureAt,
  });
  res.status(201).json({ ride: rideDTO(ride), matches });
}

const searchSchema = z.object({
  startLat: z.coerce.number().min(-90).max(90),
  startLng: z.coerce.number().min(-180).max(180),
  endLat: z.coerce.number().min(-90).max(90),
  endLng: z.coerce.number().min(-180).max(180),
  departureAt: z.string().min(1).refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
});

export async function searchRides(req, res) {
  const q = searchSchema.parse(req.query);
  const rides = await findMatches(req.userId, q);
  res.json({ rides });
}

export async function myRides(req, res) {
  const rides = await prisma.ride.findMany({
    where: { ownerId: req.userId },
    orderBy: { departureAt: 'desc' },
    include: {
      owner: true,
      requests: { where: { status: 'PENDING' }, select: { id: true } },
    },
  });
  res.json({
    rides: rides.map((r) => rideDTO(r, { pendingRequests: r.requests.length })),
  });
}

export async function getRide(req, res) {
  const ride = await prisma.ride.findUnique({
    where: { id: req.params.id },
    include: {
      owner: true,
      requests: { include: { requester: true }, orderBy: { createdAt: 'desc' } },
    },
  });
  if (!ride) return res.status(404).json({ error: 'Ride not found' });
  const isOwner = ride.ownerId === req.userId;
  if (!isOwner) {
    const blocked = await blockedUserIds(req.userId);
    if (blocked.has(ride.ownerId)) return res.status(404).json({ error: 'Ride not found' });
  }
  const myRequest =
    ride.requests.find(
      (r) => r.requesterId === req.userId && (r.status === 'PENDING' || r.status === 'ACCEPTED')
    ) || null;
  const requests = isOwner
    ? ride.requests
        .filter((r) => r.status === 'PENDING' || r.status === 'ACCEPTED')
        .map(requestDTO)
    : undefined;
  res.json({
    ride: rideDTO(ride),
    isOwner,
    myRequest: myRequest ? requestDTO(myRequest) : null,
    requests,
  });
}

export async function cancelRide(req, res) {
  const ride = await prisma.ride.findUnique({ where: { id: req.params.id } });
  if (!ride) throw new HttpError(404, 'Ride not found');
  if (ride.ownerId !== req.userId) throw new HttpError(403, 'You can only cancel your own ride');
  if (ride.status === 'CANCELLED' || ride.status === 'EXPIRED') {
    throw new HttpError(400, `Ride is already ${ride.status.toLowerCase()}`);
  }
  const affected = await prisma.joinRequest.findMany({
    where: { rideId: ride.id, status: { in: ['PENDING', 'ACCEPTED'] } },
    select: { requesterId: true },
  });
  const [updated] = await prisma.$transaction([
    prisma.ride.update({ where: { id: ride.id }, data: { status: 'CANCELLED' }, include: { owner: true } }),
    prisma.joinRequest.updateMany({
      where: { rideId: ride.id, status: { in: ['PENDING', 'ACCEPTED'] } },
      data: { status: 'CANCELLED' },
    }),
  ]);
  const io = req.app.get('io');
  for (const r of affected) {
    io?.to(`user:${r.requesterId}`).emit('request:update', { type: 'ride-cancelled', rideId: ride.id });
  }
  res.json({ ride: rideDTO(updated) });
}


export async function clearCancelledRides(req, res) {
  const rides = await prisma.ride.findMany({
    where: { ownerId: req.userId, status: { in: ['CANCELLED', 'EXPIRED'] } },
    select: { id: true },
  });
  const rideIds = rides.map((r) => r.id);

  const requests = await prisma.joinRequest.findMany({
    where: {
      OR: [
        { rideId: { in: rideIds } },
        { requesterId: req.userId, status: 'CANCELLED' },
      ],
    },
    select: { id: true },
  });
  const requestIds = requests.map((r) => r.id);

  const [, removedRequests, removedRides] = await prisma.$transaction([
    prisma.message.deleteMany({ where: { requestId: { in: requestIds } } }),
    prisma.joinRequest.deleteMany({ where: { id: { in: requestIds } } }),
    prisma.ride.deleteMany({ where: { id: { in: rideIds } } }),
  ]);
  res.json({ deletedRides: removedRides.count, deletedRequests: removedRequests.count });
}