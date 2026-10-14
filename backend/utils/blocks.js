import { prisma } from '../config/db.js';

export async function isBlockedEitherWay(userA, userB) {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: userA, blockedId: userB },
        { blockerId: userB, blockedId: userA },
      ],
    },
    select: { id: true },
  });
  return Boolean(block);
}

export async function blockedUserIds(userId) {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
  });
  const ids = new Set();
  for (const b of blocks) {
    if (b.blockerId !== userId) ids.add(b.blockerId);
    if (b.blockedId !== userId) ids.add(b.blockedId);
  }
  return ids;
}
