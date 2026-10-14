import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { asyncHandler as ah } from '../utils/asyncHandler.js';

export const authRoutes = Router();

authRoutes.post('/register', ah(register));
authRoutes.post('/login', ah(login));
