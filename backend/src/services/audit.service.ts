// src/services/audit.service.ts
import { getDB } from '../config/database.js';
import logger from '../config/logger.js';
import type { AuditLog, AuditLogFilter, AuditLogResponse } from '../models/audit.model.js';

// ============================================
// Log Activity (Async - doesn't block request)
// ============================================

export const logActivity = async (
  userId: number | undefined,
  username: string,
  action: string,
  entityType: string,
  entityId?: number,
  changes?: any,
  ipAddress?: string,
  userAgent?: string
) => {
  // Use setImmediate for async logging
  setImmediate(async () => {
    try {
      const db = await getDB();
      
      // Sanitize sensitive data
      const sanitizedChanges = sanitizeChanges(changes);
      
      await db.run(
        `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, changes, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId || null,
          username || 'system',
          action,
          entityType,
          entityId || null,
          sanitizedChanges ? JSON.stringify(sanitizedChanges) : null,
          ipAddress || null,
          userAgent || null
        ]
      );
      
      logger.debug(`Audit log: ${action} on ${entityType} by ${username}`);
    } catch (error) {
      logger.error('Error logging activity:', error instanceof Error ? error.message : 'Unknown error');
    }
  });
};

// ============================================
// Sanitize Sensitive Data
// ============================================

const sensitiveFields = ['password', 'token', 'refresh_token', 'secret', 'key', 'authorization'];

const sanitizeChanges = (changes: any): any => {
  if (!changes) return null;
  
  const sanitized = Array.isArray(changes) ? [...changes] : { ...changes };
  
  const sanitizeObject = (obj: any) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    Object.keys(obj).forEach(key => {
      if (sensitiveFields.includes(key.toLowerCase())) {
        obj[key] = '***REDACTED***';
      } else if (typeof obj[key] === 'object') {
        sanitizeObject(obj[key]);
      }
    });
    
    return obj;
  };
  
  return sanitizeObject(sanitized);
};

// ============================================
// Get Audit Logs with Filters and Pagination
// ============================================

export const getAuditLogs = async (filters: AuditLogFilter): Promise<AuditLogResponse> => {
  try {
    const db = await getDB();
    const { userId, action, entityType, startDate, endDate, page = 1, limit = 20 } = filters;
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (userId) {
      whereClause += ' AND user_id = ?';
      params.push(userId);
    }
    if (action) {
      whereClause += ' AND action = ?';
      params.push(action);
    }
    if (entityType) {
      whereClause += ' AND entity_type = ?';
      params.push(entityType);
    }
    if (startDate) {
      whereClause += ' AND created_at >= ?';
      params.push(startDate);
    }
    if (endDate) {
      whereClause += ' AND created_at <= ?';
      params.push(endDate);
    }

    // Get total count
    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM audit_log ${whereClause}`,
      params
    );
    const total = countResult.total;

    // Get data with pagination
    const offset = (page - 1) * limit;
    const query = `
      SELECT * FROM audit_log 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const data = await db.all(query, [...params, limit, offset]);
    
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  } catch (error) {
    logger.error('Error fetching audit logs:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
};

// ============================================
// Get Audit Logs by Entity
// ============================================

export const getAuditLogsByEntity = async (entityType: string, entityId: number): Promise<AuditLog[]> => {
  try {
    const db = await getDB();
    return await db.all(
      `SELECT * FROM audit_log 
       WHERE entity_type = ? AND entity_id = ? 
       ORDER BY created_at DESC`,
      [entityType, entityId]
    );
  } catch (error) {
    logger.error('Error fetching audit logs by entity:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
};

// ============================================
// User Activity Report
// ============================================

export const getUserActivityReport = async (userId: number, startDate: string, endDate: string) => {
  try {
    const db = await getDB();
    return await db.all(
      `SELECT 
         action, 
         COUNT(*) as count, 
         DATE(created_at) as date,
         entity_type
       FROM audit_log 
       WHERE user_id = ? AND created_at BETWEEN ? AND ?
       GROUP BY action, DATE(created_at), entity_type
       ORDER BY date DESC`,
      [userId, startDate, endDate]
    );
  } catch (error) {
    logger.error('Error getting user activity report:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
};

// ============================================
// Cleanup Old Logs
// ============================================

export const cleanupOldLogs = async (daysToKeep: number = 365) => {
  try {
    const db = await getDB();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const result = await db.run(
      'DELETE FROM audit_log WHERE created_at < ?',
      [cutoffDate.toISOString()]
    );
    
    logger.info(`Cleaned up ${result.changes} old audit logs`);
    return result.changes;
  } catch (error) {
    logger.error('Error cleaning up audit logs:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
};

// ============================================
// Audit Statistics
// ============================================

export const getAuditStats = async () => {
  try {
    const db = await getDB();
    
    const total = await db.get('SELECT COUNT(*) as total FROM audit_log');
    const byAction = await db.all(
      'SELECT action, COUNT(*) as count FROM audit_log GROUP BY action ORDER BY count DESC'
    );
    const byEntity = await db.all(
      'SELECT entity_type, COUNT(*) as count FROM audit_log GROUP BY entity_type ORDER BY count DESC'
    );
    const today = await db.get(
      'SELECT COUNT(*) as count FROM audit_log WHERE DATE(created_at) = DATE("now")'
    );
    
    return {
      total: total.total,
      today: today.count,
      byAction,
      byEntity
    };
  } catch (error) {
    logger.error('Error getting audit stats:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  }
};

// ============================================
// Export all functions
// ============================================

export default {
  logActivity,
  getAuditLogs,
  getAuditLogsByEntity,
  getUserActivityReport,
  cleanupOldLogs,
  getAuditStats
};