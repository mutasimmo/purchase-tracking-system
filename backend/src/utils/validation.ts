// utils/validation.ts
import { z } from 'zod';

// ============================================
// User Validation
// ============================================

export const userValidation = {
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(50, 'Username must be less than 50 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers and underscore'),
  
  email: z.string()
    .email('Invalid email format')
    .optional()
    .or(z.literal('')),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[!@#$%^&*]/, 'Password must contain at least one special character'),
  
  full_name: z.string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters')
};

// ============================================
// Purchase Validation
// ============================================

export const purchaseValidation = {
  request_number: z.string()
    .min(1, 'Request number is required')
    .max(50, 'Request number must be less than 50 characters'),
  
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine((date) => !isNaN(Date.parse(date)), 'Invalid date'),
  
  requester: z.string()
    .min(1, 'Requester is required')
    .max(100, 'Requester must be less than 100 characters'),
  
  description: z.string()
    .min(1, 'Description is required')
    .max(500, 'Description must be less than 500 characters'),
  
  receiver: z.string()
    .min(1, 'Receiver is required')
    .max(100, 'Receiver must be less than 100 characters'),
  
  delivery_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine((date) => !isNaN(Date.parse(date)), 'Invalid date'),
  
  notes: z.string()
    .max(500, 'Notes must be less than 500 characters')
    .optional()
};

// ============================================
// Filter Validation
// ============================================

export const filterValidation = {
  page: z.coerce.number()
    .int('Page must be an integer')
    .min(1, 'Page must be at least 1')
    .default(1),
  
  limit: z.coerce.number()
    .int('Limit must be an integer')
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit must be less than 100')
    .default(20),
  
  status: z.enum(['قيد التنفيذ', 'منجز', 'معلق', 'ملغي', 'all'])
    .optional()
    .default('all'),
  
  sortBy: z.enum(['created_at', 'date', 'delivery_date', 'status', 'requester'])
    .optional()
    .default('created_at'),
  
  sortOrder: z.enum(['ASC', 'DESC'])
    .optional()
    .default('DESC')
};

// ============================================
// Helper function for validation
// ============================================

export const validate = <T>(schema: z.ZodSchema<T>, data: unknown): T => {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.issues.map((e: z.ZodIssue) => e.message);
      throw new Error(messages.join(', '));
    }
    throw error;
  }
};

export const validateSafe = <T>(schema: z.ZodSchema<T>, data: unknown): { success: boolean; data?: T; errors?: string[] } => {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.issues.map((e: z.ZodIssue) => e.message) };
    }
    return { success: false, errors: [(error as Error).message] };
  }
};

// ============================================
// Export default
// ============================================

export default {
  userValidation,
  purchaseValidation,
  filterValidation,
  validate,
  validateSafe
};