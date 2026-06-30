import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { hashPassword } from './auth.js';

export const openDB = async () => {
  return open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });
};

export const initDB = async () => {
  try {
    const db = await openDB();
    
    // إنشاء جدول purchases
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
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // إنشاء جدول users
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // ============================================
    // 🆕 إنشاء جدول سجل التتبع (Audit Log)
    // ============================================
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
    
    // التحقق من وجود عمود notes
    const tableInfo = await db.all("PRAGMA table_info(purchases)");
    const hasNotes = tableInfo.some(col => col.name === 'notes');
    
    if (!hasNotes) {
      await db.exec('ALTER TABLE purchases ADD COLUMN notes TEXT');
      console.log('✅ Added notes column to purchases table');
    }
    
    // إضافة مستخدم Admin افتراضي
    const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE username = ?', ['admin']);
    if (adminCount.count === 0) {
      const hashedPassword = await hashPassword('admin123');
      await db.run(
        `INSERT INTO users (username, password, full_name, email, role, is_active)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['admin', hashedPassword, 'مدير النظام', 'admin@example.com', 'admin', 1]
      );
      console.log('✅ Default admin user created (username: admin, password: admin123)');
    }
    
    // إضافة بيانات تجريبية
    const count = await db.get('SELECT COUNT(*) as count FROM purchases');
    if (count.count === 0) {
      await db.exec(`
        INSERT INTO purchases (request_number, date, requester, description, receiver, delivery_date, status, notes)
        VALUES 
          ('001', '2026-01-10', 'إدارة الموارد البشرية', 'توفير 50 كرسيًا مكتبيًا', 'مخزن الأثاث', '2026-01-20', 'قيد التنفيذ', 'تم التواصل مع المورد'),
          ('002', '2026-01-12', 'قسم تقنية المعلومات', 'صيانة 20 جهاز حاسوب', 'شركة الصيانة', '2026-01-18', 'منجز', 'تم الصيانة بنجاح'),
          ('003', '2026-01-15', 'إدارة الشؤون المالية', 'طباعة 1000 مطوية', 'مطبعة النخبة', '2026-01-25', 'معلق', 'في انتظار الموافقة المالية')
      `);
      console.log('✅ Added sample purchase data');
    }
    
    console.log('✅ Database initialized successfully');
    return db;
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
};