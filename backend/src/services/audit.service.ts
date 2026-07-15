// src/services/audit.service.ts
import { getSupabase } from '../config/database.js';
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
  setImmediate(async () => {
    try {
      const supabase = getSupabase();
      const sanitizedChanges = sanitizeChanges(changes);
      
      await supabase
        .from('audit_log')
        .insert({
          user_id: userId || null,
          username: username || 'system',
          action: action,
          entity_type: entityType,
          entity_id: entityId || null,
          changes: sanitizedChanges ? JSON.stringify(sanitizedChanges) : null,
          ip_address: ipAddress || null,
          user_agent: userAgent || null
        });
      
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
    const supabase = getSupabase();
    const { userId, action, entityType, startDate, endDate, page = 1, limit = 20 } = filters;
    
    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' });

    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (action) {
      query = query.eq('action', action);
    }
    if (entityType) {
      query = query.eq('entity_type', entityType);
    }
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }

    const offset = (page - 1) * limit;
    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
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
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
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
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('audit_log')
      .select('action, created_at, entity_type')
      .eq('user_id', userId)
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
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
    const supabase = getSupabase();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const { error } = await supabase
      .from('audit_log')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) throw error;
    
    logger.info(`Cleaned up old audit logs`);
    return 0;
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
    const supabase = getSupabase();
    
    // Total count
    const { count: total, error: totalError } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    // Today's count
    const today = new Date().toISOString().split('T')[0];
    const { count: todayCount, error: todayError } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today);

    if (todayError) throw todayError;

    // By action - get all logs and group manually
    const { data: allLogs, error: logsError } = await supabase
      .from('audit_log')
      .select('action');

    if (logsError) throw logsError;

    const actionMap = new Map();
    for (const log of allLogs || []) {
      actionMap.set(log.action, (actionMap.get(log.action) || 0) + 1);
    }

    const byAction = Array.from(actionMap.entries()).map(([action, count]) => ({
      action,
      count
    })).sort((a, b) => b.count - a.count);

    // By entity type
    const { data: entityLogs, error: entityError } = await supabase
      .from('audit_log')
      .select('entity_type');

    if (entityError) throw entityError;

    const entityMap = new Map();
    for (const log of entityLogs || []) {
      entityMap.set(log.entity_type, (entityMap.get(log.entity_type) || 0) + 1);
    }

    const byEntity = Array.from(entityMap.entries()).map(([entity_type, count]) => ({
      entity_type,
      count
    })).sort((a, b) => b.count - a.count);

    return {
      total: total || 0,
      today: todayCount || 0,
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