import { initDB } from '../config/database.js';
import type { AuditLog, AuditLogFilter, AuditLogResponse } from '../models/audit.model.js';

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
  try {
    const db = await initDB();
    
    await db.run(
      `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, changes, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        username || 'system',
        action,
        entityType,
        entityId || null,
        changes ? JSON.stringify(changes) : null,
        ipAddress || null,
        userAgent || null
      ]
    );
    
    console.log(`📝 Audit log: ${action} on ${entityType} by ${username}`);
  } catch (error) {
    console.error('❌ Error logging activity:', error);
  }
};

export const getAuditLogs = async (filters: AuditLogFilter): Promise<AuditLogResponse> => {
  try {
    const db = await initDB();
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

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM audit_log ${whereClause}`,
      params
    );
    const total = countResult.total;

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
    console.error('❌ Error fetching audit logs:', error);
    throw error;
  }
};

export const getAuditLogsByEntity = async (entityType: string, entityId: number): Promise<AuditLog[]> => {
  try {
    const db = await initDB();
    return await db.all(
      `SELECT * FROM audit_log 
       WHERE entity_type = ? AND entity_id = ? 
       ORDER BY created_at DESC`,
      [entityType, entityId]
    );
  } catch (error) {
    console.error('❌ Error fetching audit logs by entity:', error);
    throw error;
  }
};