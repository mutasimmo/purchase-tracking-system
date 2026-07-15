// src/repositories/user.repository.ts
import { getSupabase } from '../config/database.js';
import { hashPassword, comparePassword } from '../config/auth.js';
import { NotFoundError, ConflictError, ValidationError } from '../types/errors.js';
import logger from '../config/logger.js';

export interface User {
  id: number;
  username: string;
  password: string;
  full_name: string;
  email?: string;
  role: string;
  is_active: number;
  created_at: string;
  updated_at: string;
  last_login?: string;
  deleted_at?: string;
}

export interface UserCreate {
  username: string;
  password: string;
  full_name: string;
  email?: string;
  role?: string;
}

export interface UserUpdate {
  full_name?: string;
  email?: string;
  role?: string;
  is_active?: number;
  password?: string;
}

// ============================================
// 📌 User Repository
// ============================================

export const UserRepository = {
  // ✅ Find user by ID
  findById: async (id: number): Promise<User | null> => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('UserRepository.findById error:', error);
      throw error;
    }
  },

  // ✅ Find user by username
  findByUsername: async (username: string): Promise<User | null> => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('UserRepository.findByUsername error:', error);
      throw error;
    }
  },

  // ✅ Find user by email
  findByEmail: async (email: string): Promise<User | null> => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('UserRepository.findByEmail error:', error);
      throw error;
    }
  },

  // ✅ Create new user
  create: async (userData: UserCreate): Promise<User> => {
    try {
      const supabase = getSupabase();

      // Check if username exists
      const existing = await UserRepository.findByUsername(userData.username);
      if (existing) {
        throw new ConflictError('Username already exists');
      }

      // Check if email exists
      if (userData.email && userData.email.trim() !== '') {
        const existingEmail = await UserRepository.findByEmail(userData.email);
        if (existingEmail) {
          throw new ConflictError('Email already exists');
        }
      }

      const hashedPassword = await hashPassword(userData.password);

      const { data, error } = await supabase
        .from('users')
        .insert({
          username: userData.username,
          password: hashedPassword,
          full_name: userData.full_name,
          email: userData.email && userData.email.trim() !== '' ? userData.email.trim() : null,
          role: userData.role || 'user',
          is_active: 1
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('UserRepository.create error:', error);
      throw error;
    }
  },

  // ✅ Update user (مع دعم البريد الإلكتروني الفارغ)
  update: async (id: number, updates: UserUpdate): Promise<User> => {
    try {
      const supabase = getSupabase();

      const existing = await UserRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('User not found');
      }

      // ✅ التحقق من البريد الإلكتروني فقط إذا كان موجوداً وغير فارغ
      if (updates.email && updates.email.trim() !== '') {
        const existingEmail = await supabase
          .from('users')
          .select('id')
          .eq('email', updates.email.trim())
          .neq('id', id)
          .is('deleted_at', null)
          .maybeSingle();

        if (existingEmail) {
          throw new ConflictError('Email already exists');
        }
      }

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.full_name) updateData.full_name = updates.full_name;
      
      // ✅ معالجة البريد الإلكتروني
      if (updates.email !== undefined) {
        updateData.email = updates.email && updates.email.trim() !== '' ? updates.email.trim() : null;
      }
      
      if (updates.role) updateData.role = updates.role;
      if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
      
      if (updates.password) {
        updateData.password = await hashPassword(updates.password);
      }

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('UserRepository.update error:', error);
      throw error;
    }
  },

  // ✅ Soft delete user
  delete: async (id: number): Promise<void> => {
    try {
      const supabase = getSupabase();

      const existing = await UserRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('User not found');
      }

      const { error } = await supabase
        .from('users')
        .update({
          deleted_at: new Date().toISOString(),
          is_active: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      logger.error('UserRepository.delete error:', error);
      throw error;
    }
  },

  // ✅ Get all users with pagination
  findAll: async (options: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
    isActive?: boolean;
  } = {}): Promise<{ data: User[]; total: number }> => {
    try {
      const supabase = getSupabase();
      const { page = 1, limit = 20, search, role, isActive } = options;
      const offset = (page - 1) * limit;

      let query = supabase
        .from('users')
        .select('*', { count: 'exact' })
        .is('deleted_at', null);

      if (search) {
        query = query.or(`username.ilike.%${search}%,full_name.ilike.%${search}%,email.ilike.%${search}%`);
      }

      if (role) {
        query = query.eq('role', role);
      }

      if (isActive !== undefined) {
        query = query.eq('is_active', isActive ? 1 : 0);
      }

      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], total: count || 0 };
    } catch (error) {
      logger.error('UserRepository.findAll error:', error);
      throw error;
    }
  },

  // ✅ Update last login
  updateLastLogin: async (id: number): Promise<void> => {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('users')
        .update({
          last_login: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      logger.error('UserRepository.updateLastLogin error:', error);
      throw error;
    }
  },

  // ✅ Get user with role (for auth)
  getUserWithRole: async (id: number): Promise<User | null> => {
    return UserRepository.findById(id);
  }
};

export default UserRepository;