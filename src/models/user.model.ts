export interface User {
  id?: number;
  username: string;
  password: string;
  full_name: string;
  email?: string;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserResponse {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  role: string;
  is_active: boolean;
  created_at?: string;
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
  role?: 'admin' | 'user' | 'viewer';
}