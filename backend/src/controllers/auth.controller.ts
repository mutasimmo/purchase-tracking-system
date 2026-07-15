// backend/src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { getDB } from '../config/database.js';
import { 
  hashPassword, 
  comparePassword, 
  generateToken, 
  generateRefreshToken,
  validatePassword,
  getTokenFromCookie,
  getRefreshTokenFromCookie,
  blacklistToken,
  revokeAllUserTokens,
  logFailedLogin
} from '../config/auth.js';
import { logActivity } from '../services/audit.service.js';
import logger from '../config/logger.js';
import { 
  AuthenticationError, 
  AuthorizationError, 
  ValidationError, 
  NotFoundError,
  ConflictError 
} from '../types/errors.js';

// ============================================
// Login
// ============================================

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    const db = await getDB();
    
    const user = await db.get(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );
    
    if (!user) {
      await logFailedLogin(username, req.ip || '', req.headers['user-agent'] || '');
      throw new AuthenticationError('Invalid username or password');
    }

    if (!user.is_active) {
      throw new AuthorizationError('Account is deactivated');
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      await logFailedLogin(username, req.ip || '', req.headers['user-agent'] || '');
      throw new AuthenticationError('Invalid username or password');
    }

    const token = generateToken(user.id, user.username, user.role);
    const refreshToken = generateRefreshToken(user.id);

    await db.run(
      `INSERT INTO sessions (user_id, token, device_info, ip_address, expires_at)
       VALUES (?, ?, ?, ?, datetime('now', '+7 days'))`,
      [user.id, token, req.headers['user-agent'] || 'unknown', req.ip || 'unknown']
    );

    await db.run(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [user.id]
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    await logActivity(
      user.id,
      user.username,
      'LOGIN',
      'user',
      user.id,
      { ip: req.ip, userAgent: req.headers['user-agent'] },
      req.ip,
      req.headers['user-agent']
    );

    const { password: _, ...userData } = user;
    
    res.json({
      success: true,
      user: userData,
      token,
      refreshToken
    });
  } catch (error) {
    logger.error('Login error:', error);
    
    if (error instanceof ValidationError || 
        error instanceof AuthenticationError || 
        error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Login failed',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Register
// ============================================

export const register = async (req: Request, res: Response) => {
  try {
    const { username, password, full_name, email, role } = req.body;
    
    if (!username || !password || !full_name) {
      throw new ValidationError('Username, password, and full name are required');
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password validation failed', passwordValidation.errors);
    }

    const db = await getDB();
    
    const existingUsername = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUsername) {
      throw new ConflictError('Username already exists');
    }

    if (email) {
      const existingEmail = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existingEmail) {
        throw new ConflictError('Email already exists');
      }
    }

    const hashedPassword = await hashPassword(password);

    const result = await db.run(
      `INSERT INTO users (username, password, full_name, email, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, full_name, email || null, role || 'user', 1]
    );

    const newUser = await db.get(
      'SELECT id, username, full_name, email, role, is_active, created_at FROM users WHERE id = ?',
      [result.lastID]
    );

    await logActivity(
      result.lastID,
      username,
      'REGISTER',
      'user',
      result.lastID,
      newUser,
      req.ip,
      req.headers['user-agent']
    );

    res.status(201).json({
      success: true,
      user: newUser,
      message: 'User registered successfully'
    });
  } catch (error) {
    logger.error('Register error:', error);
    
    if (error instanceof ValidationError || error instanceof ConflictError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error instanceof ValidationError ? error.errors : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Registration failed',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Logout - ✅ Fixed: works without authenticate
// ============================================

export const logout = async (req: Request, res: Response) => {
  try {
    // Get token from cookie or header
    const token = getTokenFromCookie(req) || req.headers.authorization?.substring(7);
    
    // Try to get user if available (from authenticate middleware)
    const user = (req as any).user;
    
    // If token and user exist, blacklist the token
    if (token && user) {
      try {
        await blacklistToken(token, user.id);
        
        await logActivity(
          user.id,
          user.username,
          'LOGOUT',
          'user',
          user.id,
          { ip: req.ip },
          req.ip,
          req.headers['user-agent']
        );
      } catch (error) {
        // Don't block logout if blacklisting fails
        logger.warn('Failed to blacklist token during logout:', error);
      }
    }
    
    // Always clear cookies
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    res.json({ 
      success: true, 
      message: 'Logged out successfully' 
    });
  } catch (error) {
    logger.error('Logout error:', error);
    
    // Even on error, clear cookies
    try {
      res.clearCookie('token');
      res.clearCookie('refreshToken');
    } catch (cookieError) {
      // Ignore
    }
    
    res.status(500).json({ 
      error: 'Logout failed',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Refresh Token
// ============================================

export const refreshToken = async (req: Request, res: Response) => {
  try {
    const refreshToken = getRefreshTokenFromCookie(req) || req.body.refreshToken;
    
    if (!refreshToken) {
      throw new AuthenticationError('Refresh token required');
    }

    const db = await getDB();
    const { verifyRefreshToken } = await import('../config/auth.js');
    const verification = verifyRefreshToken(refreshToken);
    
    if (!verification.valid) {
      throw new AuthenticationError(verification.error || 'Invalid refresh token');
    }

    const decoded = verification.data;
    
    const user = await db.get(
      'SELECT id, username, role, is_active FROM users WHERE id = ?',
      [decoded.id]
    );
    
    if (!user || !user.is_active) {
      throw new AuthenticationError('User not found or inactive');
    }

    await db.run(
      'UPDATE sessions SET is_active = 0 WHERE token = ?',
      [refreshToken]
    );

    await blacklistToken(refreshToken, user.id);

    const newToken = generateToken(user.id, user.username, user.role);
    const newRefreshToken = generateRefreshToken(user.id);

    await db.run(
      `INSERT INTO sessions (user_id, token, device_info, ip_address, expires_at)
       VALUES (?, ?, ?, ?, datetime('now', '+7 days'))`,
      [user.id, newToken, req.headers['user-agent'] || 'unknown', req.ip || 'unknown']
    );

    res.cookie('token', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      success: true,
      token: newToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    
    if (error instanceof AuthenticationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to refresh token',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Get Current User
// ============================================

export const getCurrentUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new AuthenticationError('Unauthorized');
    }

    const db = await getDB();
    const user = await db.get(
      'SELECT id, username, full_name, email, role, is_active, created_at, last_login FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      throw new NotFoundError('User not found');
    }

    res.json({ user });
  } catch (error) {
    logger.error('Get current user error:', error);
    
    if (error instanceof AuthenticationError || error instanceof NotFoundError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to get user',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Change Password
// ============================================

export const changePassword = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId || !currentPassword || !newPassword) {
      throw new ValidationError('All fields are required');
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password validation failed', passwordValidation.errors);
    }

    const db = await getDB();
    const user = await db.get('SELECT * FROM users WHERE id = ?', [userId]);

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const hashedPassword = await hashPassword(newPassword);
    await db.run(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [hashedPassword, userId]
    );

    await revokeAllUserTokens(userId);

    await logActivity(
      userId,
      user.username,
      'PASSWORD_CHANGE',
      'user',
      userId,
      { action: 'password_changed' },
      req.ip,
      req.headers['user-agent']
    );

    res.json({ 
      success: true, 
      message: 'Password updated successfully. All other sessions have been terminated.' 
    });
  } catch (error) {
    logger.error('Change password error:', error);
    
    if (error instanceof ValidationError || 
        error instanceof AuthenticationError || 
        error instanceof NotFoundError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error instanceof ValidationError ? error.errors : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to change password',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Update User (for user himself)
// ============================================

export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const { full_name, email } = req.body;

    if (!userId) {
      throw new AuthenticationError('Unauthorized');
    }

    const db = await getDB();
    
    if (email) {
      const existing = await db.get(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );
      if (existing) {
        throw new ConflictError('Email already exists');
      }
    }

    await db.run(
      `UPDATE users SET 
        full_name = COALESCE(?, full_name),
        email = COALESCE(?, email),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [full_name || null, email || null, userId]
    );

    const updated = await db.get(
      'SELECT id, username, full_name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );

    await logActivity(
      userId,
      updated.username,
      'UPDATE_PROFILE',
      'user',
      userId,
      { full_name, email },
      req.ip,
      req.headers['user-agent']
    );

    res.json({ 
      success: true, 
      user: updated 
    });
  } catch (error) {
    logger.error('Update user error:', error);
    
    if (error instanceof AuthenticationError || error instanceof ConflictError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update user',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Admin: Get All Users
// ============================================

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    
    const { search, role, isActive } = req.query;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    
    if (search) {
      whereClause += ' AND (username LIKE ? OR full_name LIKE ? OR email LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (role) {
      whereClause += ' AND role = ?';
      params.push(role);
    }
    
    if (isActive !== undefined) {
      whereClause += ' AND is_active = ?';
      params.push(isActive === 'true' ? 1 : 0);
    }
    
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    const total = countResult.total;
    
    const users = await db.all(`
      SELECT id, username, full_name, email, role, is_active, created_at, updated_at, last_login
      FROM users 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);
    
    res.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Admin: Get User By ID
// ============================================

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    
    const user = await db.get(`
      SELECT id, username, full_name, email, role, is_active, created_at, updated_at, last_login
      FROM users 
      WHERE id = ?
    `, [id]);
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    res.json(user);
  } catch (error) {
    logger.error('Error fetching user:', error);
    
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch user',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Admin: Create User
// ============================================

export const createUserByAdmin = async (req: Request, res: Response) => {
  try {
    const { username, password, full_name, email, role, is_active } = req.body;
    
    if (!username || !password || !full_name) {
      throw new ValidationError('Username, password, and full name are required');
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw new ValidationError('Password validation failed', passwordValidation.errors);
    }

    const db = await getDB();
    
    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      throw new ConflictError('Username already exists');
    }

    const hashedPassword = await hashPassword(password);

    const result = await db.run(
      `INSERT INTO users (username, password, full_name, email, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, hashedPassword, full_name, email || null, role || 'user', is_active !== undefined ? (is_active ? 1 : 0) : 1]
    );

    const newUser = await db.get(
      'SELECT id, username, full_name, email, role, is_active, created_at FROM users WHERE id = ?',
      [result.lastID]
    );

    const adminId = (req as any).user?.id;
    const adminName = (req as any).user?.username || 'admin';
    await logActivity(
      adminId,
      adminName,
      'USER_CREATE',
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
    logger.error('Error creating user by admin:', error);
    
    if (error instanceof ValidationError || error instanceof ConflictError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error instanceof ValidationError ? error.errors : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create user',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Admin: Update User
// ============================================

export const updateUserByAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { full_name, email, role, is_active, password } = req.body;
    
    const db = await getDB();
    
    const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    if (existing.username === 'admin' && role && role !== 'admin') {
      throw new AuthorizationError('Cannot change admin role');
    }

    let updates: string[] = [];
    const params: any[] = [];
    
    if (full_name) {
      updates.push('full_name = ?');
      params.push(full_name);
    }
    
    if (email) {
      const existingEmail = await db.get(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, id]
      );
      if (existingEmail) {
        throw new ConflictError('Email already exists');
      }
      updates.push('email = ?');
      params.push(email);
    }
    
    if (role) {
      updates.push('role = ?');
      params.push(role);
    }
    
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(is_active ? 1 : 0);
    }
    
    if (password && password.length >= 8) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        throw new ValidationError('Password validation failed', passwordValidation.errors);
      }
      const hashedPassword = await hashPassword(password);
      updates.push('password = ?');
      params.push(hashedPassword);
    }
    
    if (updates.length === 0) {
      throw new ValidationError('No valid fields to update');
    }
    
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    
    await db.run(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
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
      'USER_UPDATE',
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
    logger.error('Error updating user by admin:', error);
    
    if (error instanceof ValidationError || 
        error instanceof NotFoundError || 
        error instanceof ConflictError ||
        error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error instanceof ValidationError ? error.errors : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update user',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Admin: Delete User (Soft Delete)
// ============================================

export const deleteUserByAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    
    const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    if (existing.username === 'admin' || existing.username === 'mutasim') {
      throw new AuthorizationError('Cannot delete admin user');
    }

    const currentUser = (req as any).user;
    if (currentUser.id === parseInt(id)) {
      throw new AuthorizationError('Cannot delete your own account');
    }

    const adminId = currentUser.id;
    const adminName = currentUser.username || 'admin';
    await logActivity(
      adminId,
      adminName,
      'USER_DELETE',
      'user',
      parseInt(id),
      existing,
      req.ip,
      req.headers['user-agent']
    );

    await db.run(
      'UPDATE users SET is_active = 0, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    await revokeAllUserTokens(parseInt(id));

    res.json({ 
      success: true, 
      message: 'User deleted successfully' 
    });
  } catch (error) {
    logger.error('Error deleting user by admin:', error);
    
    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to delete user',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Admin: Toggle User Status
// ============================================

export const toggleUserStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    if (is_active === undefined) {
      throw new ValidationError('is_active is required');
    }

    const db = await getDB();
    
    const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    if ((existing.username === 'admin' || existing.username === 'mutasim') && !is_active) {
      throw new AuthorizationError('Cannot deactivate admin user');
    }

    const currentUser = (req as any).user;
    if (currentUser.id === parseInt(id)) {
      throw new AuthorizationError('Cannot change your own status');
    }

    await db.run(
      'UPDATE users SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [is_active ? 1 : 0, id]
    );

    const updated = await db.get(
      'SELECT id, username, full_name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    if (!is_active) {
      await revokeAllUserTokens(parseInt(id));
    }

    const adminId = (req as any).user?.id;
    const adminName = (req as any).user?.username || 'admin';
    await logActivity(
      adminId,
      adminName,
      'USER_STATUS',
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
    logger.error('Error toggling user status:', error);
    
    if (error instanceof ValidationError || 
        error instanceof NotFoundError || 
        error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to toggle user status',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Admin: Change User Role
// ============================================

export const changeUserRole = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!role) {
      throw new ValidationError('Role is required');
    }

    const validRoles = ['super_admin', 'admin', 'manager', 'user', 'viewer'];
    if (!validRoles.includes(role)) {
      throw new ValidationError('Invalid role', [`Role must be one of: ${validRoles.join(', ')}`]);
    }

    const db = await getDB();
    
    const existing = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    if (!existing) {
      throw new NotFoundError('User not found');
    }

    if (existing.username === 'admin' || existing.username === 'mutasim') {
      throw new AuthorizationError('Cannot change admin role');
    }

    const currentUser = (req as any).user;
    if (currentUser.id === parseInt(id)) {
      throw new AuthorizationError('Cannot change your own role');
    }

    await db.run(
      'UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [role, id]
    );

    const updated = await db.get(
      'SELECT id, username, full_name, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    const adminId = currentUser.id;
    const adminName = currentUser.username || 'admin';
    await logActivity(
      adminId,
      adminName,
      'USER_ROLE_CHANGE',
      'user',
      parseInt(id),
      { oldRole: existing.role, newRole: role },
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      user: updated,
      message: `User role changed to ${role} successfully`
    });
  } catch (error) {
    logger.error('Error changing user role:', error);
    
    if (error instanceof ValidationError || 
        error instanceof NotFoundError || 
        error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error instanceof ValidationError ? error.errors : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to change user role',
      code: 'SERVER_ERROR'
    });
  }
};