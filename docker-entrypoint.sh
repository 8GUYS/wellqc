#!/bin/sh
set -e

export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"
DB_HOST="postgres"
DB_USER="${POSTGRES_USER:-postgres}"
DB_NAME="${POSTGRES_DB:-main}"

echo "Waiting for postgres to accept connections..."
until pg_isready -h "$DB_HOST" -U "$DB_USER" > /dev/null 2>&1; do
  sleep 1
done

echo "Applying migrations..."
npx prisma migrate deploy --config prisma7.config.ts

# Only seed on a genuinely empty database, so restarting the container never
# re-seeds or duplicates rows on top of real work someone has done locally.
WELL_COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -tAc 'SELECT count(*) FROM "Well";' 2>/dev/null || echo "0")
if [ "$WELL_COUNT" = "0" ]; then
  echo "Empty database detected — seeding synthetic data..."
  npx prisma db seed --config prisma7.config.ts
else
  echo "Data already present ($WELL_COUNT wells), skipping seed."
fi

exec "$@"
