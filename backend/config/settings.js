import 'dotenv/config';

const num = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const settings = {
  port: num(process.env.PORT, 5000),
  jwtSecret: process.env.JWT_SECRET || 'rideshare-dev-secret-change-me',
  matchRadiusMeters: num(process.env.MATCH_RADIUS_METERS, 100),
  matchTimeWindowMinutes: num(process.env.MATCH_TIME_WINDOW_MINUTES, 15),
  geocoderUserAgent:
    process.env.GEOCODER_USER_AGENT || 'RideShareDemo/1.0 (student demo project)',
  clientOrigins: (process.env.CLIENT_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};
