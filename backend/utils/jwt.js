import jwt from 'jsonwebtoken';
import { settings } from '../config/settings.js';

export const signToken = (userId) =>
  jwt.sign({ sub: userId }, settings.jwtSecret, { expiresIn: '7d' });

export const verifyToken = (token) => jwt.verify(token, settings.jwtSecret);
