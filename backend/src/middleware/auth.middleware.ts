// src/middleware/auth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyToken, getTokenFromCookie, getUserWithRole } from '../config/auth.js';
import { getDB } from '../config/database.js';
import logger from '../config/logger.js';
import { AuthenticationError, AuthorizationError } from '../types/errors.js';
import rateLimit from 'express-rate-limit';

// ============================================
// Extend Express Request type to include user
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
    const db = await getDB();
    const blacklisted = await db.get(
      'SELECT id FROM token_blacklist WHERE token = ? AND expires_at > datetime("now")',
      [token]
    );
    
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
    const user = await getUserWithRole(decoded.id);
    if (!user) {
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
    // Handle known error types
    if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    // Log unknown errors
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
// Active User Check Middleware
// ============================================

export const requireActiveUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      throw new AuthenticationError('Authentication required');
    }

    const db = await getDB();
    const user = await db.get(
      'SELECT is_active FROM users WHERE id = ?',
      [userId]
    );

    if (!user || !user.is_active) {
      throw new AuthorizationError('Account is deactivated');
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
    logger.error('Active user check error:', errorMessage);
    return res.status(500).json({ 
      error: 'Failed to verify user status',
      code: 'USER_CHECK_ERROR'
    });
  }
};

// ============================================
// Rate Limiting for Authentication
// ============================================

// ✅ Fixed: use custom keyGenerator with request
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts only
  message: {
    error: 'Too many login attempts',
    message: 'Please try again after 15 minutes',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    const username = (req.body as any)?.username || 'unknown';
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return `${ip}_${username}`;
  }
});

export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 attempts only
  message: {
    error: 'Too many registration attempts',
    message: 'Please try again after 1 hour',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return ip;
  }
});

// ============================================
// Export all functions
// ============================================

export default {
  authenticate,
  authorize,
  requireActiveUser,
  authRateLimiter,
  registerRateLimiter
};