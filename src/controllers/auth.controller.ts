import { Request, Response } from 'express';
import { initDB } from '../config/database.js';
import { hashPassword, comparePassword, generateToken } from '../config/auth.js';
import type { LoginRequest, RegisterRequest } from '../models/user.model.js';
import { logActivity } from '../services/audit.service.js';

// ============================================
// المصادقة الأساسية
// ============================================

// تسجيل الدخول (مع تتبع)
export const login = async (req: Request, res: Response) => {
  try {
    const { username, password }: LoginRequest = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = await initDB();
    
    const user = await db.get(
      'SELECT * FROM users WHERE username = ? AND is_active = 1',
      [username]
    );
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // إنشاء token مع الـ role
    const token = generateToken(user.id, user.username, user.role);

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    // تسجيل في سجل التتبع
    await logActivity(
      user.id,
      user.username,
      'LOGIN',
      'user',
      user.id,
      null,
      req.ip,
      req.headers['user-agent']
    );

    const { password: _, ...userData } = user;
    res.json({
      success: true,
      user: userData,
      token
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
};

// تسجيل مستخدم جديد
export const register = async (req: Request, res: Response) => {
  try {
    const { username, password, full_name, email, role }: RegisterRequest = req.body;
    
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Username, password, and full name are required' });
    }

    const db = await initDB();
    
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await hashPassword(password);

    const result = await db.run(
      `INSERT INTO users (username, password, full_name, email, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        username,
        hashedPassword,
        full_name,
        email || null,
        role || 'user',
        1
      ]
    );

    const newUser = await db.get(
      'SELECT id, username, full_name, email, role, is_active, created_at FROM users WHERE id = ?',
      [result.lastID]
    );

    // تسجيل في سجل التتبع
    await logActivity(
      result.lastID,
      username,
      'CREATE',
      'user',
      result.lastID,
      newUser,
      req.ip,
      req.headers['user-agent']
    );

    res.status(201).json({
      success: true,
      user: newUser
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
};

// تسجيل الخروج (مع تتبع)
export const logout = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const username = (req as any).user?.username || 'unknown';
    
    // تسجيل في سجل التتبع
    await logActivity(
      userId,
      username,
      'LOGOUT',
      'user',
      userId,
      null,
      req.ip,
      req.headers['user-agent']
    );
    
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({ error: 'Logout failed' });
  }
};

// التحقق من المستخدم الحالي
export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await initDB();
    const user = await db.get(
      'SELECT id, username, full_name, email, role, is_active, created_at FROM users WHERE id = ? AND is_active = 1',
      [userId]
    );

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('❌ Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

// تغيير كلمة المرور
export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const db = await initDB();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const hashedPassword = await hashPassword(newPassword);
    await db.run(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, userId]
    );

    // تسجيل في سجل التتبع
    await logActivity(
      userId,
      user.username,
      'UPDATE',
      'user',
      userId,
      { action: 'password_changed' },
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
};

// تحديث معلومات المستخدم
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { full_name, email, role } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await initDB();
    
    await db.run(
      `UPDATE users SET 
        full_name = COALESCE(?, full_name),
        email = COALESCE(?, email),
        role = COALESCE(?, role),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [full_name, email, role, userId]
    );

    const updated = await db.get(
      'SELECT id, username, full_name, email, role, is_active, created_at FROM users WHERE id = ?',
      [userId]
    );

    // تسجيل في سجل التتبع
    await logActivity(
      userId,
      updated.username,
      'UPDATE',
      'user',
      userId,
      { full_name, email, role },
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, user: updated });
  } catch (error) {
    console.error('❌ Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// ============================================
// 🆕 دوال إدارة المستخدمين (للأدمن فقط)
// ============================================

// جلب جميع المستخدمين
export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    const users = await db.all(`
      SELECT id, username, full_name, email, role, is_active, created_at, updated_at 
      FROM users 
      ORDER BY created_at DESC
    `);
    
    res.json(users);
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

// جلب مستخدم محدد
export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await initDB();
    
    const user = await db.get(`
      SELECT id, username, full_name, email, role, is_active, created_at, updated_at 
      FROM users 
      WHERE id = ?
    `, [id]);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

// إنشاء مستخدم جديد (بواسطة الأدمن)
export const createUserByAdmin = async (req: Request, res: Response) => {
  try {
    const { username, password, full_name, email, role, is_active } = req.body;
    
    if (!username || !password || !full_name) {
      return res.status(400).json({ error: 'Username, password, and full name are required' });
    }

    const db = await initDB();
    
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await hashPassword(password);

    const result = await db.run(
      `INSERT INTO users (username, password, full_name, email, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        username,
        hashedPassword,
        full_name,
        email || null,
        role || 'user',
        is_active !== undefined ? (is_active ? 1 : 0) : 1
      ]
    );

    const newUser = await db.get(
      'SELECT id, username, full_name, email, role, is_active, created_at FROM users WHERE id = ?',
      [result.lastID]
    );

    // تسجيل في سجل التتبع
    const adminId = (req as any).user?.id;
    const adminName = (req as any).user?.username || 'admin';
    await logActivity(
      adminId,
      adminName,
      'CREATE',
      'user',
      result.lastID,
      newUser,
      req.ip,
      req.headers['user-agent']
    );

    res.status(201).json({
      success: true,
      user: newUser
    });
  } catch (error) {
    console.error('❌ Error creating user by admin:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// تحديث مستخدم (بواسطة الأدمن)
export const updateUserByAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { full_name, email, role, is_active, password } = req.body;
    
    const db = await initDB();
    
    // التحقق من وجود المستخدم
    const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // منع تغيير صلاحيات الأدمن الرئيسي
    if (existing.username === 'admin' && role && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot change admin role' });
    }

    let query = `
      UPDATE users SET 
        full_name = COALESCE(?, full_name),
        email = COALESCE(?, email),
        role = COALESCE(?, role),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
    `;
    const params: any[] = [full_name || null, email || null, role || null, is_active !== undefined ? (is_active ? 1 : 0) : null];

    // إذا تم إرسال كلمة مرور جديدة
    if (password && password.length >= 6) {
      const hashedPassword = await hashPassword(password);
      query += `, password = ?`;
      params.push(hashedPassword);
    }

    query += ` WHERE id = ?`;
    params.push(id);

    await db.run(query, params);

    const updated = await db.get(
      'SELECT id, username, full_name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    // تسجيل في سجل التتبع
    const adminId = (req as any).user?.id;
    const adminName = (req as any).user?.username || 'admin';
    await logActivity(
      adminId,
      adminName,
      'UPDATE',
      'user',
      parseInt(id),
      { old: existing, new: updated },
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      user: updated
    });
  } catch (error) {
    console.error('❌ Error updating user by admin:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};

// حذف مستخدم (بواسطة الأدمن)
export const deleteUserByAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const db = await initDB();
    
    // التحقق من وجود المستخدم
    const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    // منع حذف الأدمن الرئيسي
    if (existing.username === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin user' });
    }

    // تسجيل في سجل التتبع قبل الحذف
    const adminId = (req as any).user?.id;
    const adminName = (req as any).user?.username || 'admin';
    await logActivity(
      adminId,
      adminName,
      'DELETE',
      'user',
      parseInt(id),
      existing,
      req.ip,
      req.headers['user-agent']
    );

    await db.run('DELETE FROM users WHERE id = ?', [id]);

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('❌ Error deleting user by admin:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

// تفعيل/تعطيل مستخدم
export const toggleUserStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    const db = await initDB();
    
    const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (existing.username === 'admin') {
      return res.status(400).json({ error: 'Cannot change admin status' });
    }

    await db.run(
      'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [is_active ? 1 : 0, id]
    );

    const updated = await db.get(
      'SELECT id, username, full_name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    const adminId = (req as any).user?.id;
    const adminName = (req as any).user?.username || 'admin';
    await logActivity(
      adminId,
      adminName,
      'UPDATE',
      'user',
      parseInt(id),
      { action: is_active ? 'activated' : 'deactivated' },
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      user: updated,
      message: `User ${is_active ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('❌ Error toggling user status:', error);
    res.status(500).json({ error: 'Failed to toggle user status' });
  }
};