/**
 * Database client configuration placeholder.
 *
 * Architecture Note:
 * Supabase is utilized purely as hosted PostgreSQL (via Supabase Session Pooler).
 * Direct Supabase Auth is not used; custom authentication with password hashing
 * and JWT HttpOnly cookies will query the database directly.
 *
 * Database connection will be implemented in the database setup task.
 */

export const DATABASE_URL = process.env.DATABASE_URL;

export function isDatabaseConfigured(): boolean {
  return Boolean(DATABASE_URL && DATABASE_URL !== "postgresql://user:password@host:port/database?sslmode=require");
}
