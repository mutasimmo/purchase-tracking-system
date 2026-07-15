// src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';
import { AppError, ValidationError } from '../types/errors.js';

// ============================================
// Main Error Handler
// ============================================

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error
  const errorMessage = err instanceof Error ? err.message : 'Unknown error';
  logger.error('Error occurred', {
    error: errorMessage,
    stack: err.stack,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
    body: process.env.NODE_ENV === 'development' ? req.body : undefined
  });

  // Handle AppError instances
  if (err instanceof AppError) {
    const response: any = {
      error: err.message,
      code: err.code,
      timestamp: new Date().toISOString()
    };

    if (err instanceof ValidationError && err.errors) {
      response.details = err.errors;
    }

    if (process.env.NODE_ENV === 'development') {
      response.stack = err.stack;
    }

    return res.status(err.statusCode).json(response);
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token',
      code: 'INVALID_TOKEN',
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      code: 'TOKEN_EXPIRED',
      timestamp: new Date().toISOString()
    });
  }

  // Handle Postgres/Supabase errors
  if (err.message && (err.message.includes('Postgres') || err.message.includes('Supabase'))) {
    logger.error('Database error:', err);
    return res.status(500).json({
      error: 'Database error',
      code: 'DATABASE_ERROR',
      timestamp: new Date().toISOString()
    });
  }

  // Handle rate limit errors
  if (err.message && err.message.includes('Too many requests')) {
    return res.status(429).json({
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString()
    });
  }

  // Unexpected errors
  const statusCode = (err as any).statusCode || 500;
  const response: any = {
    error: statusCode === 500 ? 'Internal server error' : err.message,
    code: 'SERVER_ERROR',
    timestamp: new Date().toISOString()
  };

  if (process.env.NODE_ENV === 'development') {
    response.details = err.message;
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// ============================================
// Not Found Handler
// ============================================

import { NotFoundError } from '../types/errors.js';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  logger.warn('Route not found', {
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });

  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};

// ============================================
// JSON Error Handler
// ============================================

export const jsonErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn('Invalid JSON payload', {
      path: req.path,
      ip: req.ip,
      body: req.body
    });
    
    return res.status(400).json({
      error: 'Invalid JSON payload',
      message: 'The request body contains malformed JSON',
      code: 'INVALID_JSON',
      timestamp: new Date().toISOString()
    });
  }
  next(err);
};

// ============================================
// File Upload Error Handler
// ============================================

export const fileErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      error: 'File too large',
      message: 'The uploaded file exceeds the maximum size limit',
      code: 'FILE_TOO_LARGE',
      timestamp: new Date().toISOString()
    });
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      error: 'Unexpected file',
      message: 'Invalid file type',
      code: 'INVALID_FILE',
      timestamp: new Date().toISOString()
    });
  }

  next(err);
};

// ============================================
// Rate Limit Error Handler
// ============================================

export const rateLimitErrorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err.code === 'RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      error: 'Too many requests',
      message: 'Please try again later',
      code: 'RATE_LIMIT_EXCEEDED',
      timestamp: new Date().toISOString()
    });
  }
  next(err);
};

// ============================================
// Export all handlers
// ============================================

export default {
  errorHandler,
  notFoundHandler,
  jsonErrorHandler,
  fileErrorHandler,
  rateLimitErrorHandler
};