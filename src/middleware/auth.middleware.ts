import { Request, Response, NextFunction } from 'express';
import { verifyToken, getTokenFromCookie, getUserWithRole } from '../config/auth.js';

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let token = getTokenFromCookie(req);
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // جلب المستخدم مع الـ role من قاعدة البيانات
    const user = await getUserWithRole(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    // إضافة المستخدم الكامل مع الـ role
    (req as any).user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active
    };
    
    next();
  } catch (error) {
    console.error('❌ Authentication error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

// التحقق من الدور (Role-based authorization)
export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    
    console.log('🔍 Authorize check:', { 
      user: user?.username, 
      userRole: user?.role, 
      requiredRoles: roles 
    });
    
    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // إذا كان المستخدم Admin، لديه صلاحية كل شيء
    if (user.role === 'admin') {
      return next();
    }

    if (!roles.includes(user.role)) {
      return res.status(403).json({ 
        error: `Insufficient permissions. Required: ${roles.join(', ')}. Your role: ${user.role}`,
        required: roles,
        userRole: user.role
      });
    }

    next();
  };
};

// التحقق من وجود مستخدم نشط
export const requireActiveUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { initDB } = await import('../config/database.js');
    const db = await initDB();
    
    const user = await db.get(
      'SELECT is_active FROM users WHERE id = ?',
      [userId]
    );

    if (!user || !user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    next();
  } catch (error) {
    console.error('❌ Active user check error:', error);
    res.status(500).json({ error: 'Failed to verify user status' });
  }
};