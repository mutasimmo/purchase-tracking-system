import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initDB } from './database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = '7d';

export const hashPassword = async (password: string): Promise<string> => {
  return await bcrypt.hash(password, 10);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateToken = (userId: number, username: string, role: string = 'user'): string => {
  return jwt.sign(
    { id: userId, username, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

export const verifyToken = (token: string): any => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded;
  } catch (error) {
    return null;
  }
};

export const getTokenFromCookie = (req: any): string | null => {
  return req.cookies?.token || null;
};

// دالة للحصول على المستخدم الكامل مع الـ role من قاعدة البيانات
export const getUserWithRole = async (userId: number) => {
  try {
    const db = await initDB();
    const user = await db.get(
      'SELECT id, username, full_name, email, role, is_active FROM users WHERE id = ?',
      [userId]
    );
    return user;
  } catch (error) {
    console.error('❌ Error getting user with role:', error);
    return null;
  }
};