import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function tomorrowIST(hourIST) {
  const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const targetIstMs = Date.UTC(
    istNow.getUTCFullYear(),
    istNow.getUTCMonth(),
    istNow.getUTCDate() + 1,
    hourIST,
    0,
    0
  );
  return new Date(targetIstMs - IST_OFFSET_MS);
}

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const userOne = await prisma.user.upsert({
    where: { email: 'demo1@example.com' },
    update: {},
    create: { name: 'Demo User One', email: 'demo1@example.com', passwordHash },
  });
  const userTwo = await prisma.user.upsert({
    where: { email: 'demo2@example.com' },
    update: {},
    create: { name: 'Demo User Two', email: 'demo2@example.com', passwordHash },
  });

  const existing = await prisma.ride.count({
    where: { ownerId: { in: [userOne.id, userTwo.id] } },
  });
  if (existing > 0) {
    console.log('Demo rides already exist, skipping ride seeding.');
  } else {
    await prisma.ride.create({
      data: {
        ownerId: userOne.id,
        startLabel: 'MG Road, Bengaluru',
        startLat: 12.9716,
        startLng: 77.5946,
        endLabel: 'Koramangala, Bengaluru',
        endLat: 12.9352,
        endLng: 77.6245,
        departureAt: tomorrowIST(9),
        vehicleType: 'CAR',
        seatsTotal: 3,
        seatsAvailable: 3,
        note: 'Leaving on time. One small bag per person.',
      },
    });
    await prisma.ride.create({
      data: {
        ownerId: userTwo.id,
        startLabel: 'MG Road, Bengaluru (metro gate side)',
        startLat: 12.9719,
        startLng: 77.595,
        endLabel: 'Koramangala, Bengaluru (forum side)',
        endLat: 12.9355,
        endLng: 77.6248,
        departureAt: tomorrowIST(9),
        vehicleType: 'BIKE',
        seatsTotal: 1,
        seatsAvailable: 1,
        note: 'Pillion only, helmet provided.',
      },
    });
    await prisma.ride.create({
      data: {
        ownerId: userOne.id,
        startLabel: 'Yeshwanthpur, Bengaluru',
        startLat: 13.028,
        startLng: 77.5409,
        endLabel: 'Electronic City, Bengaluru',
        endLat: 12.8452,
        endLng: 77.6602,
        departureAt: tomorrowIST(18),
        vehicleType: 'SHARED_CAB',
        seatsTotal: 2,
        seatsAvailable: 2,
        note: 'Evening return trip.',
      },
    });
    console.log('Seeded 3 demo rides (two ~50 m apart that match, one ~6 km away that does not).');
  }

  console.log('\nDemo logins:');
  console.log('  demo1@example.com / password123');
  console.log('  demo2@example.com / password123\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
