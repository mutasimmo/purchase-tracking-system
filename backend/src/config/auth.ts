// src/config/auth.ts
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getSupabase } from './database.js';

// ============================================
// ✅ Configuration
// ============================================

const JWT_SECRET = process.env.JWT_SECRET!;
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
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters long');
  }
  return await bcrypt.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  if (!password || !hashedPassword) return false;
  return await bcrypt.compare(password, hashedPassword);
};

export const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  if (!password || password.length < 8) {
    errors.push('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على حرف كبير');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على حرف صغير');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على رقم');
  }
  if (!/[!@#$%^&*]/.test(password)) {
    errors.push('كلمة المرور يجب أن تحتوي على رمز خاص');
  }
  return { valid: errors.length === 0, errors };
};

// ============================================
// 🎫 Token functions - ✅ الحل النهائي
// ============================================

export const generateToken = (userId: number, username: string, role: string = 'user'): string => {
  const payload = {
    id: userId,
    username,
    role,
    type: 'access'
  };
  
  // ✅ استخدام JWT_SECRET مع non-null assertion
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: process.env.JWT_ISSUER || 'purchase-system',
    audience: process.env.JWT_AUDIENCE || 'purchase-app'
  } as jwt.SignOptions);
};

export const generateRefreshToken = (userId: number): string => {
  const payload = {
    id: userId,
    type: 'refresh'
  };
  
  // ✅ استخدام JWT_SECRET مع non-null assertion
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    issuer: process.env.JWT_ISSUER || 'purchase-system'
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): { valid: boolean; data?: any; error?: string } => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return { valid: true, data: decoded };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: 'انتهت صلاحية التوكن' };
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: 'توكن غير صالح' };
    }
    return { valid: false, error: 'خطأ غير معروف' };
  }
};

export const verifyRefreshToken = (token: string): { valid: boolean; data?: any; error?: string } => {
  const result = verifyToken(token);
  if (result.valid && result.data.type !== 'refresh') {
    return { valid: false, error: 'نوع توكن غير صحيح' };
  }
  return result;
};

// ============================================
// 📥 Get token from request
// ============================================

export const getTokenFromCookie = (req: any): string | null => {
  if (req.cookies?.token) {
    return req.cookies.token;
  }
  return null;
};

export const getRefreshTokenFromCookie = (req: any): string | null => {
  if (req.cookies?.refreshToken) {
    return req.cookies.refreshToken;
  }
  return null;
};

export const getTokenFromRequest = (req: any): string | null => {
  const authHeader = req.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  if (req.cookies?.token) {
    return req.cookies.token;
  }

  if (req.query?.token) {
    return req.query.token;
  }

  return null;
};

// ============================================
// 👤 User functions
// ============================================

export const getUserById = async (userId: number) => {
  try {
    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, email, role, is_active, created_at, last_login')
      .eq('id', userId)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting user by id:', error);
    return null;
  }
};

export const getUserByUsername = async (username: string) => {
  try {
    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting user by username:', error);
    return null;
  }
};

export const getUserByEmail = async (email: string) => {
  try {
    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .is('deleted_at', null)
      .maybeSingle();
    
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error getting user by email:', error);
    return null;
  }
};

// ============================================
// 🚫 Token blacklist functions
// ============================================

export const blacklistToken = async (token: string, userId: number) => {
  try {
    const supabase = getSupabase();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    const { error } = await supabase
      .from('token_blacklist')
      .insert({
        token: token,
        user_id: userId,
        expires_at: expiresAt.toISOString()
      });
    
    if (error) throw error;
    console.log(`✅ Token blacklisted for user ${userId}`);
  } catch (error) {
    console.error('Error blacklisting token:', error);
    throw error;
  }
};

export const revokeAllUserTokens = async (userId: number) => {
  try {
    const supabase = getSupabase();
    
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('token')
      .eq('user_id', userId)
      .eq('is_active', 1);
    
    if (sessionsError) throw sessionsError;
    
    if (sessions && sessions.length > 0) {
      for (const session of sessions) {
        await blacklistToken(session.token, userId);
      }
    }
    
    const { error: updateError } = await supabase
      .from('sessions')
      .update({ is_active: 0 })
      .eq('user_id', userId);
    
    if (updateError) throw updateError;
    
    console.log(`✅ All tokens revoked for user ${userId}`);
  } catch (error) {
    console.error('Error revoking all user tokens:', error);
    throw error;
  }
};

export const cleanupExpiredTokens = async () => {
  try {
    const supabase = getSupabase();
    const { error } = await supabase
      .from('token_blacklist')
      .delete()
      .lt('expires_at', new Date().toISOString());
    
    if (error) throw error;
    console.log('🧹 Cleaned up expired tokens');
  } catch (error) {
    console.error('Error cleaning up expired tokens:', error);
  }
};

export const logFailedLogin = async (username: string, ip: string, userAgent: string) => {
  try {
    const supabase = getSupabase();
    
    await supabase
      .from('audit_log')
      .insert({
        username: username,
        action: 'FAILED_LOGIN',
        entity_type: 'auth',
        changes: JSON.stringify({ username, ip }),
        ip_address: ip,
        user_agent: userAgent
      });
  } catch (error) {
    console.error('Error logging failed login:', error);
  }
};

// ============================================
// 📝 Export
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
  getTokenFromRequest,
  getUserById,
  getUserByUsername,
  getUserByEmail,
  blacklistToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  logFailedLogin
};