import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { settings } from './config/settings.js';
import { authRoutes } from './routes/authRoutes.js';
import { geoRoutes } from './routes/geoRoutes.js';
import { rideRoutes } from './routes/rideRoutes.js';
import { requestRoutes } from './routes/requestRoutes.js';
import { userRoutes } from './routes/userRoutes.js';
import { messageRoutes } from './routes/messageRoutes.js';
import { requireAuth } from './middleware/authMiddleware.js';
import { apiNotFound, errorHandler } from './middleware/errorMiddleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

    app.use(
    helmet({
      contentSecurityPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    })
  );

  const allowedOrigins = new Set([
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    ...settings.clientOrigins,
  ]);
  app.use(
    cors({
      origin(origin, cb) {
        if (!origin) return cb(null, true);
        if (allowedOrigins.has(origin)) return cb(null, true);
        cb(null, false);
      },
    })
  );

  app.use(express.json({ limit: '200kb' }));

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts, please try again later' },
  });
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please slow down' },
  });

  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.use('/api/auth', authLimiter, authRoutes);
  app.use('/api', apiLimiter);
  app.use('/api/geo', requireAuth, geoRoutes);
  app.use('/api/rides', requireAuth, rideRoutes);
  app.use('/api/requests', requireAuth, requestRoutes);
  app.use('/api/users', requireAuth, userRoutes);
  app.use('/api/requests', requireAuth, messageRoutes);
  app.use('/api', apiNotFound);

  const frontendDir = path.join(__dirname, '..', 'frontend');
  if (fs.existsSync(frontendDir)) {
    app.use(express.static(frontendDir));
    app.get('*', (req, res) => res.sendFile(path.join(frontendDir, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
