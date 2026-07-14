// backend/src/migrations/002_add_invoice_owner.ts
import { Migration } from './index.js';

export default {
  version: 2,
  name: 'Add invoice_owner column to purchases',
  up: async (db: any) => {
    // ✅ التحقق من وجود العمود قبل الإضافة
    const tableInfo = await db.all("PRAGMA table_info(purchases)");
    const hasColumn = tableInfo.some((col: any) => col.name === 'invoice_owner');
    
    if (!hasColumn) {
      await db.exec('ALTER TABLE purchases ADD COLUMN invoice_owner TEXT');
      console.log('✅ Added invoice_owner column to purchases table');
      
      // ✅ إنشاء فهرس للعمود الجديد
      await db.exec('CREATE INDEX IF NOT EXISTS idx_purchases_invoice_owner ON purchases(invoice_owner)');
      console.log('✅ Created index for invoice_owner');
    } else {
      console.log('ℹ️ invoice_owner column already exists');
    }
  },
  down: async (db: any) => {
    // SQLite لا يدعم DROP COLUMN مباشرة
    // الحل: إنشاء جدول جديد بدون العمود ونقل البيانات
    console.log('⚠️ Cannot drop column in SQLite directly');
    console.log('ℹ️ To revert, create a new table without the column');
  }
} as Migration;