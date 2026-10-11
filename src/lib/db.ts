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

export function isDatabaseConfigured(): boolean {
  const url = process.env.DATABASE_URL;
  return Boolean(
    url &&
      url !== "postgresql://user:password@host:port/database?sslmode=require"
  );
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
  connectionString: string | undefined;
};

export function getDatabaseClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (
    globalForPrisma.prisma &&
    globalForPrisma.connectionString === connectionString
  ) {
    return globalForPrisma.prisma;
  }

  // If connection string changed, clean up previous pool
  if (
    globalForPrisma.pgPool &&
    globalForPrisma.connectionString !== connectionString
  ) {
    globalForPrisma.pgPool.end().catch(() => {});
    globalForPrisma.pgPool = undefined;
    globalForPrisma.prisma = undefined;
  }

  const isLocal =
    connectionString?.includes("localhost") ||
    connectionString?.includes("127.0.0.1");

  const pool =
    globalForPrisma.pgPool ??
    new Pool({
      connectionString,
      ssl: isLocal || !connectionString ? false : { rejectUnauthorized: false },
    });

  globalForPrisma.pgPool = pool;
  globalForPrisma.connectionString = connectionString;

  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });
  globalForPrisma.prisma = client;
  return client;
}

export async function disconnectDatabase(): Promise<void> {
  if (globalForPrisma.prisma) {
    await globalForPrisma.prisma.$disconnect().catch(() => {});
    globalForPrisma.prisma = undefined;
  }
  if (globalForPrisma.pgPool) {
    await globalForPrisma.pgPool.end().catch(() => {});
    globalForPrisma.pgPool = undefined;
  }
  globalForPrisma.connectionString = undefined;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getDatabaseClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

export const prisma = db;
export default db;
