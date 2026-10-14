import { prisma } from '../config/db.js';
import { displayName } from '../utils/users.js';
import { isBlockedEitherWay } from '../utils/blocks.js';
import { HttpError } from '../utils/asyncHandler.js';
import { requestDTO } from './requestController.js';

export async function getMessages(req, res) {
  const rq = await prisma.joinRequest.findUnique({
    where: { id: req.params.id },
    include: { requester: true, ride: { include: { owner: true } } },
  });
  if (!rq) throw new HttpError(404, 'Chat not found');
  if (rq.requesterId !== req.userId && rq.ride.ownerId !== req.userId) {
    throw new HttpError(403, 'You are not part of this chat');
  }
  const other = rq.requesterId === req.userId ? rq.ride.owner : rq.requester;
  const blocked = await isBlockedEitherWay(req.userId, other.id);
  const messages = await prisma.message.findMany({
    where: { requestId: rq.id },
    orderBy: { createdAt: 'asc' },
    take: 300,
    include: { sender: true },
  });
  res.json({
    request: requestDTO(rq),
    otherParty: { id: other.id, displayName: displayName(other.name) },
    blocked,
    meId: req.userId,
    messages: messages.map((m) => ({
      id: m.id,
      requestId: m.requestId,
      body: m.body,
      createdAt: m.createdAt,
      sender: { id: m.senderId, displayName: displayName(m.sender.name) },
    })),
  });
}
