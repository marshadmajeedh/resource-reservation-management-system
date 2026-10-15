#!/bin/sh
set -e

# Safety Check: Prevent pointing container migrations or runtime to hosted Supabase
if [ -n "$DATABASE_URL" ]; then
  case "$DATABASE_URL" in
    *supabase.co*|*supabase.com*)
      echo "" >&2
      echo "[SECURITY ERROR] DATABASE_URL points to Supabase ($DATABASE_URL)." >&2
      echo "Docker Compose must not be connected to the hosted Supabase database to prevent accidental data modification." >&2
      echo "Please configure local PostgreSQL credentials in .env.docker." >&2
      echo "" >&2
      exit 1
      ;;
  esac
fi

# Dynamically and safely assemble DATABASE_URL if not provided
# Safely handles special characters in POSTGRES_USER and POSTGRES_PASSWORD via URL encoding
if [ -z "$DATABASE_URL" ]; then
  if [ -n "$POSTGRES_USER" ] && [ -n "$POSTGRES_PASSWORD" ] && [ -n "$POSTGRES_DB" ]; then
    DATABASE_URL=$(node -e '
      const user = encodeURIComponent(process.env.POSTGRES_USER || "postgres");
      const pass = encodeURIComponent(process.env.POSTGRES_PASSWORD || "");
      const host = process.env.POSTGRES_HOST || "db";
      const port = process.env.POSTGRES_PORT || "5432";
      const db = encodeURIComponent(process.env.POSTGRES_DB || "reservation_db");
      process.stdout.write(`postgresql://${user}:${pass}@${host}:${port}/${db}?sslmode=disable`);
    ')
    export DATABASE_URL
  fi
fi

export DATABASE_URL

exec "$@"
