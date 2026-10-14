import { Router } from 'express';
import { search, reverse } from '../controllers/geoController.js';
import { asyncHandler as ah } from '../utils/asyncHandler.js';

export const geoRoutes = Router();

geoRoutes.get('/search', ah(search));
geoRoutes.get('/reverse', ah(reverse));
