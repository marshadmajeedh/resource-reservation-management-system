/**
 * Resource Domain Types
 * Defines data contracts for office resources managed by Admins and reserved by Staff.
 */

export type ResourceType = "room" | "desk" | "equipment" | "vehicle";

export interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  capacity?: number;
  location?: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateResourceInput {
  name: string;
  type: ResourceType;
  capacity?: number;
  location?: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateResourceInput {
  name?: string;
  type?: ResourceType;
  capacity?: number;
  location?: string;
  description?: string;
  isActive?: boolean;
}
