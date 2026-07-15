// src/models/user.model.ts

export interface User {
  id?: number;
  username: string;
  password: string;
  full_name: string;
  email?: string;
  role: 'admin' | 'user' | 'viewer' | 'manager' | 'super_admin';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  last_login?: string;
  deleted_at?: string;
}

export interface UserResponse {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  role: string;
  is_active: boolean;
  created_at?: string;
  last_login?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  full_name: string;
  email?: string;
  role?: 'admin' | 'user' | 'viewer' | 'manager';
}

export interface UpdateProfileRequest {
  full_name?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}