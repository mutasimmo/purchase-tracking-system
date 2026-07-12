// reset-password.js
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import bcrypt from 'bcryptjs';

const resetPassword = async () => {
  try {
    const db = await open({
      filename: './database.sqlite',
      driver: sqlite3.Database
    });

    // تشفير كلمة المرور الجديدة
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // تحديث كلمة المرور للمستخدم admin
    const result = await db.run(
      'UPDATE users SET password = ? WHERE username = ?',
      [hashedPassword, 'admin']
    );

    if (result.changes > 0) {
      console.log('✅ Password reset successfully!');
      console.log('📝 New password for admin: admin123');
    } else {
      console.log('❌ User not found!');
    }

    await db.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

resetPassword();