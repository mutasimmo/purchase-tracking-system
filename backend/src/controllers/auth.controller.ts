// src/controllers/auth.controller.ts
import { Request, Response } from 'express';
import { getSupabase } from '../config/database.js';
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
import UserRepository from '../repositories/user.repository.js';

// ============================================
// Login
// ============================================

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      throw new ValidationError('Username and password are required');
    }

    const supabase = getSupabase();
    
    // Find user by username
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (error || !user) {
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

    // Save session in Supabase
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        token: token,
        device_info: req.headers['user-agent'] || 'unknown',
        ip_address: req.ip || 'unknown',
        expires_at: expiresAt.toISOString(),
        is_active: 1
      });

    // Update last login
    await supabase
      .from('users')
      .update({ 
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    // Set cookies
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

    // Log activity
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

    const supabase = getSupabase();
    
    // Check if username exists
    const { data: existingUsername } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .is('deleted_at', null)
      .maybeSingle();
      
    if (existingUsername) {
      throw new ConflictError('Username already exists');
    }

    // Check if email exists
    if (email) {
      const { data: existingEmail } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .is('deleted_at', null)
        .maybeSingle();
        
      if (existingEmail) {
        throw new ConflictError('Email already exists');
      }
    }

    const hashedPassword = await hashPassword(password);

    const { data: newUser, error } = await supabase
      .from('users')
      .insert({
        username,
        password: hashedPassword,
        full_name,
        email: email || null,
        role: role || 'user',
        is_active: 1
      })
      .select('id, username, full_name, email, role, is_active, created_at')
      .single();

    if (error) throw error;

    await logActivity(
      newUser.id,
      username,
      'REGISTER',
      'user',
      newUser.id,
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
// Logout
// ============================================

export const logout = async (req: Request, res: Response) => {
  try {
    const token = getTokenFromCookie(req) || req.headers.authorization?.substring(7);
    const user = (req as any).user;
    
    if (token && user) {
      try {
        await blacklistToken(token, user.id);
        
        // Deactivate session
        const supabase = getSupabase();
        await supabase
          .from('sessions')
          .update({ is_active: 0 })
          .eq('token', token);
        
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
        logger.warn('Failed to blacklist token during logout:', error);
      }
    }
    
    // Clear cookies
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

    const supabase = getSupabase();
    const { verifyRefreshToken } = await import('../config/auth.js');
    const verification = verifyRefreshToken(refreshToken);
    
    if (!verification.valid) {
      throw new AuthenticationError(verification.error || 'Invalid refresh token');
    }

    const decoded = verification.data;
    
    // Find user
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, role, is_active')
      .eq('id', decoded.id)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (error || !user || !user.is_active) {
      throw new AuthenticationError('User not found or inactive');
    }

    // Deactivate old session
    await supabase
      .from('sessions')
      .update({ is_active: 0 })
      .eq('token', refreshToken);

    await blacklistToken(refreshToken, user.id);

    const newToken = generateToken(user.id, user.username, user.role);
    const newRefreshToken = generateRefreshToken(user.id);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await supabase
      .from('sessions')
      .insert({
        user_id: user.id,
        token: newToken,
        device_info: req.headers['user-agent'] || 'unknown',
        ip_address: req.ip || 'unknown',
        expires_at: expiresAt.toISOString(),
        is_active: 1
      });

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

    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, email, role, is_active, created_at, last_login')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !user) {
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

    const supabase = getSupabase();
    
    // Get user with password
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !user) {
      throw new NotFoundError('User not found');
    }

    const isValid = await comparePassword(currentPassword, user.password);
    if (!isValid) {
      throw new AuthenticationError('Current password is incorrect');
    }

    const hashedPassword = await hashPassword(newPassword);
    
    await supabase
      .from('users')
      .update({ 
        password: hashedPassword,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

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

    const supabase = getSupabase();
    
    if (email) {
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', userId)
        .is('deleted_at', null)
        .maybeSingle();
        
      if (existing) {
        throw new ConflictError('Email already exists');
      }
    }

    const updateData: any = {
      updated_at: new Date().toISOString()
    };
    
    if (full_name) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email || null;

    const { data: updated, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select('id, username, full_name, email, role, is_active, created_at, updated_at')
      .single();

    if (error) throw error;

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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const { search, role, isActive } = req.query;

    const result = await UserRepository.findAll({
      page,
      limit,
      search: search as string,
      role: role as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined
    });

    res.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit)
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
    const user = await UserRepository.findById(parseInt(id));
    
    if (!user) {
      throw new NotFoundError('User not found');
    }
    
    const { password, ...userData } = user;
    res.json(userData);
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

    const user = await UserRepository.create({
      username,
      password,
      full_name,
      email,
      role: role || 'user'
    });

    const adminId = (req as any).user?.id;
    const adminName = (req as any).user?.username || 'admin';
    
    await logActivity(
      adminId,
      adminName,
      'USER_CREATE',
      'user',
      user.id,
      user,
      req.ip,
      req.headers['user-agent']
    );

    const { password: _, ...userData } = user;
    res.status(201).json({
      success: true,
      user: userData
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
    
    const user = await UserRepository.findById(parseInt(id));
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.username === 'admin' && role && role !== 'admin') {
      throw new AuthorizationError('Cannot change admin role');
    }

    const updateData: any = {};
    if (full_name) updateData.full_name = full_name;
    if (email !== undefined) updateData.email = email;
    if (role) updateData.role = role;
    if (is_active !== undefined) updateData.is_active = is_active ? 1 : 0;
    if (password && password.length >= 8) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        throw new ValidationError('Password validation failed', passwordValidation.errors);
      }
      updateData.password = password;
    }

    const updated = await UserRepository.update(parseInt(id), updateData);

    const adminId = (req as any).user?.id;
    const adminName = (req as any).user?.username || 'admin';
    
    await logActivity(
      adminId,
      adminName,
      'USER_UPDATE',
      'user',
      parseInt(id),
      { old: user, new: updated },
      req.ip,
      req.headers['user-agent']
    );

    const { password: _, ...userData } = updated;
    res.json({
      success: true,
      user: userData
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
// Admin: Delete User
// ============================================

export const deleteUserByAdmin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.username === 'admin' || user.username === 'mutasim') {
      throw new AuthorizationError('Cannot delete admin user');
    }

    const currentUser = (req as any).user;
    if (currentUser.id === userId) {
      throw new AuthorizationError('Cannot delete your own account');
    }

    await UserRepository.delete(userId);

    const adminId = currentUser.id;
    const adminName = currentUser.username || 'admin';
    
    await logActivity(
      adminId,
      adminName,
      'USER_DELETE',
      'user',
      userId,
      user,
      req.ip,
      req.headers['user-agent']
    );

    await revokeAllUserTokens(userId);

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
    const userId = parseInt(id);
    
    if (is_active === undefined) {
      throw new ValidationError('is_active is required');
    }

    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if ((user.username === 'admin' || user.username === 'mutasim') && !is_active) {
      throw new AuthorizationError('Cannot deactivate admin user');
    }

    const currentUser = (req as any).user;
    if (currentUser.id === userId) {
      throw new AuthorizationError('Cannot change your own status');
    }

    const updated = await UserRepository.update(userId, { is_active: is_active ? 1 : 0 });

    if (!is_active) {
      await revokeAllUserTokens(userId);
    }

    const adminId = (req as any).user?.id;
    const adminName = (req as any).user?.username || 'admin';
    
    await logActivity(
      adminId,
      adminName,
      'USER_STATUS',
      'user',
      userId,
      { action: is_active ? 'activated' : 'deactivated' },
      req.ip,
      req.headers['user-agent']
    );

    const { password: _, ...userData } = updated;
    res.json({
      success: true,
      user: userData,
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
    const userId = parseInt(id);
    
    if (!role) {
      throw new ValidationError('Role is required');
    }

    const validRoles = ['super_admin', 'admin', 'manager', 'user', 'viewer'];
    if (!validRoles.includes(role)) {
      throw new ValidationError('Invalid role', [`Role must be one of: ${validRoles.join(', ')}`]);
    }

    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (user.username === 'admin' || user.username === 'mutasim') {
      throw new AuthorizationError('Cannot change admin role');
    }

    const currentUser = (req as any).user;
    if (currentUser.id === userId) {
      throw new AuthorizationError('Cannot change your own role');
    }

    const updated = await UserRepository.update(userId, { role });

    const adminId = currentUser.id;
    const adminName = currentUser.username || 'admin';
    
    await logActivity(
      adminId,
      adminName,
      'USER_ROLE_CHANGE',
      'user',
      userId,
      { oldRole: user.role, newRole: role },
      req.ip,
      req.headers['user-agent']
    );

    const { password: _, ...userData } = updated;
    res.json({
      success: true,
      user: userData,
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