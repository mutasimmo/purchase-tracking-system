// backend/src/migrations/001_initial_schema.ts
import { Migration } from './index.js';

export default {
  version: 1,
  name: 'Initial schema',
  up: async (db: any) => {
    // ✅ Users table
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

    // ✅ Purchases table
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

    // ✅ Audit log table
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

    // ✅ Sessions table
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

    // ✅ Token blacklist table
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

    // ✅ Password reset table
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

    // ✅ Create indexes
    await db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
      CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

      CREATE INDEX IF NOT EXISTS idx_purchases_request_number ON purchases(request_number);
      CREATE INDEX IF NOT EXISTS idx_purchases_status ON purchases(status);
      CREATE INDEX IF NOT EXISTS idx_purchases_deleted_at ON purchases(deleted_at);
      CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(date);
      CREATE INDEX IF NOT EXISTS idx_purchases_delivery_date ON purchases(delivery_date);
      CREATE INDEX IF NOT EXISTS idx_purchases_requester ON purchases(requester);

      CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_audit_log_entity_type ON audit_log(entity_type);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

      CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

      CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);
      CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires_at ON token_blacklist(expires_at);
    `);
  },
  down: async (db: any) => {
    await db.exec('DROP TABLE IF EXISTS password_resets');
    await db.exec('DROP TABLE IF EXISTS token_blacklist');
    await db.exec('DROP TABLE IF EXISTS sessions');
    await db.exec('DROP TABLE IF EXISTS audit_log');
    await db.exec('DROP TABLE IF EXISTS purchases');
    await db.exec('DROP TABLE IF EXISTS users');
  }
} as Migration;