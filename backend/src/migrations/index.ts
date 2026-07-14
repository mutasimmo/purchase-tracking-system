// backend/src/migrations/index.ts
import { getDB } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Migration {
  version: number;
  name: string;
  up: (db: any) => Promise<void>;
  down: (db: any) => Promise<void>;
}

// ✅ تسجيل جميع الترحيلات
const migrations: Migration[] = [];

// ✅ تحميل الترحيلات من المجلد
const loadMigrations = async () => {
  const files = fs.readdirSync(__dirname)
    .filter(f => f.endsWith('.ts') && f !== 'index.ts');
  
  for (const file of files) {
    const migration = await import(`./${file}`);
    if (migration.default) {
      migrations.push(migration.default);
    }
  }
  
  // ترتيب حسب الإصدار
  migrations.sort((a, b) => a.version - b.version);
};

// ✅ تشغيل الترحيلات
export const runMigrations = async () => {
  try {
    await loadMigrations();
    
    const db = await getDB();
    
    // ✅ إنشاء جدول سجل الترحيلات
    await db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version INTEGER NOT NULL UNIQUE,
        name TEXT NOT NULL,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // ✅ الحصول على آخر إصدار تم تطبيقه
    const lastMigration = await db.get(
      'SELECT MAX(version) as version FROM migrations'
    );
    const currentVersion = lastMigration?.version || 0;
    
    // ✅ تطبيق الترحيلات الجديدة
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`🔄 Applying migration ${migration.version}: ${migration.name}`);
        
        // ✅ بدء المعاملة
        await db.run('BEGIN TRANSACTION');
        
        try {
          await migration.up(db);
          await db.run(
            'INSERT INTO migrations (version, name) VALUES (?, ?)',
            [migration.version, migration.name]
          );
          await db.run('COMMIT');
          console.log(`✅ Migration ${migration.version} applied successfully`);
        } catch (error) {
          await db.run('ROLLBACK');
          console.error(`❌ Migration ${migration.version} failed:`, error);
          throw error;
        }
      }
    }
    
    console.log('✅ All migrations completed');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};