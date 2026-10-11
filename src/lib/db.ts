import "server-only";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Server-only database client configuration.
 *
 * Architecture Note:
 * Supabase is utilized purely as hosted PostgreSQL (via Supabase Session Pooler).
 * Direct Supabase Auth is not used; custom authentication with password hashing
 * and JWT HttpOnly cookies queries the database directly.
 *
 * Next.js Development Singleton:
 * In development, Next.js clears the Node.js module cache on HMR, which can lead to
 * connection pool exhaustion if new clients are repeatedly instantiated.
 * Storing the client and pool on globalThis prevents connection leaks.
 *
 * Connection Lifecycle Note:
 * Neither `new Pool()` nor `new PrismaClient()` opens a network socket connection
 * at module import time. Network connections are opened lazily on the first query.
 */

export const DATABASE_URL = process.env.DATABASE_URL;

export function isDatabaseConfigured(): boolean {
  return Boolean(
    DATABASE_URL &&
      DATABASE_URL !== "postgresql://user:password@host:port/database?sslmode=require"
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createDatabaseClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  const isLocal =
    connectionString?.includes("localhost") ||
    connectionString?.includes("127.0.0.1");

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      ssl: isLocal || !connectionString ? false : { rejectUnauthorized: false },
    });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pgPool = pool;
  }

  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const db: PrismaClient =
  globalForPrisma.prisma ?? createDatabaseClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

export const prisma = db;
export default db;
