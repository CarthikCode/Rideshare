# RideShare

A public carpooling web portal. People travelling the same way share a ride and split the cost.
Post a ride with pins on a map, get matched with riders heading the same way within 100 m and
15 minutes, send a join request, and chat privately once accepted.

**Stack:** HTML/CSS/JS (no framework, no build step) · Leaflet + OpenStreetMap + OSRM ·
Node.js + Express (ES modules) · PostgreSQL + Prisma 6 · Socket.io · JWT · zod · helmet.

---

## 1. Local setup (Windows + VS Code)

Prerequisites: Node.js 24 LTS, PostgreSQL with pgAdmin, Git, VS Code with the **Live Server** extension.

### 1.1 Create the database

Open pgAdmin, connect to your local server, right-click **Databases → Create → Database**, name it
`rideshare`. Or in the pgAdmin Query Tool / psql:

```sql
CREATE DATABASE rideshare;
```

### 1.2 Configure environment

In the `backend` folder, copy `.env.example` to `.env` and edit it:

```cmd
cd D:\RideShare\backend
copy .env.example .env
```

Set at least `DATABASE_URL` (your Postgres user/password) and `JWT_SECRET` (any long random string):

```
DATABASE_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/rideshare?schema=public
```

### 1.3 Install, migrate, seed, run

Run in `D:\RideShare\backend`:

```cmd
npm install
npx prisma migrate deploy
npm run seed
npm run dev
```

The backend starts on http://localhost:5000 (it also serves the frontend from `frontend/`).

### 1.4 Open the frontend

**Option A (recommended):** open http://localhost:5000 — the backend serves everything.

**Option B (Live Server):** right-click `frontend/index.html` in VS Code → "Open with Live Server"
(http://127.0.0.1:5500). `frontend/js/config.js` detects port 5500/5501 and points API calls to
port 5000 automatically.

### Demo logins (created by `npm run seed`)

- `demo1@example.com` / `password123`
- `demo2@example.com` / `password123`

Two seeded rides start ~50 m apart at tomorrow 09:00 IST (they match); a third ~6 km away does not.

---

## 2. Scripts (run in `backend/`)

| Command | Purpose |
|---|---|
| `npm run dev` | Start server with `node --watch` |
| `npm start` | Start server (production) |
| `npm run seed` | Seed demo users + rides |
| `npx prisma migrate deploy` | Apply committed migration |
| `npx prisma migrate dev` | Create a new migration after editing `schema.prisma` |
| `npx prisma studio` | Browse the database |

## 3. API overview

All endpoints except `/api/auth/*` and `/api/health` require `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register (name, email, password ≥ 8) |
| POST | `/api/auth/login` | Login → `{ token, user }` |
| GET/PATCH | `/api/users/me` | Read / update own profile |
| GET | `/api/users/me/blocks` | List blocked users |
| POST/DELETE | `/api/users/:id/block` | Block / unblock a user |
| POST | `/api/users/:id/report` | Report a user |
| GET | `/api/geo/search?q=` | Place search (Nominatim proxy, India only, cached, 1 req/s) |
| GET | `/api/geo/reverse?lat&lng` | Reverse geocode |
| POST | `/api/rides` | Post a ride (returns ride + instant matches) |
| GET | `/api/rides/search` | Smart matching: bounding box + Haversine, sorted by distance |
| GET | `/api/rides/mine` | Own rides |
| GET | `/api/rides/:id` | Ride details |
| POST | `/api/rides/:id/cancel` | Cancel ride (cancels its requests) |
| POST | `/api/requests` | Send join request |
| GET | `/api/requests/incoming` · `/sent` · `/active-chats` | Dashboard feeds |
| POST | `/api/requests/:id/accept` · `/reject` · `/cancel` | Request lifecycle |
| GET | `/api/requests/:id/messages` | Chat history (accepted requests only) |

Socket.io events: `chat:join`, `chat:send`, `chat:message`, plus `request:update` push notifications.

## 4. Deploy to Render (free) with a free Postgres

1. **Database:** create a free Postgres on [Neon](https://neon.tech) or Supabase. Copy the
   pooled connection string, e.g. `postgresql://user:pass@host/db?sslmode=require`.
2. **Push to GitHub** (see below).
3. On Render: **New → Web Service → connect the repo** → set **Root Directory** to the repo root and:
   - **Build Command:** `cd backend && npm install && npx prisma generate`
   - **Start Command:** `cd backend && npx prisma migrate deploy && node server.js`
   - **Environment variables:** `DATABASE_URL` (from step 1), `JWT_SECRET`,
     `CLIENT_ORIGINS` (your Render URL, e.g. `https://rideshare-xxxx.onrender.com`),
     `MATCH_RADIUS_METERS=100`, `MATCH_TIME_WINDOW_MINUTES=15`,
     `GEOCODER_USER_AGENT=RideShareDemo/1.0 (student demo project)`, `PORT` is set by Render automatically.
   - After the first deploy, open the Render **Shell** and run `cd backend && npm run seed`
     if you want the demo accounts.
   - WebSockets work on Render out of the box. Note: the free tier sleeps after ~15 minutes
     of inactivity, so the first request after idle can take ~30 seconds to wake.

## 5. First push to GitHub

In `D:\RideShare`:

```cmd
git init
git add .
git commit -m "RideShare: full-stack carpooling app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/rideshare.git
git push -u origin main
```

`.gitignore` already excludes `node_modules` and `.env` — never commit your `.env`.

## 6. Docker (optional)

```cmd
docker build -t rideshare .
docker run -p 5000:5000 rideshare
```

With no `DATABASE_URL` set, the container starts its own built-in PostgreSQL, applies the
migration and seeds the demo data automatically — zero setup. Pass
`-e DATABASE_URL=... -e JWT_SECRET=...` to use an external Postgres instead.
