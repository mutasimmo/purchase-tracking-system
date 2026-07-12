// controllers/purchase.controller.ts
import { Request, Response } from 'express';
import { getDB } from '../config/database.js';
import { logActivity } from '../services/audit.service.js';
import logger from '../config/logger.js';
import { 
  ValidationError, 
  NotFoundError, 
  AuthorizationError,
  ConflictError 
} from '../types/errors.js';
import { Cache, CacheKeys, getOrSet } from '../utils/cache.js';

// ============================================
// Types
// ============================================

interface PurchaseValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
}

// ============================================
// Validation Functions
// ============================================

const validatePurchase = (data: any): PurchaseValidationResult => {
  const errors: { field: string; message: string }[] = [];
  
  if (!data.request_number || data.request_number.length < 1) {
    errors.push({ field: 'request_number', message: 'Request number is required' });
  }
  if (!data.date) {
    errors.push({ field: 'date', message: 'Date is required' });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push({ field: 'date', message: 'Invalid date format (YYYY-MM-DD)' });
  }
  if (!data.requester || data.requester.length < 1) {
    errors.push({ field: 'requester', message: 'Requester is required' });
  }
  if (!data.description || data.description.length < 1) {
    errors.push({ field: 'description', message: 'Description is required' });
  }
  if (!data.receiver || data.receiver.length < 1) {
    errors.push({ field: 'receiver', message: 'Receiver is required' });
  }
  if (!data.delivery_date) {
    errors.push({ field: 'delivery_date', message: 'Delivery date is required' });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.delivery_date)) {
    errors.push({ field: 'delivery_date', message: 'Invalid date format (YYYY-MM-DD)' });
  }
  
  if (data.date && data.delivery_date && data.delivery_date < data.date) {
    errors.push({ field: 'delivery_date', message: 'Delivery date must be after request date' });
  }
  
  return { valid: errors.length === 0, errors };
};

// ============================================
// Get All Purchases with Filtering and Pagination
// ============================================

export const getAllPurchases = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    const { 
      status, 
      startDate, 
      endDate, 
      search,
      page = '1',
      limit = '10',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    // Convert query params
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;

    let whereClause = 'WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (status && status !== 'all' && status !== '') {
      whereClause += ' AND status = ?';
      params.push(status);
    }
    
    if (startDate && startDate !== '') {
      whereClause += ' AND date >= ?';
      params.push(startDate);
    }
    
    if (endDate && endDate !== '') {
      whereClause += ' AND date <= ?';
      params.push(endDate);
    }
    
    if (search && search !== '') {
      whereClause += ' AND (request_number LIKE ? OR requester LIKE ? OR description LIKE ? OR receiver LIKE ? OR notes LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const validSortColumns = ['created_at', 'date', 'delivery_date', 'status', 'requester', 'request_number'];
    const sortColumn = validSortColumns.includes(sortBy as string) ? sortBy : 'created_at';
    const sortOrderValue = (sortOrder as string).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM purchases ${whereClause}`,
      params
    );
    const total = countResult.total;

    const offset = (pageNum - 1) * limitNum;
    const query = `
      SELECT * FROM purchases 
      ${whereClause} 
      ORDER BY ${sortColumn} ${sortOrderValue}
      LIMIT ? OFFSET ?
    `;
    
    const purchases = await db.all(query, [...params, limitNum, offset]);

    res.json({
      data: purchases,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error fetching purchases:', error);
    res.status(500).json({ 
      error: 'Failed to fetch purchases',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Get Purchase by ID
// ============================================

export const getPurchaseById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = await getDB();
    
    const purchase = await getOrSet(
      CacheKeys.PURCHASE(parseInt(id)),
      async () => {
        return await db.get(
          'SELECT * FROM purchases WHERE id = ? AND deleted_at IS NULL',
          [id]
        );
      }
    );
    
    if (!purchase) {
      throw new NotFoundError('Purchase not found');
    }
    
    res.json(purchase);
  } catch (error) {
    logger.error('Error fetching purchase:', error);
    
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch purchase',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Create New Purchase
// ============================================

export const createPurchase = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    const user = (req as any).user;
    const { request_number, date, requester, description, receiver, delivery_date, status, notes } = req.body;

    const validation = validatePurchase(req.body);
    if (!validation.valid) {
      throw new ValidationError('Validation failed', validation.errors);
    }

    const existing = await db.get(
      'SELECT id FROM purchases WHERE request_number = ? AND deleted_at IS NULL',
      [request_number]
    );
    if (existing) {
      throw new ConflictError('Request number already exists');
    }

    if (delivery_date < date) {
      throw new ValidationError('Delivery date must be after request date');
    }

    const result = await db.run(
      `INSERT INTO purchases (request_number, date, requester, description, receiver, delivery_date, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request_number, 
        date, 
        requester, 
        description, 
        receiver, 
        delivery_date, 
        status || 'قيد التنفيذ', 
        notes || '',
        user?.id || null
      ]
    );
    
    const newPurchase = await db.get(
      'SELECT * FROM purchases WHERE id = ?',
      [result.lastID]
    );

    await logActivity(
      user?.id,
      user?.username || 'system',
      'PURCHASE_CREATE',
      'purchase',
      result.lastID,
      newPurchase,
      req.ip,
      req.headers['user-agent']
    );

    Cache.delPrefix('dashboard:stats');
    Cache.delPrefix('alerts:');

    res.status(201).json(newPurchase);
  } catch (error) {
    logger.error('Error creating purchase:', error);
    
    if (error instanceof ValidationError || error instanceof ConflictError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error instanceof ValidationError ? error.errors : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to create purchase',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Update Purchase
// ============================================

export const updatePurchase = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    const user = (req as any).user;
    const { id } = req.params;
    const { request_number, date, requester, description, receiver, delivery_date, status, notes } = req.body;

    const existing = await db.get(
      'SELECT * FROM purchases WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing) {
      throw new NotFoundError('Purchase not found');
    }

    if (user.role !== 'admin' && user.role !== 'super_admin' && existing.requester !== user.username) {
      throw new AuthorizationError('You can only update your own purchases');
    }

    if (status && status !== existing.status && user.role !== 'admin' && user.role !== 'super_admin') {
      throw new AuthorizationError('Only admins can change status');
    }

    const validation = validatePurchase(req.body);
    if (!validation.valid) {
      throw new ValidationError('Validation failed', validation.errors);
    }

    const duplicate = await db.get(
      'SELECT id FROM purchases WHERE request_number = ? AND id != ? AND deleted_at IS NULL',
      [request_number, id]
    );
    if (duplicate) {
      throw new ConflictError('Request number already used by another purchase');
    }

    if (delivery_date < date) {
      throw new ValidationError('Delivery date must be after request date');
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (request_number) { updates.push('request_number = ?'); params.push(request_number); }
    if (date) { updates.push('date = ?'); params.push(date); }
    if (requester) { updates.push('requester = ?'); params.push(requester); }
    if (description) { updates.push('description = ?'); params.push(description); }
    if (receiver) { updates.push('receiver = ?'); params.push(receiver); }
    if (delivery_date) { updates.push('delivery_date = ?'); params.push(delivery_date); }
    if (status) { updates.push('status = ?'); params.push(status); }
    if (notes !== undefined) { updates.push('notes = ?'); params.push(notes); }

    if (updates.length === 0) {
      throw new ValidationError('No valid fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await db.run(
      `UPDATE purchases SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    
    const updated = await db.get(
      'SELECT * FROM purchases WHERE id = ?',
      [id]
    );

    await logActivity(
      user.id,
      user.username,
      'PURCHASE_UPDATE',
      'purchase',
      parseInt(id),
      { old: existing, new: updated },
      req.ip,
      req.headers['user-agent']
    );

    Cache.del(CacheKeys.PURCHASE(parseInt(id)));
    Cache.delPrefix('dashboard:stats');
    Cache.delPrefix('alerts:');

    res.json(updated);
  } catch (error) {
    logger.error('Error updating purchase:', error);
    
    if (error instanceof ValidationError || 
        error instanceof NotFoundError || 
        error instanceof AuthorizationError ||
        error instanceof ConflictError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error instanceof ValidationError ? error.errors : undefined
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to update purchase',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Delete Purchase (Soft Delete)
// ============================================

export const deletePurchase = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    const user = (req as any).user;
    const { id } = req.params;

    const existing = await db.get(
      'SELECT * FROM purchases WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing) {
      throw new NotFoundError('Purchase not found');
    }

    if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'manager') {
      throw new AuthorizationError('Only admins and managers can delete purchases');
    }

    if (user.role === 'manager' && existing.requester !== user.username) {
      throw new AuthorizationError('You can only delete your own purchases');
    }

    await db.run(
      'UPDATE purchases SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );

    await logActivity(
      user.id,
      user.username,
      'PURCHASE_DELETE',
      'purchase',
      parseInt(id),
      existing,
      req.ip,
      req.headers['user-agent']
    );

    Cache.del(CacheKeys.PURCHASE(parseInt(id)));
    Cache.delPrefix('dashboard:stats');
    Cache.delPrefix('alerts:');

    res.status(200).json({ 
      success: true, 
      message: 'Purchase deleted successfully' 
    });
  } catch (error) {
    logger.error('Delete error:', error);
    
    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to delete purchase',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Dashboard Statistics
// ============================================

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    const stats = await getOrSet(
      CacheKeys.DASHBOARD_STATS(user.id),
      async () => {
        const db = await getDB();
        
        const statsResult = await db.get(`
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN status = 'منجز' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'قيد التنفيذ' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'ملغي' THEN 1 ELSE 0 END) as cancelled,
            SUM(CASE WHEN status = 'معلق' THEN 1 ELSE 0 END) as inProgress,
            SUM(CASE WHEN delivery_date < date('now') AND status != 'منجز' AND status != 'ملغي' AND deleted_at IS NULL THEN 1 ELSE 0 END) as delayed,
            SUM(CASE WHEN delivery_date < date('now', '-2 days') AND status != 'منجز' AND status != 'ملغي' AND deleted_at IS NULL THEN 1 ELSE 0 END) as overdue,
            SUM(CASE WHEN date(delivery_date) = date('now', '+1 day') AND status != 'منجز' AND status != 'ملغي' AND deleted_at IS NULL THEN 1 ELSE 0 END) as expiringToday,
            SUM(CASE WHEN date(delivery_date) BETWEEN date('now', '+2 day') AND date('now', '+4 day') AND status != 'منجز' AND status != 'ملغي' AND deleted_at IS NULL THEN 1 ELSE 0 END) as expiringSoon,
            ROUND(100.0 * SUM(CASE WHEN status = 'منجز' THEN 1 ELSE 0 END) / COUNT(*), 2) as completionRate,
            ROUND(100.0 * SUM(CASE WHEN delivery_date >= date('now') AND status = 'منجز' THEN 1 ELSE 0 END) / NULLIF(SUM(CASE WHEN status = 'منجز' THEN 1 ELSE 0 END), 0), 2) as onTimeRate
          FROM purchases 
          WHERE deleted_at IS NULL
        `);

        const byStatus = await db.all(`
          SELECT 
            status, 
            COUNT(*) as count,
            ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM purchases WHERE deleted_at IS NULL), 2) as percentage
          FROM purchases 
          WHERE deleted_at IS NULL
          GROUP BY status
          ORDER BY count DESC
        `);

        const byRequester = await db.all(`
          SELECT 
            requester, 
            COUNT(*) as count,
            ROUND(100.0 * COUNT(*) / (SELECT COUNT(*) FROM purchases WHERE deleted_at IS NULL), 2) as percentage
          FROM purchases 
          WHERE deleted_at IS NULL
          GROUP BY requester 
          ORDER BY count DESC 
          LIMIT 5
        `);

        const monthlyTrend = await db.all(`
          SELECT 
            strftime('%Y-%m', date) as month,
            COUNT(*) as count,
            SUM(CASE WHEN status = 'منجز' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status != 'منجز' AND status != 'ملغي' THEN 1 ELSE 0 END) as pending
          FROM purchases 
          WHERE date >= date('now', '-6 months') AND deleted_at IS NULL
          GROUP BY month 
          ORDER BY month
        `);

        return {
          ...statsResult,
          byStatus: byStatus || [],
          byRequester: byRequester || [],
          monthlyTrend: monthlyTrend || []
        };
      },
      300
    );

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Advanced Search with Pagination
// ============================================

export const searchPurchases = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    const { q, status, from, to, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;

    let whereClause = 'WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (q && q !== '') {
      whereClause += ' AND (request_number LIKE ? OR requester LIKE ? OR description LIKE ? OR receiver LIKE ? OR notes LIKE ?)';
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    if (status && status !== '' && status !== 'all') {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (from && from !== '') {
      whereClause += ' AND date >= ?';
      params.push(from);
    }

    if (to && to !== '') {
      whereClause += ' AND date <= ?';
      params.push(to);
    }

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM purchases ${whereClause}`,
      params
    );
    const total = countResult.total;

    const offset = (pageNum - 1) * limitNum;
    const query = `
      SELECT * FROM purchases 
      ${whereClause} 
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;
    params.push(limitNum, offset);

    const results = await db.all(query, params);

    res.json({
      data: results,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error searching purchases:', error);
    res.status(500).json({ 
      error: 'Failed to search purchases',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Update Purchase Status
// ============================================

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    const user = (req as any).user;
    const { status } = req.body;
    const { id } = req.params;

    const validStatuses = ['قيد التنفيذ', 'منجز', 'معلق', 'ملغي'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError('Invalid status', [`Status must be one of: ${validStatuses.join(', ')}`]);
    }

    const existing = await db.get(
      'SELECT * FROM purchases WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    if (!existing) {
      throw new NotFoundError('Purchase not found');
    }

    if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'manager') {
      throw new AuthorizationError('Only admins and managers can change status');
    }

    if (user.role === 'manager' && existing.requester !== user.username) {
      throw new AuthorizationError('You can only change status of your own purchases');
    }

    if (existing.status === 'منجز' || existing.status === 'ملغي') {
      throw new ValidationError('Cannot change status of completed or cancelled purchases');
    }

    await db.run(
      'UPDATE purchases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    const updated = await db.get(
      'SELECT * FROM purchases WHERE id = ?',
      [id]
    );

    await logActivity(
      user.id,
      user.username,
      'PURCHASE_STATUS_CHANGE',
      'purchase',
      parseInt(id),
      { oldStatus: existing.status, newStatus: status },
      req.ip,
      req.headers['user-agent']
    );

    Cache.del(CacheKeys.PURCHASE(parseInt(id)));
    Cache.delPrefix('dashboard:stats');
    Cache.delPrefix('alerts:');

    res.json({
      success: true,
      purchase: updated,
      message: `Status changed from ${existing.status} to ${status}`
    });
  } catch (error) {
    logger.error('Error updating status:', error);

    if (error instanceof ValidationError || 
        error instanceof NotFoundError || 
        error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error instanceof ValidationError ? error.errors : undefined
      });
    }

    res.status(500).json({ 
      error: 'Failed to update status',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Export Purchases
// ============================================

export const exportPurchases = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    const user = (req as any).user;
    const { status, from, to } = req.query;

    if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'manager') {
      throw new AuthorizationError('Only admins and managers can export purchases');
    }

    let query = 'SELECT * FROM purchases WHERE deleted_at IS NULL';
    const params: any[] = [];

    if (status && status !== '' && status !== 'all') {
      query += ' AND status = ?';
      params.push(status);
    }

    if (from && from !== '') {
      query += ' AND date >= ?';
      params.push(from);
    }

    if (to && to !== '') {
      query += ' AND date <= ?';
      params.push(to);
    }

    query += ' ORDER BY created_at DESC';

    const purchases = await db.all(query, params);

    await logActivity(
      user.id,
      user.username,
      'PURCHASE_EXPORT',
      'purchase',
      undefined,
      { count: purchases.length, filters: { status, from, to } },
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      count: purchases.length,
      data: purchases,
      exportedAt: new Date().toISOString(),
      exportedBy: user.username
    });
  } catch (error) {
    logger.error('Error exporting purchases:', error);

    if (error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({ 
      error: 'Failed to export purchases',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Overdue Purchases
// ============================================

export const getOverduePurchases = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    
    const overdue = await getOrSet(
      CacheKeys.OVERDUE_PURCHASES(),
      async () => {
        return await db.all(`
          SELECT 
            *,
            julianday('now') - julianday(delivery_date) as days_overdue,
            CASE 
              WHEN julianday('now') - julianday(delivery_date) >= 7 THEN 'حرج'
              WHEN julianday('now') - julianday(delivery_date) >= 2 THEN 'متأخر'
              WHEN julianday('now') - julianday(delivery_date) >= 1 THEN 'ينتهي اليوم'
              ELSE 'قريب'
            END as alert_level
          FROM purchases 
          WHERE delivery_date < date('now', '-1 days') 
            AND status != 'منجز'
            AND status != 'ملغي'
            AND deleted_at IS NULL
          ORDER BY delivery_date ASC
        `);
      },
      60
    );

    res.json(overdue);
  } catch (error) {
    logger.error('Error fetching overdue purchases:', error);
    res.status(500).json({ 
      error: 'Failed to fetch overdue purchases',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Purchases Expiring Today
// ============================================

export const getExpiringToday = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    
    const expiring = await getOrSet(
      CacheKeys.EXPIRING_TODAY(),
      async () => {
        return await db.all(`
          SELECT 
            *,
            julianday(delivery_date) - julianday('now') as days_remaining,
            'ينتهي اليوم' as alert_level
          FROM purchases 
          WHERE date(delivery_date) = date('now', '+1 day')
            AND status != 'منجز'
            AND status != 'ملغي'
            AND deleted_at IS NULL
          ORDER BY delivery_date ASC
        `);
      },
      60
    );

    res.json(expiring);
  } catch (error) {
    logger.error('Error fetching expiring purchases:', error);
    res.status(500).json({ 
      error: 'Failed to fetch expiring purchases',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Alert Statistics
// ============================================

export const getAlertStats = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    
    const stats = await getOrSet(
      CacheKeys.ALERT_STATS(),
      async () => {
        const overdueCount = await db.get(`
          SELECT COUNT(*) as count 
          FROM purchases 
          WHERE delivery_date < date('now', '-1 days') 
            AND status != 'منجز'
            AND status != 'ملغي'
            AND deleted_at IS NULL
        `);

        const expiringCount = await db.get(`
          SELECT COUNT(*) as count 
          FROM purchases 
          WHERE date(delivery_date) = date('now', '+1 day')
            AND status != 'منجز'
            AND status != 'ملغي'
            AND deleted_at IS NULL
        `);

        const expiringSoonCount = await db.get(`
          SELECT COUNT(*) as count 
          FROM purchases 
          WHERE date(delivery_date) BETWEEN date('now', '+2 day') AND date('now', '+4 day')
            AND status != 'منجز'
            AND status != 'ملغي'
            AND deleted_at IS NULL
        `);

        const mostOverdue = await db.all(`
          SELECT 
            id,
            request_number,
            requester,
            description,
            delivery_date,
            status,
            julianday('now') - julianday(delivery_date) as days_overdue
          FROM purchases 
          WHERE delivery_date < date('now', '-1 days') 
            AND status != 'منجز'
            AND status != 'ملغي'
            AND deleted_at IS NULL
          ORDER BY delivery_date ASC
          LIMIT 5
        `);

        return {
          overdue: overdueCount?.count || 0,
          expiringToday: expiringCount?.count || 0,
          expiringSoon: expiringSoonCount?.count || 0,
          mostOverdue: mostOverdue || []
        };
      },
      60
    );

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching alert stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch alert statistics',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Audit Logs
// ============================================

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const { userId, action, entityType, startDate, endDate, page = '1', limit = '20' } = req.query;
    
    const { getAuditLogs } = await import('../services/audit.service.js');
    const result = await getAuditLogs({
      userId: userId ? parseInt(userId as string, 10) : undefined,
      action: action as string,
      entityType: entityType as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: parseInt(page as string, 10),
      limit: parseInt(limit as string, 10)
    });
    
    res.json(result);
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({ 
      error: 'Failed to fetch audit logs',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Audit Logs by Purchase
// ============================================

export const getAuditLogsByPurchase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { getAuditLogsByEntity } = await import('../services/audit.service.js');
    const logs = await getAuditLogsByEntity('purchase', parseInt(id, 10));
    res.json(logs);
  } catch (error) {
    logger.error('Error fetching audit logs by purchase:', error);
    res.status(500).json({ 
      error: 'Failed to fetch audit logs',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Restore Deleted Purchase (Admin Only)
// ============================================

export const restorePurchase = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    const user = (req as any).user;
    const { id } = req.params;

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      throw new AuthorizationError('Only admins can restore purchases');
    }

    const existing = await db.get(
      'SELECT * FROM purchases WHERE id = ? AND deleted_at IS NOT NULL',
      [id]
    );
    if (!existing) {
      throw new NotFoundError('Deleted purchase not found');
    }

    await db.run(
      'UPDATE purchases SET deleted_at = NULL WHERE id = ?',
      [id]
    );

    const restored = await db.get(
      'SELECT * FROM purchases WHERE id = ?',
      [id]
    );

    await logActivity(
      user.id,
      user.username,
      'PURCHASE_RESTORE',
      'purchase',
      parseInt(id, 10),
      restored,
      req.ip,
      req.headers['user-agent']
    );

    Cache.del(CacheKeys.PURCHASE(parseInt(id, 10)));
    Cache.delPrefix('dashboard:stats');

    res.json({
      success: true,
      purchase: restored,
      message: 'Purchase restored successfully'
    });
  } catch (error) {
    logger.error('Error restoring purchase:', error);

    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({ 
      error: 'Failed to restore purchase',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Get Deleted Purchases (Admin Only)
// ============================================

export const getDeletedPurchases = async (req: Request, res: Response) => {
  try {
    const db = await getDB();
    const user = (req as any).user;

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      throw new AuthorizationError('Only admins can view deleted purchases');
    }

    const purchases = await db.all(`
      SELECT * FROM purchases 
      WHERE deleted_at IS NOT NULL
      ORDER BY deleted_at DESC
    `);

    res.json(purchases);
  } catch (error) {
    logger.error('Error fetching deleted purchases:', error);

    if (error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({ 
      error: 'Failed to fetch deleted purchases',
      code: 'SERVER_ERROR'
    });
  }
};