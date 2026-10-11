/**
 * Auth Domain Types
 * Defines data contracts for authentication, authorization, and user profiles.
 */

export type UserRole = "admin" | "staff";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
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
