// backend/src/scripts/backup.ts
import fs from 'fs';
import path from 'path';

const backupDB = async () => {
  const source = './database.sqlite';
  const backupDir = './backups';
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir);
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dest = path.join(backupDir, `database-${timestamp}.sqlite`);
  
  fs.copyFileSync(source, dest);
  console.log(`✅ Backup created: ${dest}`);
};

// ✅ جدولة النسخ الاحتياطي يومياً
import cron from 'node-cron';
cron.schedule('0 0 * * *', backupDB);