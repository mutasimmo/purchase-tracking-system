// src/middleware/purchase.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { getDB } from '../config/database.js';
import { NotFoundError, AuthorizationError, ValidationError } from '../types/errors.js';
import logger from '../config/logger.js';
import { z } from 'zod';

// ============================================
// Validate Purchase Exists
// ============================================

export const validatePurchaseExists = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    
    const purchase = await db.get(
      'SELECT * FROM purchases WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    
    if (!purchase) {
      throw new NotFoundError('Purchase not found');
    }
    
    (req as any).purchase = purchase;
    next();
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    logger.error('Validate purchase exists error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ 
      error: 'Failed to validate purchase',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Validate Purchase Ownership
// ============================================

export const validatePurchaseOwnership = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const purchase = (req as any).purchase;
    
    if (!user) {
      throw new AuthorizationError('Authentication required');
    }
    
    // Admin and Super Admin can access everything
    if (user.role === 'admin' || user.role === 'super_admin') {
      return next();
    }
    
    // Check if user is the creator of the purchase
    if (purchase.requester !== user.username) {
      throw new AuthorizationError('You can only modify your own purchases');
    }
    
    next();
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    logger.error('Validate purchase ownership error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ 
      error: 'Failed to validate ownership',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Validate Purchase Data (Zod Schema)
// ============================================

export const purchaseSchema = z.object({
  request_number: z.string().min(1).max(50),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  requester: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  receiver: z.string().min(1).max(100),
  delivery_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
  status: z.enum(['قيد التنفيذ', 'منجز', 'معلق', 'ملغي']).optional(),
  notes: z.string().max(500).optional()
});

// ============================================
// Validate Purchase Data Middleware
// ============================================

export const validatePurchaseData = (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = purchaseSchema.parse(req.body);
    req.body = validated;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.issues.map((e: z.ZodIssue) => ({
          field: e.path.join('.'),
          message: e.message
        })),
        code: 'VALIDATION_ERROR'
      });
    }
    
    logger.error('Validate purchase data error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ 
      error: 'Validation failed',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Validate Status Update
// ============================================

export const validateStatusUpdate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body;
    const validStatuses = ['قيد التنفيذ', 'منجز', 'معلق', 'ملغي'];
    
    if (!status) {
      throw new ValidationError('Status is required');
    }
    
    if (!validStatuses.includes(status)) {
      throw new ValidationError('Invalid status', [`Status must be one of: ${validStatuses.join(', ')}`]);
    }
    
    next();
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.errors
      });
    }
    
    logger.error('Validate status update error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ 
      error: 'Validation failed',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Check if Purchase is Deleted
// ============================================

export const checkPurchaseNotDeleted = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    
    const purchase = await db.get(
      'SELECT deleted_at FROM purchases WHERE id = ?',
      [id]
    );
    
    if (!purchase) {
      throw new NotFoundError('Purchase not found');
    }
    
    if (purchase.deleted_at) {
      throw new ValidationError('Purchase has been deleted');
    }
    
    next();
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    logger.error('Check purchase not deleted error:', error instanceof Error ? error.message : 'Unknown error');
    res.status(500).json({ 
      error: 'Failed to check purchase status',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Export all middleware
// ============================================

export default {
  validatePurchaseExists,
  validatePurchaseOwnership,
  validatePurchaseData,
  validateStatusUpdate,
  checkPurchaseNotDeleted,
  purchaseSchema
};