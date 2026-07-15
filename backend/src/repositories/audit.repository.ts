// src/repositories/audit.repository.ts
import { getSupabase } from '../config/database.js';
import logger from '../config/logger.js';

export interface AuditLog {
  id: number;
  user_id?: number;
  username: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  changes?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AuditLogFilter {
  userId?: number;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// ============================================
// 📌 Audit Repository
// ============================================

export const AuditRepository = {
  // ✅ Create audit log
  create: async (data: Omit<AuditLog, 'id' | 'created_at'>): Promise<AuditLog> => {
    try {
      const supabase = getSupabase();

      const { data: result, error } = await supabase
        .from('audit_log')
        .insert({
          user_id: data.user_id || null,
          username: data.username || 'system',
          action: data.action,
          entity_type: data.entity_type,
          entity_id: data.entity_id || null,
          changes: data.changes ? JSON.stringify(data.changes) : null,
          ip_address: data.ip_address || null,
          user_agent: data.user_agent || null
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      logger.error('AuditRepository.create error:', error);
      throw error;
    }
  },

  // ✅ Get audit logs with filters
  findAll: async (filters: AuditLogFilter = {}): Promise<{ data: AuditLog[]; total: number }> => {
    try {
      const supabase = getSupabase();
      const { userId, action, entityType, startDate, endDate, page = 1, limit = 20 } = filters;
      const offset = (page - 1) * limit;

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

      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], total: count || 0 };
    } catch (error) {
      logger.error('AuditRepository.findAll error:', error);
      throw error;
    }
  },

  // ✅ Get audit logs by entity
  findByEntity: async (entityType: string, entityId: number): Promise<AuditLog[]> => {
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
      logger.error('AuditRepository.findByEntity error:', error);
      throw error;
    }
  },

  // ✅ Get audit statistics
  getStats: async (): Promise<any> => {
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

      const byActionResult = Array.from(actionMap.entries()).map(([action, count]) => ({
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
        byAction: byActionResult,
        byEntity
      };
    } catch (error) {
      logger.error('AuditRepository.getStats error:', error);
      throw error;
    }
  },

  // ✅ Cleanup old logs
  cleanup: async (daysToKeep: number = 365): Promise<number> => {
    try {
      const supabase = getSupabase();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const { error } = await supabase
        .from('audit_log')
        .delete()
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;
      return 0;
    } catch (error) {
      logger.error('AuditRepository.cleanup error:', error);
      throw error;
    }
  },

  // ✅ User activity report
  getUserActivity: async (userId: number, startDate: string, endDate: string): Promise<any[]> => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('AuditRepository.getUserActivity error:', error);
      throw error;
    }
  }
};

export default AuditRepository;