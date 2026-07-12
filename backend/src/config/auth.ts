// src/config/auth.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getDB } from './database.js';
import logger from './logger.js';

// ============================================
// ✅ Check for JWT Secret
// ============================================

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('❌ JWT_SECRET is not defined in environment variables!');
}

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

// ============================================
// 🔐 Password functions
// ============================================

export const hashPassword = async (password: string): Promise<string> => {
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  return await bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (password.length < 8) errors.push('Password must be at least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('Password must contain at least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('Password must contain at least one lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('Password must contain at least one number');
  if (!/[!@#$%^&*]/.test(password)) errors.push('Password must contain at least one special character');
  return { valid: errors.length === 0, errors };
};

// ============================================
// 🎫 Token functions - ✅ FIXED
// ============================================

export const generateToken = (userId: number, username: string, role: string = 'user'): string => {
  // Create payload
  const payload: jwt.JwtPayload = {
    id: userId,
    username,
    role,
    iat: Math.floor(Date.now() / 1000)
  };
  
  // ✅ Sign with separate payload, secret, and options
  const token = jwt.sign(
    payload,
    JWT_SECRET,
    {
      expiresIn: JWT_EXPIRES_IN,
      issuer: process.env.JWT_ISSUER || 'purchase-system',
      audience: process.env.JWT_AUDIENCE || 'purchase-app'
    } as jwt.SignOptions
  );
  
  return token;
};

export const generateRefreshToken = (userId: number): string => {
  // Create payload
  const payload: jwt.JwtPayload = {
    id: userId,
    type: 'refresh',
    iat: Math.floor(Date.now() / 1000)
  };
  
  // ✅ Sign with separate payload, secret, and options - FIXES LINE 75
  const token = jwt.sign(
    payload,
    JWT_SECRET,
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
      issuer: process.env.JWT_ISSUER || 'purchase-system'
    } as jwt.SignOptions
  );
  
  return token;
};

export const verifyToken = (token: string): { valid: boolean; data?: any; error?: string } => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, data: decoded };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: 'Token expired' };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: 'Invalid token' };
    }
    return { valid: false, error: 'Unknown error' };
  }
};

export const verifyRefreshToken = (token: string): { valid: boolean; data?: any; error?: string } => {
  const result = verifyToken(token);
  if (result.valid && result.data.type !== 'refresh') {
    return { valid: false, error: 'Invalid token type' };
  }
  return result;
};

// ============================================
// 📥 Get token functions
// ============================================

export const getTokenFromCookie = (req: any): string | null => {
  const token = req.cookies?.token || req.cookies?.accessToken;
  if (token && typeof token === 'string' && token.length > 0) {
    return token;
  }
  return null;
};

export const getRefreshTokenFromCookie = (req: any): string | null => {
  const token = req.cookies?.refreshToken;
  if (token && typeof token === 'string' && token.length > 0) {
    return token;
  }
  return null;
};

// ============================================
// 👤 User functions
// ============================================

export const getUserWithRole = async (userId: number) => {
  try {
    const db = await getDB();
    const user = await db.get(
      `SELECT id, username, full_name, email, role, is_active, created_at, last_login 
       FROM users WHERE id = ?`,
      [userId]
    );
    return user;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting user with role:', errorMessage);
    return null;
  }
};

export const getUserByUsername = async (username: string) => {
  try {
    const db = await getDB();
    const user = await db.get(
      `SELECT * FROM users WHERE username = ?`,
      [username]
    );
    return user;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting user by username:', errorMessage);
    return null;
  }
};

export const getUserByEmail = async (email: string) => {
  try {
    const db = await getDB();
    const user = await db.get(
      `SELECT * FROM users WHERE email = ?`,
      [email]
    );
    return user;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error getting user by email:', errorMessage);
    return null;
  }
};

// ============================================
// 🚫 Token blacklist functions
// ============================================

export const blacklistToken = async (token: string, userId: number) => {
  try {
    const db = await getDB();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await db.run(
      `INSERT INTO token_blacklist (token, user_id, expires_at)
       VALUES (?, ?, ?)`,
      [token, userId, expiresAt.toISOString()]
    );
    
    logger.info(`Token blacklisted for user ${userId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error blacklisting token:', errorMessage);
    throw error;
  }
};

export const revokeAllUserTokens = async (userId: number) => {
  try {
    const db = await getDB();
    
    await db.run(`
      INSERT INTO token_blacklist (token, user_id, expires_at)
      SELECT token, user_id, expires_at 
      FROM sessions 
      WHERE user_id = ? AND is_active = 1
    `, [userId]);
    
    await db.run(
      'UPDATE sessions SET is_active = 0 WHERE user_id = ?',
      [userId]
    );
    
    logger.info(`All tokens revoked for user ${userId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error revoking all user tokens:', errorMessage);
    throw error;
  }
};

export const cleanupExpiredTokens = async () => {
  try {
    const db = await getDB();
    const result = await db.run(
      'DELETE FROM token_blacklist WHERE expires_at < datetime("now")'
    );
    logger.info(`Cleaned up ${result.changes} expired tokens`);
    return result.changes;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error cleaning up expired tokens:', errorMessage);
    throw error;
  }
};

// ============================================
// 📊 Failed login attempts
// ============================================

export const logFailedLogin = async (username: string, ip: string, userAgent: string) => {
  try {
    const db = await getDB();
    await db.run(
      `INSERT INTO audit_log (username, action, entity_type, changes, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [username, 'FAILED_LOGIN', 'auth', JSON.stringify({ username, ip }), ip, userAgent]
    );
    
    const attempts = await db.get(
      `SELECT COUNT(*) as count 
       FROM audit_log 
       WHERE username = ? AND action = 'FAILED_LOGIN' 
       AND created_at > datetime('now', '-15 minutes')`,
      [username]
    );
    
    if (attempts.count >= 5) {
      logger.warn(`Too many failed login attempts for user: ${username}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error logging failed login:', errorMessage);
  }
};

// ============================================
// 📝 Export all functions
// ============================================

export default {
  hashPassword,
  comparePassword,
  validatePassword,
  generateToken,
  generateRefreshToken,
  verifyToken,
  verifyRefreshToken,
  getTokenFromCookie,
  getRefreshTokenFromCookie,
  getUserWithRole,
  getUserByUsername,
  getUserByEmail,
  blacklistToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  logFailedLogin
};