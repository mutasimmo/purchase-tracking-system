// backend/src/migrations/003_add_deleted_at_to_users.ts
import { Migration } from './index.js';

export default {
  version: 3,
  name: 'Add deleted_at to users table',
  up: async (db: any) => {
    const tableInfo = await db.all("PRAGMA table_info(users)");
    const hasColumn = tableInfo.some((col: any) => col.name === 'deleted_at');
    
    if (!hasColumn) {
      await db.exec('ALTER TABLE users ADD COLUMN deleted_at TEXT');
      console.log('✅ Added deleted_at column to users table');
    }
  },
  down: async (db: any) => {
    console.log('⚠️ Cannot drop column in SQLite directly');
  }
} as Migration;