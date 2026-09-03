#!/bin/sh
# Migrations run BEFORE the server accepts traffic, never from inside the app.
# A failed migration must stop the rollout rather than start a server against a
# schema it does not understand.
set -e

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "==> applying database migrations"
  pnpm exec prisma migrate deploy
fi

echo "==> starting API"
exec "$@"
