import { Router } from 'express';
import {
  createRide,
  searchRides,
  myRides,
  getRide,
  cancelRide,
  clearCancelledRides,
} from '../controllers/rideController.js';
import { asyncHandler as ah } from '../utils/asyncHandler.js';

export const rideRoutes = Router();

rideRoutes.post('/', ah(createRide));
rideRoutes.get('/mine', ah(myRides));
rideRoutes.get('/search', ah(searchRides));
rideRoutes.post('/clear-cancelled', ah(clearCancelledRides));
rideRoutes.get('/:id', ah(getRide));
rideRoutes.post('/:id/cancel', ah(cancelRide));
