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

export const openDB = async () => getSupabase();
export const getDB = async () => getSupabase();

// ============================================
// 🗄️ تهيئة قاعدة البيانات (النسخة النهائية)
// ============================================

export const initDB = async () => {
  try {
    const supabase = getSupabase();

    console.log('🛠️ Checking database...');

    // ============================================
    // التحقق من وجود الجداول
    // ============================================
    
    const { error: checkError } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (checkError && checkError.code === '42P01') {
      // الجدول غير موجود - نقوم بإنشائه باستخدام SQL مباشر عبر REST API
      console.log('📝 Creating tables...');
      
      // ملاحظة: هذه الطريقة تتطلب أن تكون دالة exec_sql موجودة في Supabase
      // قم بتشغيل هذا SQL مرة واحدة في Supabase SQL Editor:
      // CREATE OR REPLACE FUNCTION exec_sql(sql text) RETURNS void AS $$ BEGIN EXECUTE sql; END; $$ LANGUAGE plpgsql;
      
      const sql = getMigrationSQL();
      
      // تقسيم SQL إلى أجزاء صغيرة لتجنب مشاكل الحجم
      const statements = sql.split(';').filter(s => s.trim().length > 0);
      
      for (const statement of statements) {
        try {
          await supabase.rpc('exec_sql', { sql: statement + ';' });
        } catch (err) {
          console.warn('⚠️ Warning, statement may have failed:', statement.substring(0, 100));
        }
      }
      
      console.log('✅ Tables created successfully');
    } else if (checkError) {
      console.error('❌ Error checking tables:', checkError);
      throw checkError;
    }

    // ============================================
    // 👤 إنشاء المستخدمين الافتراضيين
    // ============================================
    
    await createDefaultUsers(supabase);

    // ============================================
    // 🧹 تنظيف البيانات القديمة
    // ============================================
    
    await cleanupExpiredData(supabase);

    console.log('✅ Database initialized successfully');
    return supabase;

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// ============================================
// 📝 SQL Migration
// ============================================

const getMigrationSQL = () => {
  return `
    -- ============================================
    -- 1. Users table
    -- ============================================
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
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

    -- ============================================
    -- 2. Purchases table
    -- ============================================
    CREATE TABLE IF NOT EXISTS purchases (
      id SERIAL PRIMARY KEY,
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
      created_by INTEGER REFERENCES users(id),
      assigned_to INTEGER REFERENCES users(id),
      priority TEXT DEFAULT 'medium',
      department TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_purchases_request_number ON purchases(request_number);
    CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
    CREATE INDEX IF NOT EXISTS idx_purchases_deleted_at ON purchases(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
    CREATE INDEX IF NOT EXISTS idx_purchases_delivery_date ON purchases(delivery_date);
    CREATE INDEX IF NOT EXISTS idx_purchases_requester ON purchases(requester);

    -- ============================================
    -- 3. Audit log table
    -- ============================================
    CREATE TABLE IF NOT EXISTS audit_log (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      username TEXT,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      changes JSONB,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

    -- ============================================
    -- 4. Sessions table
    -- ============================================
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

    -- ============================================
    -- 5. Token blacklist
    -- ============================================
    CREATE TABLE IF NOT EXISTS token_blacklist (
      id SERIAL PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);
    CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);

    -- ============================================
    -- 6. Password resets
    -- ============================================
    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMP NOT NULL,
      used INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
  `;
};

// ============================================
// 👤 Helper: Create default users
// ============================================

const createDefaultUsers = async (supabase: SupabaseClient) => {
  const defaultUsers = [
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

  for (const userData of defaultUsers) {
    try {
      // التحقق من وجود المستخدم
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('username', userData.username)
        .maybeSingle();

      if (!existing) {
        const hashedPassword = await hashPassword(userData.password);
        const { error } = await supabase
          .from('users')
          .insert({
            username: userData.username,
            password: hashedPassword,
            full_name: userData.full_name,
            email: userData.email,
            role: userData.role,
            is_active: 1
          });

        if (error) {
          console.error(`❌ Error creating user ${userData.username}:`, error.message);
        } else {
          console.log(`✅ Created user: ${userData.username}`);
        }
      } else {
        console.log(`ℹ️ User already exists: ${userData.username}`);
      }
    } catch (error) {
      console.error(`❌ Error processing user ${userData.username}:`, error);
    }
  }
};

// ============================================
// 🧹 Cleanup expired data
// ============================================

const cleanupExpiredData = async (supabase: SupabaseClient) => {
  try {
    const now = new Date().toISOString();
    
    await supabase
      .from('sessions')
      .delete()
      .lt('expires_at', now);

    await supabase
      .from('token_blacklist')
      .delete()
      .lt('expires_at', now);

    await supabase
      .from('password_resets')
      .delete()
      .lt('expires_at', now);

    console.log('🧹 Cleaned up expired data');
  } catch (error) {
    console.warn('⚠️ Error cleaning up expired data:', error);
  }
};

// ============================================
// 📊 Get database stats
// ============================================

export const getDBStats = async () => {
  try {
    const supabase = getSupabase();

    const [users, purchases, audit, sessions] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('purchases').select('*', { count: 'exact', head: true }).is('deleted_at', null),
      supabase.from('audit_log').select('*', { count: 'exact', head: true }),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('is_active', 1),
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
// 🚪 Close database connection
// ============================================

export const closeDB = async () => {
  supabaseInstance = null;
  console.log('✅ Supabase connection closed');
};

// ============================================
// 📝 Export
// ============================================

export default {
  getDB,
  initDB,
  closeDB,
  getDBStats,
  getSupabase
};