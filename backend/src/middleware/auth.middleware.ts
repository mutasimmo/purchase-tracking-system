// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken, getTokenFromCookie } from '../config/auth.js';
import { getSupabase } from '../config/database.js';
import logger from '../config/logger.js';
import { AuthenticationError, AuthorizationError } from '../types/errors.js';
import rateLimit from 'express-rate-limit';

// ============================================
// Extend Express Request type
// ============================================

declare global {
  namespace Express {
    interface Request {
      user: {
        id: number;
        username: string;
        full_name: string;
        email?: string;
        role: string;
        is_active: boolean;
        permissions?: string[];
      };
    }
  }
}

// ============================================
// Main Authentication Middleware
// ============================================

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // 1. Get token
    let token = getTokenFromCookie(req);
    
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      throw new AuthenticationError('Authentication required');
    }

    // 2. Check blacklist
    const supabase = getSupabase();
    const { data: blacklisted } = await supabase
      .from('token_blacklist')
      .select('id')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();
    
    if (blacklisted) {
      throw new AuthenticationError('Token has been revoked. Please login again.');
    }

    // 3. Verify token
    const verification = verifyToken(token);
    if (!verification.valid) {
      if (verification.error === 'Token expired') {
        throw new AuthenticationError('Session expired. Please login again.');
      }
      throw new AuthenticationError('Invalid token. Please login again.');
    }

    const decoded = verification.data;

    // 4. Get user with role from database
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, full_name, email, role, is_active')
      .eq('id', decoded.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !user) {
      throw new AuthenticationError('User not found');
    }

    // 5. Check if account is active
    if (!user.is_active) {
      throw new AuthorizationError('Account is deactivated. Contact administrator.');
    }

    // 6. Add user to Request
    req.user = {
      id: user.id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      is_active: user.is_active === 1
    };

    next();
  } catch (error) {
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Authentication error:', errorMessage);
    return res.status(401).json({ 
      error: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
};

// ============================================
// Authorization Middleware (Role-based)
// ============================================

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      
      if (!user) {
        throw new AuthenticationError('Authentication required');
      }

      // Super Admin has all permissions
      if (user.role === 'super_admin') {
        return next();
      }

      // Check if user has required role
      if (!roles.includes(user.role)) {
        logger.warn('Authorization failed', {
          userId: user.id,
          username: user.username,
          role: user.role,
          requiredRoles: roles,
          path: req.path,
          method: req.method
        });

        throw new AuthorizationError(
          `Insufficient permissions. Required roles: ${roles.join(', ')}. Your role: ${user.role}`
        );
      }

      next();
    } catch (error) {
      if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
        return res.status(error.statusCode).json({
          error: error.message,
          code: error.code
        });
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Authorization error:', errorMessage);
      return res.status(403).json({ 
        error: 'Authorization failed',
        code: 'AUTHZ_ERROR'
      });
    }
  };
};

// ============================================
// Rate Limiting for Authentication (✅ FIXED - using default keyGenerator)
// ============================================

// ✅ استخدام keyGenerator بسيط بدون مشاكل IPv6
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    error: 'Too many login attempts',
    message: 'Please try again after 15 minutes',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  // ✅ استخدام keyGenerator افتراضي (بدون مخصص)
});

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100,
  message: {
    error: 'Too many registration attempts',
    message: 'Please try again after 1 hour',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // ✅ استخدام keyGenerator افتراضي (بدون مخصص)
});

// ============================================
// Export all functions
// ============================================

export default {
  authenticate,
  authorize,
  authRateLimiter,
  registerRateLimiter
};