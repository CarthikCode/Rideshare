import http from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { settings } from './config/settings.js';
import { prisma } from './config/db.js';
import { setupSockets } from './sockets/chatSocket.js';

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
app.set('io', io);
setupSockets(io);

async function expirePastRides() {
  try {
    const result = await prisma.ride.updateMany({
      where: { status: { in: ['ACTIVE', 'FULL'] }, departureAt: { lt: new Date() } },
      data: { status: 'EXPIRED' },
    });
    if (result.count > 0) console.log(`Expired ${result.count} past ride(s)`);
  } catch (err) {
    console.error('Housekeeping failed:', err.message);
  }
}

expirePastRides();
setInterval(expirePastRides, 10 * 60 * 1000);

server.listen(settings.port, () => {
  console.log(`RideShare server running at http://localhost:${settings.port}`);
});
