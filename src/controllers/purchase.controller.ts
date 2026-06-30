import { Request, Response } from 'express';
import { initDB } from '../config/database.js';
import { Purchase, PurchaseFilters, PurchaseResponse } from '../models/purchase.model.js';
import { logActivity } from '../services/audit.service.js';

// جلب جميع الطلبات مع فلترة وترقيم صفحات (محسنة)
export const getAllPurchases = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    const { 
      status, 
      startDate, 
      endDate, 
      search,
      page = 1,
      limit = 10 
    } = req.query as any;
    
    console.log('🔍 Backend Filters:', { status, startDate, endDate, search, page, limit });
    
    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (status && status !== '') {
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

    const countResult = await db.get(
      `SELECT COUNT(*) as total FROM purchases ${whereClause}`,
      params
    );
    const total = countResult.total;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const query = `
      SELECT * FROM purchases 
      ${whereClause} 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const purchases = await db.all(query, [...params, parseInt(limit), offset]);
    
    console.log(`✅ Found ${purchases.length} results out of ${total} total`);
    
    const response: PurchaseResponse = {
      data: purchases,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    };

    res.json(response);
  } catch (error) {
    console.error('❌ Error fetching purchases:', error);
    res.status(500).json({ 
      error: 'Failed to fetch purchases',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// جلب طلب محدد بواسطة ID
export const getPurchaseById = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    const purchase = await db.get('SELECT * FROM purchases WHERE id = ?', req.params.id);
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    res.json(purchase);
  } catch (error) {
    console.error('❌ Error fetching purchase:', error);
    res.status(500).json({ 
      error: 'Failed to fetch purchase',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// إضافة طلب جديد (مع تتبع)
export const createPurchase = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    const { request_number, date, requester, description, receiver, delivery_date, status, notes } = req.body;
    
    console.log('📝 Creating purchase:', req.body);
    
    const existing = await db.get('SELECT id FROM purchases WHERE request_number = ?', request_number);
    if (existing) {
      return res.status(400).json({ error: 'Request number already exists' });
    }

    const result = await db.run(
      `INSERT INTO purchases (request_number, date, requester, description, receiver, delivery_date, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        request_number, 
        date, 
        requester, 
        description, 
        receiver, 
        delivery_date, 
        status || 'قيد التنفيذ', 
        notes || ''
      ]
    );
    
    const newPurchase = await db.get('SELECT * FROM purchases WHERE id = ?', result.lastID);
    
    // تسجيل في سجل التتبع
    const userId = (req as any).user?.id;
    const username = (req as any).user?.username || 'system';
    await logActivity(
      userId,
      username,
      'CREATE',
      'purchase',
      result.lastID,
      newPurchase,
      req.ip,
      req.headers['user-agent']
    );
    
    console.log('✅ Create result:', result);
    res.status(201).json(newPurchase);
  } catch (error) {
    console.error('❌ Error creating purchase:', error);
    res.status(500).json({ 
      error: 'Failed to create purchase',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// تحديث طلب (مع تتبع)
export const updatePurchase = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    const { request_number, date, requester, description, receiver, delivery_date, status, notes } = req.body;
    
    console.log('📝 Updating purchase:', { id: req.params.id, ...req.body });
    
    const existing = await db.get('SELECT * FROM purchases WHERE id = ?', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const duplicate = await db.get(
      'SELECT id FROM purchases WHERE request_number = ? AND id != ?',
      [request_number, req.params.id]
    );
    if (duplicate) {
      return res.status(400).json({ error: 'Request number already used by another purchase' });
    }

    await db.run(
      `UPDATE purchases SET 
        request_number = ?, 
        date = ?, 
        requester = ?, 
        description = ?, 
        receiver = ?, 
        delivery_date = ?, 
        status = ?,
        notes = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        request_number, 
        date, 
        requester, 
        description, 
        receiver, 
        delivery_date, 
        status || 'قيد التنفيذ', 
        notes || '', 
        req.params.id
      ]
    );
    
    const updated = await db.get('SELECT * FROM purchases WHERE id = ?', req.params.id);
    
    // تسجيل في سجل التتبع
    const userId = (req as any).user?.id;
    const username = (req as any).user?.username || 'system';
    await logActivity(
      userId,
      username,
      'UPDATE',
      'purchase',
      parseInt(req.params.id),
      { old: existing, new: updated },
      req.ip,
      req.headers['user-agent']
    );
    
    console.log('✅ Purchase updated successfully');
    res.json(updated);
  } catch (error) {
    console.error('❌ Error updating purchase:', error);
    res.status(500).json({ 
      error: 'Failed to update purchase',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// حذف طلب (مع تتبع)
export const deletePurchase = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    
    const existing = await db.get('SELECT * FROM purchases WHERE id = ?', req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    await db.run('DELETE FROM purchases WHERE id = ?', req.params.id);
    
    // تسجيل في سجل التتبع
    const userId = (req as any).user?.id;
    const username = (req as any).user?.username || 'system';
    await logActivity(
      userId,
      username,
      'DELETE',
      'purchase',
      parseInt(req.params.id),
      existing,
      req.ip,
      req.headers['user-agent']
    );
    
    res.status(204).send();
  } catch (error) {
    console.error('❌ Error deleting purchase:', error);
    res.status(500).json({ 
      error: 'Failed to delete purchase',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// ============================================
// 🆕 دوال الإحصائيات والتقارير
// ============================================

// جلب إحصائيات لوحة التحكم
export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    
    console.log('📊 Fetching dashboard statistics...');
    
    const totalResult = await db.get('SELECT COUNT(*) as total FROM purchases');
    const total = totalResult.total;
    
    const completedResult = await db.get("SELECT COUNT(*) as count FROM purchases WHERE status = 'منجز'");
    const pendingResult = await db.get("SELECT COUNT(*) as count FROM purchases WHERE status = 'قيد التنفيذ'");
    const cancelledResult = await db.get("SELECT COUNT(*) as count FROM purchases WHERE status = 'ملغي'");
    const inProgressResult = await db.get("SELECT COUNT(*) as count FROM purchases WHERE status = 'قيد التنفيذ'");
    
    const delayedResult = await db.get(`
      SELECT COUNT(*) as count 
      FROM purchases 
      WHERE delivery_date < date('now') AND status != 'منجز'
    `);
    
    // إحصائيات التنبيهات
    const overdueResult = await db.get(`
      SELECT COUNT(*) as count 
      FROM purchases 
      WHERE delivery_date < date('now', '-2 days') 
        AND status != 'منجز'
        AND status != 'ملغي'
    `);
    
    const expiringTodayResult = await db.get(`
      SELECT COUNT(*) as count 
      FROM purchases 
      WHERE date(delivery_date) = date('now', '+1 day')
        AND status != 'منجز'
        AND status != 'ملغي'
    `);
    
    const expiringSoonResult = await db.get(`
      SELECT COUNT(*) as count 
      FROM purchases 
      WHERE date(delivery_date) BETWEEN date('now', '+2 day') AND date('now', '+4 day')
        AND status != 'منجز'
        AND status != 'ملغي'
    `);
    
    const byStatus = await db.all(`
      SELECT status, COUNT(*) as count 
      FROM purchases 
      GROUP BY status
      ORDER BY count DESC
    `);
    
    const byRequester = await db.all(`
      SELECT requester, COUNT(*) as count 
      FROM purchases 
      GROUP BY requester 
      ORDER BY count DESC 
      LIMIT 5
    `);
    
    const monthlyTrend = await db.all(`
      SELECT 
        strftime('%Y-%m', date) as month,
        COUNT(*) as count 
      FROM purchases 
      WHERE date >= date('now', '-6 months')
      GROUP BY month 
      ORDER BY month
    `);
    
    const stats = {
      total,
      completed: completedResult.count || 0,
      pending: pendingResult.count || 0,
      cancelled: cancelledResult.count || 0,
      inProgress: inProgressResult.count || 0,
      delayed: delayedResult.count || 0,
      overdue: overdueResult.count || 0,
      expiringToday: expiringTodayResult.count || 0,
      expiringSoon: expiringSoonResult.count || 0,
      byStatus,
      byRequester,
      monthlyTrend
    };
    
    console.log('✅ Dashboard statistics fetched successfully');
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// بحث متقدم
export const searchPurchases = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    const { q, status, from, to } = req.query;
    
    console.log('🔍 Advanced search:', { q, status, from, to });
    
    let query = 'SELECT * FROM purchases WHERE 1=1';
    const params: any[] = [];
    
    if (q && q !== '') {
      query += ' AND (request_number LIKE ? OR requester LIKE ? OR description LIKE ? OR receiver LIKE ? OR notes LIKE ?)';
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    
    if (status && status !== '') {
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
    
    const results = await db.all(query, params);
    console.log(`✅ Found ${results.length} search results`);
    res.json(results);
  } catch (error) {
    console.error('❌ Error searching purchases:', error);
    res.status(500).json({ 
      error: 'Failed to search purchases',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// تحديث حالة الطلب فقط
export const updateStatus = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    const { status } = req.body;
    const { id } = req.params;
    
    console.log(`🔄 Updating status for purchase ${id} to ${status}`);
    
    const existing = await db.get('SELECT * FROM purchases WHERE id = ?', id);
    if (!existing) {
      return res.status(404).json({ error: 'Purchase not found' });
    }
    
    const validStatuses = ['قيد التنفيذ', 'منجز', 'معلق', 'ملغي'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    await db.run(
      'UPDATE purchases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );
    
    const updated = await db.get('SELECT * FROM purchases WHERE id = ?', id);
    
    // تسجيل في سجل التتبع
    const userId = (req as any).user?.id;
    const username = (req as any).user?.username || 'system';
    await logActivity(
      userId,
      username,
      'UPDATE',
      'purchase',
      parseInt(id),
      { old: existing, new: updated },
      req.ip,
      req.headers['user-agent']
    );
    
    console.log('✅ Status updated successfully');
    res.json(updated);
  } catch (error) {
    console.error('❌ Error updating status:', error);
    res.status(500).json({ 
      error: 'Failed to update status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// تصدير جميع الطلبات
export const exportPurchases = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    const { status, from, to } = req.query;
    
    console.log('📤 Exporting purchases...', { status, from, to });
    
    let query = 'SELECT * FROM purchases WHERE 1=1';
    const params: any[] = [];
    
    if (status && status !== '') {
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
    console.log(`✅ Exported ${purchases.length} purchases`);
    res.json(purchases);
  } catch (error) {
    console.error('❌ Error exporting purchases:', error);
    res.status(500).json({ 
      error: 'Failed to export purchases',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// ============================================
// 🔔 دوال التنبيهات والإشعارات
// ============================================

// جلب الطلبات المتأخرة
export const getOverduePurchases = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    
    const overdue = await db.all(`
      SELECT 
        *,
        julianday('now') - julianday(delivery_date) as days_overdue,
        CASE 
          WHEN julianday('now') - julianday(delivery_date) >= 2 THEN 'متأخر'
          WHEN julianday('now') - julianday(delivery_date) >= 1 THEN 'ينتهي اليوم'
          ELSE 'قريب'
        END as alert_level
      FROM purchases 
      WHERE delivery_date < date('now', '-2 days') 
        AND status != 'منجز'
        AND status != 'ملغي'
      ORDER BY delivery_date ASC
    `);
    
    console.log(`🔔 Found ${overdue.length} overdue purchases`);
    res.json(overdue);
  } catch (error) {
    console.error('❌ Error fetching overdue purchases:', error);
    res.status(500).json({ error: 'Failed to fetch overdue purchases' });
  }
};

// جلب الطلبات التي ستنتهي خلال 24 ساعة
export const getExpiringToday = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    
    const expiring = await db.all(`
      SELECT 
        *,
        julianday(delivery_date) - julianday('now') as days_remaining,
        'ينتهي اليوم' as alert_level
      FROM purchases 
      WHERE date(delivery_date) = date('now', '+1 day')
        AND status != 'منجز'
        AND status != 'ملغي'
      ORDER BY delivery_date ASC
    `);
    
    console.log(`⏰ Found ${expiring.length} purchases expiring today`);
    res.json(expiring);
  } catch (error) {
    console.error('❌ Error fetching expiring purchases:', error);
    res.status(500).json({ error: 'Failed to fetch expiring purchases' });
  }
};

// جلب إحصائيات التنبيهات
export const getAlertStats = async (req: Request, res: Response) => {
  try {
    const db = await initDB();
    
    const overdueCount = await db.get(`
      SELECT COUNT(*) as count 
      FROM purchases 
      WHERE delivery_date < date('now', '-2 days') 
        AND status != 'منجز'
        AND status != 'ملغي'
    `);
    
    const expiringCount = await db.get(`
      SELECT COUNT(*) as count 
      FROM purchases 
      WHERE date(delivery_date) = date('now', '+1 day')
        AND status != 'منجز'
        AND status != 'ملغي'
    `);
    
    const expiringSoonCount = await db.get(`
      SELECT COUNT(*) as count 
      FROM purchases 
      WHERE date(delivery_date) BETWEEN date('now', '+2 day') AND date('now', '+4 day')
        AND status != 'منجز'
        AND status != 'ملغي'
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
      WHERE delivery_date < date('now', '-2 days') 
        AND status != 'منجز'
        AND status != 'ملغي'
      ORDER BY delivery_date ASC
      LIMIT 5
    `);
    
    const stats = {
      overdue: overdueCount.count || 0,
      expiringToday: expiringCount.count || 0,
      expiringSoon: expiringSoonCount.count || 0,
      mostOverdue
    };
    
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching alert stats:', error);
    res.status(500).json({ error: 'Failed to fetch alert statistics' });
  }
};

// ============================================
// 📝 دوال سجل التتبع (Audit Log)
// ============================================

// جلب سجل التتبع
export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const { userId, action, entityType, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const { getAuditLogs } = await import('../services/audit.service.js');
    const result = await getAuditLogs({
      userId: userId ? parseInt(userId as string) : undefined,
      action: action as string,
      entityType: entityType as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: parseInt(page as string),
      limit: parseInt(limit as string)
    });
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};

// جلب سجل التتبع لطلب محدد
export const getAuditLogsByPurchase = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { getAuditLogsByEntity } = await import('../services/audit.service.js');
    const logs = await getAuditLogsByEntity('purchase', parseInt(id));
    res.json(logs);
  } catch (error) {
    console.error('❌ Error fetching audit logs by purchase:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
};