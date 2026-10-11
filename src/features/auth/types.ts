/**
 * Auth Domain Types
 * Defines data contracts for authentication, authorization, and user profiles.
 *
 * EMAIL NORMALIZATION POLICY:
 * All user emails must be strictly normalized to lowercase and trimmed
 * before persistence and credential comparison:
 *   normalizedEmail = email.trim().toLowerCase()
 *
 * SECURITY POLICY:
 * Safe public user types explicitly exclude `passwordHash` to prevent accidental credential leakage.
 * Full Prisma model types with `passwordHash` remain internal to the database layer.
 */

export type UserRole = "ADMIN" | "STAFF" | "admin" | "staff";

/**
 * Safe public user representation for API/UI layers (never contains passwordHash).
 */
export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt: string | Date;
}

/**
 * Public User profile contract preserving backward compatibility.
 */
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt?: string;
  isActive?: boolean;
}

export interface AuthSession {
  userId: string;
  email: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
}

/**
 * Internal database user record (includes passwordHash for auth verification only).
 */
export interface UserDbRecord {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "ADMIN" | "STAFF";
  isActive: boolean;
  createdAt: Date | string;
}

/**
 * Result of credential authentication attempt.
 */
export type AuthResult =
  | {
      success: true;
      user: SafeUser;
      token: string;
    }
  | {
      success: false;
      error: string;
      retryAfterSeconds?: number;
    };

/**
 * Helper to normalize email addresses according to the documented system-wide policy.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

