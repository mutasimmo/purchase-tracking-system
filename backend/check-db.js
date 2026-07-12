// check-db.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const checkDB = async () => {
  try {
    const db = await open({
      filename: './database.sqlite',
      driver: sqlite3.Database
    });

    // عرض جميع المستخدمين مع كلمة المرور المشفرة
    const users = await db.all('SELECT id, username, password, role, is_active FROM users;');
    console.log('📊 Users in database:');
    console.table(users);

    await db.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

checkDB();