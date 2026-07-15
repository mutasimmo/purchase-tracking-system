// src/config/database.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { hashPassword } from './auth.js';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// ✅ Supabase Configuration
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required!');
}

// ============================================
// ✅ Singleton Supabase Client
// ============================================

let supabaseInstance: SupabaseClient | null = null;

export const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(
      SUPABASE_URL!,
      SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
        // إعدادات إضافية للأداء
        global: {
          headers: {
            'x-application-name': 'purchase-backend',
          },
        },
      }
    );
    console.log('✅ Supabase client initialized');
  }
  return supabaseInstance;
};

// ============================================
// 🔄 تحويل الدوال القديمة للتوافق
// ============================================

// بديل لـ openDB و getDB (للتوافق مع الكود القديم)
export const openDB = async () => {
  return getSupabase();
};

export const getDB = async () => {
  return getSupabase();
};

// ============================================
// 🗄️ تهيئة قاعدة البيانات (إنشاء الجداول)
// ============================================

export const initDB = async () => {
  try {
    const supabase = getSupabase();

    console.log('🛠️ Creating tables in Supabase...');

    // ============================================
    // 1. Users table
    // ============================================
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id BIGSERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          full_name TEXT NOT NULL,
          email TEXT UNIQUE,
          role TEXT NOT NULL DEFAULT 'user',
          is_active INTEGER DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP,
          reset_token TEXT,
          reset_token_expires TIMESTAMP,
          deleted_at TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
        CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
      `
    });

    // ============================================
    // 2. Purchases table
    // ============================================
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS purchases (
          id BIGSERIAL PRIMARY KEY,
          request_number TEXT UNIQUE NOT NULL,
          date DATE NOT NULL,
          requester TEXT NOT NULL,
          invoice_owner TEXT,
          description TEXT NOT NULL,
          receiver TEXT NOT NULL,
          delivery_date DATE NOT NULL,
          status TEXT NOT NULL DEFAULT 'قيد التنفيذ',
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          deleted_at TIMESTAMP,
          created_by BIGINT REFERENCES users(id),
          assigned_to BIGINT REFERENCES users(id),
          priority TEXT DEFAULT 'medium',
          department TEXT
        );
        
        CREATE INDEX IF NOT EXISTS idx_purchases_request_number ON purchases(request_number);
        CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
        CREATE INDEX IF NOT EXISTS idx_purchases_deleted_at ON purchases(deleted_at);
        CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
        CREATE INDEX IF NOT EXISTS idx_purchases_delivery_date ON purchases(delivery_date);
        CREATE INDEX IF NOT EXISTS idx_purchases_requester ON purchases(requester);
        CREATE INDEX IF NOT EXISTS idx_purchases_invoice_owner ON purchases(invoice_owner);
      `
    });

    // ============================================
    // 3. Audit log table
    // ============================================
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS audit_log (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT REFERENCES users(id),
          username TEXT,
          action TEXT NOT NULL,
          entity_type TEXT NOT NULL,
          entity_id BIGINT,
          changes JSONB,
          ip_address TEXT,
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
        CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
        CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
      `
    });

    // ============================================
    // 4. Sessions table
    // ============================================
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS sessions (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL UNIQUE,
          device_info TEXT,
          ip_address TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP NOT NULL,
          is_active INTEGER DEFAULT 1
        );
        
        CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
        CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
      `
    });

    // ============================================
    // 5. Token blacklist
    // ============================================
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS token_blacklist (
          id BIGSERIAL PRIMARY KEY,
          token TEXT NOT NULL UNIQUE,
          user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);
        CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);
      `
    });

    // ============================================
    // 6. Password resets
    // ============================================
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS password_resets (
          id BIGSERIAL PRIMARY KEY,
          user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          used INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
      `
    });

    console.log('✅ Tables created successfully');

    // ============================================
    // 👤 Create default users
    // ============================================
    console.log('🛠️ Creating default users...');

    await createDefaultUsers(supabase);

    // ============================================
    // 🧹 Clean up expired tokens
    // ============================================
    await supabase.rpc('exec_sql', {
      sql: `
        DELETE FROM sessions WHERE expires_at < NOW();
        DELETE FROM token_blacklist WHERE expires_at < NOW();
        DELETE FROM password_resets WHERE expires_at < NOW() OR used = 1;
      `
    });

    console.log('✅ Database initialized successfully');
    return supabase;

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// ============================================
// 👤 Helper: Create users
// ============================================

const createDefaultUsers = async (supabase: SupabaseClient) => {
  const users = [
    {
      username: 'admin',
      full_name: 'مدير النظام',
      email: 'admin@example.com',
      password: process.env.DEFAULT_ADMIN_PASSWORD || 'Admin@2024#Secure!NEW',
      role: 'admin'
    },
    {
      username: 'mutasim',
      full_name: 'مدير النظام',
      email: 'mutasim41@gmail.com',
      password: 'asmo1985',
      role: 'admin'
    },
    {
      username: 'mazin',
      full_name: 'مدير النظام',
      email: 'mazin@example.com',
      password: 'mazin2026',
      role: 'admin'
    },
    {
      username: 'demo',
      full_name: 'مستخدم تجريبي',
      email: 'demo@example.com',
      password: 'Demo@2024#Test!',
      role: 'user'
    }
  ];

  for (const user of users) {
    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('username', user.username)
      .maybeSingle();

    if (!existing) {
      const hashedPassword = await hashPassword(user.password);
      await supabase
        .from('users')
        .insert({
          username: user.username,
          password: hashedPassword,
          full_name: user.full_name,
          email: user.email,
          role: user.role,
          is_active: 1
        });
      console.log(`✅ Created user: ${user.username}`);
    } else {
      console.log(`✅ User already exists: ${user.username}`);
    }
  }
};

// ============================================
// 📊 Get database stats
// ============================================

export const getDBStats = async () => {
  try {
    const supabase = getSupabase();

    const [users, purchases, audit, sessions] = await Promise.all([
      supabase.from('users').select('count', { count: 'exact', head: true }),
      supabase.from('purchases').select('count', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('audit_log').select('count', { count: 'exact', head: true }),
      supabase.from('sessions').select('count', { count: 'exact', head: true }).eq('is_active', 1),
    ]);

    return {
      users: users.count || 0,
      purchases: purchases.count || 0,
      auditLogs: audit.count || 0,
      activeSessions: sessions.count || 0,
      databaseSize: 'Managed by Supabase'
    };
  } catch (error) {
    console.error('❌ Error getting DB stats:', error);
    return null;
  }
};

// ============================================
// 🧹 Cleanup old logs
// ============================================

export const cleanupOldLogs = async (daysToKeep: number = 365) => {
  try {
    const supabase = getSupabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { data, error } = await supabase
      .from('audit_log')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) throw error;
    console.log(`🧹 Cleaned up old audit logs`);
    return data;
  } catch (error) {
    console.error('❌ Error cleaning up audit logs:', error);
    throw error;
  }
};

// ============================================
// 🔄 Reset database (for testing only)
// ============================================

export const resetDatabase = async () => {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('❌ Cannot reset database in production!');
  }

  try {
    const supabase = getSupabase();

    await supabase.rpc('exec_sql', {
      sql: `
        DROP TABLE IF EXISTS purchases CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
        DROP TABLE IF EXISTS audit_log CASCADE;
        DROP TABLE IF EXISTS sessions CASCADE;
        DROP TABLE IF EXISTS token_blacklist CASCADE;
        DROP TABLE IF EXISTS password_resets CASCADE;
      `
    });

    await initDB();
    console.log('✅ Database reset successfully');
    return true;
  } catch (error) {
    console.error('❌ Error resetting database:', error);
    throw error;
  }
};

// ============================================
// 🚪 Close database connection
// ============================================

export const closeDB = async () => {
  // Supabase client doesn't need explicit close
  supabaseInstance = null;
  console.log('✅ Supabase connection closed');
};

// ============================================
// 📝 Export all functions (توافق مع الكود القديم)
// ============================================

export default {
  getDB,
  initDB,
  closeDB,
  resetDatabase,
  cleanupOldLogs,
  getDBStats,
  getSupabase
};