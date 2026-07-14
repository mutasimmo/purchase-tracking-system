// check-purchases.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const checkPurchases = async () => {
  try {
    const db = await open({
      filename: './database.sqlite',
      driver: sqlite3.Database
    });

    // عرض عدد الطلبات
    const count = await db.get('SELECT COUNT(*) as total FROM purchases WHERE deleted_at IS NULL;');
    console.log(`📊 Total purchases: ${count.total}`);

    // عرض جميع الطلبات
    const purchases = await db.all('SELECT id, request_number, requester, status, deleted_at, created_at FROM purchases ORDER BY id DESC LIMIT 20;');
    console.log('📋 Purchases:');
    console.table(purchases);

    // عرض الطلبات المحذوفة
    const deleted = await db.all('SELECT id, request_number, deleted_at FROM purchases WHERE deleted_at IS NOT NULL;');
    if (deleted.length > 0) {
      console.log('🗑️ Deleted purchases:');
      console.table(deleted);
    } else {
      console.log('✅ No deleted purchases found');
    }

    await db.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

checkPurchases();