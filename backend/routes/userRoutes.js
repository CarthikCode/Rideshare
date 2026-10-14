import { Router } from 'express';
import {
  getMe,
  updateMe,
  listBlocks,
  blockUser,
  unblockUser,
  reportUser,
} from '../controllers/userController.js';
import { asyncHandler as ah } from '../utils/asyncHandler.js';

export const userRoutes = Router();

userRoutes.get('/me', ah(getMe));
userRoutes.patch('/me', ah(updateMe));
userRoutes.get('/me/blocks', ah(listBlocks));
userRoutes.post('/:id/block', ah(blockUser));
userRoutes.delete('/:id/block', ah(unblockUser));
userRoutes.post('/:id/report', ah(reportUser));
