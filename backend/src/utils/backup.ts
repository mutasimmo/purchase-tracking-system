// backend/src/utils/backup.ts
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import logger from '../config/logger.js';

const DB_PATH = process.env.DB_PATH || './database.sqlite';
const BACKUP_DIR = './backups';
const MAX_BACKUPS = 10;

// ✅ التأكد من وجود مجلد النسخ الاحتياطي
export const ensureBackupDir = () => {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    logger.info(`✅ Created backup directory: ${BACKUP_DIR}`);
  }
};

// ✅ إنشاء نسخة احتياطية
export const createBackup = async (): Promise<string> => {
  try {
    ensureBackupDir();
    
    // ✅ التحقق من وجود قاعدة البيانات
    if (!fs.existsSync(DB_PATH)) {
      throw new Error(`Database file not found: ${DB_PATH}`);
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(BACKUP_DIR, `database-${timestamp}.sqlite`);
    
    // ✅ نسخ الملف
    fs.copyFileSync(DB_PATH, backupPath);
    logger.info(`✅ Backup created: ${backupPath}`);
    
    // ✅ حذف النسخ القديمة
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('database-') && f.endsWith('.sqlite'))
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
    
    // ✅ نسخ الملف
    fs.copyFileSync(backupPath, DB_PATH);
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
    .filter(f => f.startsWith('database-') && f.endsWith('.sqlite'))
    .sort()
    .reverse();
};

// ✅ جدولة النسخ الاحتياطي
export const scheduleBackup = () => {
  // ✅ التأكد من وجود المجلد
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
      const backupPath = await createBackup();
      // ✅ إضافة علامة أسبوعي
      const weeklyPath = backupPath.replace('database-', 'database-weekly-');
      fs.copyFileSync(backupPath, weeklyPath);
      logger.info(`✅ Weekly backup created: ${weeklyPath}`);
    } catch (error) {
      logger.error('❌ Weekly backup failed:', error);
    }
  });
  
  // ✅ كل 6 ساعات (نسخة سريعة)
  cron.schedule('0 */6 * * *', async () => {
    logger.info('🔄 Running 6-hour backup...');
    try {
      await createBackup();
    } catch (error) {
      logger.error('❌ 6-hour backup failed:', error);
    }
  });
  
  logger.info('✅ Backup scheduler started');
  logger.info(`📁 Backup directory: ${BACKUP_DIR}`);
  logger.info(`📊 Max backups: ${MAX_BACKUPS}`);
  logger.info(`⏰ Schedule: Daily at midnight, Weekly on Sunday at 3am, Every 6 hours`);
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
    .filter(f => f.startsWith('database-') && f.endsWith('.sqlite'));
  
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
    .filter(f => f.startsWith('database-') && f.endsWith('.sqlite'));
  
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