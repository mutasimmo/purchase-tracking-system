// src/migrations/index.ts
import { getSupabase } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Migration {
  version: number;
  name: string;
  up: (supabase: any) => Promise<void>;
  down: (supabase: any) => Promise<void>;
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
    
    const supabase = getSupabase();
    
    // ✅ إنشاء جدول سجل الترحيلات (باستخدام Supabase)
    try {
      await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS migrations (
            id SERIAL PRIMARY KEY,
            version INTEGER NOT NULL UNIQUE,
            name TEXT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `
      });
    } catch (error) {
      console.log('⚠️ Could not create migrations table (may already exist)');
    }
    
    // ✅ الحصول على آخر إصدار تم تطبيقه
    const { data: lastMigration, error } = await supabase
      .from('migrations')
      .select('version')
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const currentVersion = lastMigration?.version || 0;
    
    // ✅ تطبيق الترحيلات الجديدة
    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        console.log(`🔄 Applying migration ${migration.version}: ${migration.name}`);
        
        try {
          await migration.up(supabase);
          
          await supabase
            .from('migrations')
            .insert({
              version: migration.version,
              name: migration.name
            });
          
          console.log(`✅ Migration ${migration.version} applied successfully`);
        } catch (error) {
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

export default {
  runMigrations
};