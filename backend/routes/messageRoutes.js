import { Router } from 'express';
import { getMessages } from '../controllers/messageController.js';
import { asyncHandler as ah } from '../utils/asyncHandler.js';

export const messageRoutes = Router();

messageRoutes.get('/:id/messages', ah(getMessages));
