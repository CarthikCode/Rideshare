import { Router } from 'express';
import {
  createRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  incomingRequests,
  sentRequests,
  activeChats,
} from '../controllers/requestController.js';
import { asyncHandler as ah } from '../utils/asyncHandler.js';

export const requestRoutes = Router();

requestRoutes.post('/', ah(createRequest));
requestRoutes.get('/incoming', ah(incomingRequests));
requestRoutes.get('/sent', ah(sentRequests));
requestRoutes.get('/active-chats', ah(activeChats));
requestRoutes.post('/:id/accept', ah(acceptRequest));
requestRoutes.post('/:id/reject', ah(rejectRequest));
requestRoutes.post('/:id/cancel', ah(cancelRequest));
