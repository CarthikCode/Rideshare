import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const rides = await prisma.ride.findMany({
    where: { status: { in: ['CANCELLED', 'EXPIRED'] } },
    select: { id: true },
  });
  const rideIds = rides.map((r) => r.id);

  const requests = await prisma.joinRequest.findMany({
    where: { rideId: { in: rideIds } },
    select: { id: true },
  });
  const requestIds = requests.map((r) => r.id);

  const messages = await prisma.message.deleteMany({ where: { requestId: { in: requestIds } } });
  const joins = await prisma.joinRequest.deleteMany({ where: { id: { in: requestIds } } });
  const removed = await prisma.ride.deleteMany({ where: { id: { in: rideIds } } });

  console.log(`Deleted ${removed.count} ride(s), ${joins.count} request(s), ${messages.count} message(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());