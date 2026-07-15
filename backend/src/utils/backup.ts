// src/utils/backup.ts
import { getSupabase } from '../config/database.js';
import logger from '../config/logger.js';
import cron from 'node-cron';
import fs from 'fs';
import path from 'path';

// ============================================
// Supabase Backup (استخدام النسخ الاحتياطي المدمج في Supabase)
// ============================================

const BACKUP_DIR = './backups';
const MAX_BACKUPS = 10;

// ✅ التأكد من وجود مجلد النسخ الاحتياطي
export const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info(`✅ Created backup directory: ${BACKUP_DIR}`);
  }
};

// ✅ إنشاء نسخة احتياطية من البيانات (تصدير JSON)
export const createBackup = async (): Promise<string> => {
  try {
    ensureBackupDir();
    
    const supabase = getSupabase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `backup-${timestamp}.json`);
    
    // ✅ تصدير جميع الجداول
    const tables = ['users', 'purchases', 'audit_log', 'sessions', 'token_blacklist', 'password_resets'];
    const backupData: any = {};
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*');
      
      if (error) {
        logger.warn(`⚠️ Could not backup table ${table}:`, error.message);
        backupData[table] = [];
      } else {
        backupData[table] = data || [];
      }
    }
    
    backupData._metadata = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      tables: tables
    };
    
    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    logger.info(`✅ Backup created: ${backupPath}`);
    
    // ✅ حذف النسخ القديمة
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
      .sort();
    
    while (files.length > MAX_BACKUPS) {
      const oldest = files.shift();
      if (oldest) {
        const oldPath = path.join(BACKUP_DIR, oldest);
        fs.unlinkSync(oldPath);
        logger.info(`🗑️ Removed old backup: ${oldest}`);
      }
    }
    
    return backupPath;
  } catch (error) {
    logger.error('❌ Backup failed:', error);
    throw error;
  }
};

// ✅ استعادة من نسخة احتياطية
export const restoreBackup = async (backupFile: string): Promise<void> => {
  try {
    ensureBackupDir();
    
    const backupPath = path.join(BACKUP_DIR, backupFile);
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupFile}`);
    }
    
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
    const supabase = getSupabase();
    
    // ✅ استعادة البيانات (تحذير: سيتم استبدال البيانات الحالية)
    const tables = ['users', 'purchases', 'audit_log', 'sessions', 'token_blacklist', 'password_resets'];
    
    for (const table of tables) {
      if (backupData[table]) {
        // حذف البيانات الحالية
        await supabase.from(table).delete().neq('id', 0);
        
        // إدراج البيانات الجديدة
        if (backupData[table].length > 0) {
          const { error } = await supabase
            .from(table)
            .insert(backupData[table]);
          
          if (error) {
            logger.warn(`⚠️ Could not restore table ${table}:`, error.message);
          }
        }
      }
    }
    
    logger.info(`✅ Database restored from: ${backupFile}`);
  } catch (error) {
    logger.error('❌ Restore failed:', error);
    throw error;
  }
};

// ✅ قائمة النسخ الاحتياطية
export const listBackups = (): string[] => {
  ensureBackupDir();
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .sort()
    .reverse();
};

// ✅ جدولة النسخ الاحتياطي
export const scheduleBackup = () => {
  ensureBackupDir();
  
  // ✅ كل يوم في منتصف الليل
  cron.schedule('0 0 * * *', async () => {
    logger.info('🔄 Running scheduled backup...');
    try {
      await createBackup();
    } catch (error) {
      logger.error('❌ Scheduled backup failed:', error);
    }
  });
  
  // ✅ كل يوم أحد الساعة 3 صباحاً (نسخة أسبوعية)
  cron.schedule('0 3 * * 0', async () => {
    logger.info('🔄 Running weekly backup...');
    try {
      await createBackup();
    } catch (error) {
      logger.error('❌ Weekly backup failed:', error);
    }
  });
  
  logger.info('✅ Backup scheduler started');
  logger.info(`📁 Backup directory: ${BACKUP_DIR}`);
  logger.info(`📊 Max backups: ${MAX_BACKUPS}`);
  logger.info(`⏰ Schedule: Daily at midnight, Weekly on Sunday at 3am`);
};

// ✅ إنشاء نسخة احتياطية فورية
export const createManualBackup = async (): Promise<string> => {
  logger.info('🔄 Creating manual backup...');
  const backupPath = await createBackup();
  logger.info(`✅ Manual backup created: ${backupPath}`);
  return backupPath;
};

// ✅ حذف جميع النسخ الاحتياطية
export const clearBackups = (): void => {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'));
  
  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    fs.unlinkSync(filePath);
    logger.info(`🗑️ Removed backup: ${file}`);
  }
  
  logger.info(`✅ All backups cleared (${files.length} files)`);
};

// ✅ الحصول على حجم النسخ الاحتياطية
export const getBackupSize = (): number => {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'));
  
  let totalSize = 0;
  for (const file of files) {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    totalSize += stats.size;
  }
  
  return totalSize;
};

export default {
  createBackup,
  restoreBackup,
  listBackups,
  scheduleBackup,
  createManualBackup,
  clearBackups,
  getBackupSize,
  ensureBackupDir
};