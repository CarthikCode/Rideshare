import { FARE_PER_KM } from './config.js';

const EARTH_RADIUS_KM = 6371;
const toRad = (d) => (d * Math.PI) / 180;

export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function estimateFare(distanceKm, vehicleType, riders) {
  const rate = FARE_PER_KM[vehicleType] ?? 12;
  const total = Math.round(distanceKm * rate);
  const count = Math.max(1, riders);
  return { total, perPerson: Math.round(total / count), riders: count, rate };
}
