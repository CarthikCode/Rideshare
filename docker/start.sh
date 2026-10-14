#!/bin/sh
set -e

# If no external database is configured, start the built-in PostgreSQL
# so the demo works out of the box with zero setup.
if [ -z "$DATABASE_URL" ]; then
  echo "DATABASE_URL not set — starting built-in PostgreSQL"
  export PGDATA=/var/lib/postgresql/data
  mkdir -p "$PGDATA" /run/postgresql
  chown -R postgres:postgres "$PGDATA" /run/postgresql
  chmod 700 "$PGDATA"
  if [ ! -s "$PGDATA/PG_VERSION" ]; then
    su-exec postgres initdb -D "$PGDATA" --auth=trust --username=postgres > /dev/null
  fi
  su-exec postgres pg_ctl -D "$PGDATA" -l /var/lib/postgresql/logfile -w start
  su-exec postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='rideshare'" | grep -q 1 \
    || su-exec postgres createdb rideshare
  export DATABASE_URL="postgresql://postgres@localhost:5432/rideshare?schema=public"
fi

cd /app/backend
npx prisma migrate deploy
node prisma/seed.js || true
exec node server.js
