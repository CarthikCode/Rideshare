import { z } from 'zod';
import { settings } from '../config/settings.js';

const cache = new Map();
const TTL_SEARCH = 60 * 60 * 1000;
const TTL_REVERSE = 24 * 60 * 60 * 1000;
let lastNominatimCall = 0;

function readCache(key) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data;
  cache.delete(key);
  return null;
}

function writeCache(key, data, ttl) {
  if (cache.size > 500) cache.clear();
  cache.set(key, { data, expires: Date.now() + ttl });
}

async function throttle() {
  const wait = 1100 - (Date.now() - lastNominatimCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();
}

async function nominatim(path, params) {
  await throttle();
  const url = `https://nominatim.openstreetmap.org${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': settings.geocoderUserAgent, 'Accept-Language': 'en' },
  });
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
  return res.json();
}

export async function search(req, res) {
  const { q } = z.object({ q: z.string().trim().min(2).max(120) }).parse(req.query);
  const key = `s:${q.toLowerCase()}`;
  const cached = readCache(key);
  if (cached) return res.json({ results: cached });
  try {
    const raw = await nominatim('/search', {
      format: 'jsonv2',
      limit: '5',
      countrycodes: 'in',
      q,
    });
    const results = raw.map((r) => ({
      label: r.display_name,
      lat: Number(r.lat),
      lng: Number(r.lon),
    }));
    writeCache(key, results, TTL_SEARCH);
    res.json({ results });
  } catch {
    res.status(502).json({ error: 'Place search is unavailable right now' });
  }
}

export async function reverse(req, res) {
  const { lat, lng } = z
    .object({
      lat: z.coerce.number().min(-90).max(90),
      lng: z.coerce.number().min(-180).max(180),
    })
    .parse(req.query);
  const key = `r:${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = readCache(key);
  if (cached) return res.json(cached);
  try {
    const r = await nominatim('/reverse', {
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      zoom: '18',
    });
    const data = { label: r?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    writeCache(key, data, TTL_REVERSE);
    res.json(data);
  } catch {
    res.json({ label: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
  }
}
