// src/config/database.ts
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { hashPassword } from './auth.js';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// ✅ Settings from environment variables
// ============================================

const DB_PATH = process.env.DB_PATH || './database.sqlite';
const DEFAULT_ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD;
const DEFAULT_MUTASIM_PASSWORD = process.env.DEFAULT_MUTASIM_PASSWORD;

// ✅ Check for passwords in production
if (!DEFAULT_ADMIN_PASSWORD && process.env.NODE_ENV === 'production') {
  throw new Error('❌ DEFAULT_ADMIN_PASSWORD is required in production!');
}

// ============================================
// ✅ Singleton Database Connection
// ============================================

let dbInstance: any = null;

export const openDB = async () => {
  return open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });
};

export const getDB = async () => {
  if (!dbInstance) {
    dbInstance = await openDB();
    
    // ✅ Performance optimizations
    await dbInstance.exec('PRAGMA journal_mode = WAL;');
    await dbInstance.exec('PRAGMA synchronous = NORMAL;');
    await dbInstance.exec('PRAGMA cache_size = -20000;'); // 20MB cache
    await dbInstance.exec('PRAGMA encoding = "UTF-8";');
    
    console.log('✅ Database connection established');
  }
  return dbInstance;
};

// ============================================
// ✅ Helper function to safely create users
// ============================================

const ensureUser = async (
  db: any,
  username: string,
  fullName: string,
  email: string,
  password: string,
  role: string = 'user'
) => {
  // Check if password is set
  if (!password || password === 'change-me-now') {
    console.warn(`⚠️ Skipping user ${username} - password not set in .env`);
    return;
  }

  // Check if user exists
  const existing = await db.get(
    'SELECT id FROM users WHERE username = ? OR email = ?',
    [username, email]
  );

  if (!existing) {
    const hashedPassword = await hashPassword(password);
    await db.run(
      `INSERT INTO users (username, password, full_name, email, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, fullName, email, role, 1]
    );
    console.log(`✅ Created user: ${username} (${role})`);
  } else {
    console.log(`✅ User already exists: ${username}`);
  }
};

// ============================================
// ✅ Initialize Database
// ============================================

export const initDB = async () => {
  try {
    const db = await getDB();

    // ============================================
    // 📊 Create Tables
    // ============================================

    // 1. Users table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'user',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        last_login TEXT,
        reset_token TEXT,
        reset_token_expires TEXT,
        deleted_at TEXT
      )
    `);

    // 2. Purchases table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_number TEXT UNIQUE NOT NULL,
        date TEXT NOT NULL,
        requester TEXT NOT NULL,
        description TEXT NOT NULL,
        receiver TEXT NOT NULL,
        delivery_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'قيد التنفيذ',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        created_by INTEGER,
        assigned_to INTEGER,
        priority TEXT DEFAULT 'medium',
        department TEXT,
        FOREIGN KEY (created_by) REFERENCES users(id),
        FOREIGN KEY (assigned_to) REFERENCES users(id)
      )
    `);

    // 3. Audit log table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        username TEXT,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        changes TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // 4. Sessions table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        device_info TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 5. Token blacklist table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS token_blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        user_id INTEGER,
        expires_at TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 6. Password reset table
    await db.exec(`
      CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // ============================================
    // 🔍 Create Indexes for Performance
    // ============================================

    await db.exec(`
      -- User indexes
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

      -- Purchase indexes
      CREATE INDEX IF NOT EXISTS idx_purchases_request_number ON purchases(request_number);
      CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
      CREATE INDEX IF NOT EXISTS idx_purchases_deleted_at ON purchases(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
      CREATE INDEX IF NOT EXISTS idx_purchases_delivery_date ON purchases(delivery_date);
      CREATE INDEX IF NOT EXISTS idx_purchases_requester ON purchases(requester);

      -- Audit log indexes
      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

      -- Session indexes
      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

      -- Token blacklist indexes
      CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);
      CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);
    `);

    // ============================================
    // 🔧 Check for existing columns (for upgrades)
    // ============================================

    // ✅ Fixed: Added type 'any' to 'col' parameter
    const tableInfo = await db.all("PRAGMA table_info(purchases)");
    const hasNotes = tableInfo.some((col: any) => col.name === 'notes');

    if (!hasNotes) {
      await db.exec('ALTER TABLE purchases ADD COLUMN notes TEXT');
      console.log('✅ Added notes column to purchases table');
    }

    // ✅ Fixed: Added type 'any' to 'col' parameter
    const hasDeletedAt = tableInfo.some((col: any) => col.name === 'deleted_at');
    if (!hasDeletedAt) {
      await db.exec('ALTER TABLE purchases ADD COLUMN deleted_at TEXT');
      console.log('✅ Added deleted_at column to purchases table');
    }

    // Check for priority column
    const hasPriority = tableInfo.some((col: any) => col.name === 'priority');
    if (!hasPriority) {
      await db.exec('ALTER TABLE purchases ADD COLUMN priority TEXT DEFAULT "medium"');
      console.log('✅ Added priority column to purchases table');
    }

    // ============================================
    // 👤 Create default users (development only)
    // ============================================

    if (process.env.NODE_ENV !== 'production') {
      console.log('🛠️ Development mode: Creating default users...');

      // Create Admin user
      await ensureUser(
        db,
        'admin',
        'مدير النظام',
        'admin@example.com',
        DEFAULT_ADMIN_PASSWORD || 'Admin@2024#Secure!',
        'admin'
      );

      // Create Mutasim user
      await ensureUser(
        db,
        'mutasim',
        'مدير النظام',
        'mutasim41@gmail.com',
        DEFAULT_MUTASIM_PASSWORD || 'Asmo@1985#Strong!',
        'admin'
      );

      // Create Demo user
      await ensureUser(
        db,
        'demo',
        'مستخدم تجريبي',
        'demo@example.com',
        'Demo@2024#Test!',
        'user'
      );

      console.log('✅ Default users created successfully');
    } else {
      console.log('🔒 Production mode: Skipping default user creation');
    }

    // ============================================
    // 🧹 Clean up expired tokens
    // ============================================

    await db.run(`
      DELETE FROM sessions WHERE expires_at < datetime('now')
    `);

    await db.run(`
      DELETE FROM token_blacklist WHERE expires_at < datetime('now')
    `);

    await db.run(`
      DELETE FROM password_resets WHERE expires_at < datetime('now') OR used = 1
    `);

    console.log('✅ Database initialized successfully');
    return db;

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};

// ============================================
// 🧹 Cleanup old logs
// ============================================

export const cleanupOldLogs = async (daysToKeep: number = 365) => {
  try {
    const db = await getDB();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const result = await db.run(
      'DELETE FROM audit_log WHERE created_at < ?',
      [cutoffDate.toISOString()]
    );

    console.log(`🧹 Cleaned up ${result.changes} old audit logs`);
    return result.changes;
  } catch (error) {
    console.error('❌ Error cleaning up audit logs:', error);
    throw error;
  }
};

// ============================================
// 📊 Get database statistics
// ============================================

export const getDBStats = async () => {
  try {
    const db = await getDB();

    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    const purchaseCount = await db.get('SELECT COUNT(*) as count FROM purchases WHERE deleted_at IS NULL');
    const auditCount = await db.get('SELECT COUNT(*) as count FROM audit_log');
    const sessionCount = await db.get('SELECT COUNT(*) as count FROM sessions WHERE is_active = 1');

    const dbSize = await db.get(`
      SELECT 
        (page_count * page_size) / 1024 / 1024 as size_mb
      FROM pragma_page_count(), pragma_page_size()
    `);

    return {
      users: userCount.count,
      purchases: purchaseCount.count,
      auditLogs: auditCount.count,
      activeSessions: sessionCount.count,
      databaseSize: `${Math.round(dbSize?.size_mb || 0)} MB`
    };
  } catch (error) {
    console.error('❌ Error getting DB stats:', error);
    return null;
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
    const db = await getDB();

    await db.exec('DROP TABLE IF EXISTS purchases');
    await db.exec('DROP TABLE IF EXISTS users');
    await db.exec('DROP TABLE IF EXISTS audit_log');
    await db.exec('DROP TABLE IF EXISTS sessions');
    await db.exec('DROP TABLE IF EXISTS token_blacklist');
    await db.exec('DROP TABLE IF EXISTS password_resets');

    dbInstance = null;
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
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
    console.log('✅ Database connection closed');
  }
};

// ============================================
// 📝 Export all functions
// ============================================

export default {
  getDB,
  initDB,
  closeDB,
  resetDatabase,
  cleanupOldLogs,
  getDBStats
};