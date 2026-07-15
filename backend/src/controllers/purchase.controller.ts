// src/controllers/purchase.controller.ts
import { Request, Response } from 'express';
import { getSupabase } from '../config/database.js';
import { logActivity } from '../services/audit.service.js';
import logger from '../config/logger.js';
import { 
  ValidationError, 
  NotFoundError, 
  AuthorizationError,
  ConflictError 
} from '../types/errors.js';
import { Cache, CacheKeys, getOrSet } from '../utils/cache.js';
import PurchaseRepository from '../repositories/purchase.repository.js';

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

    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;

    const result = await PurchaseRepository.findAll({
      status: status as string,
      startDate: startDate as string,
      endDate: endDate as string,
      search: search as string,
      page: pageNum,
      limit: limitNum,
      sortBy: sortBy as string,
      sortOrder: sortOrder as 'ASC' | 'DESC'
    });

    res.json({
      data: result.data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum)
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
    const purchaseId = parseInt(id);
    
    const purchase = await getOrSet(
      CacheKeys.PURCHASE(purchaseId),
      async () => {
        return await PurchaseRepository.findById(purchaseId);
      }
    );
    
    if (!purchase) {
      throw new NotFoundError('Purchase not found');
    }
    
    // Ensure invoice_owner exists
    if (!purchase.invoice_owner) {
      purchase.invoice_owner = '';
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
    const user = (req as any).user;
    const { 
      request_number, 
      date, 
      requester, 
      invoice_owner,
      description, 
      receiver, 
      delivery_date, 
      status, 
      notes 
    } = req.body;

    const validation = validatePurchase(req.body);
    if (!validation.valid) {
      throw new ValidationError('Validation failed', validation.errors);
    }

    // Check if request number exists
    const existing = await PurchaseRepository.findByRequestNumber(request_number);
    if (existing) {
      throw new ConflictError('Request number already exists');
    }

    if (delivery_date < date) {
      throw new ValidationError('Delivery date must be after request date');
    }

    const purchase = await PurchaseRepository.create({
      request_number,
      date,
      requester,
      invoice_owner: invoice_owner || '',
      description,
      receiver,
      delivery_date,
      status: status || 'قيد التنفيذ',
      notes: notes || '',
      created_by: user?.id || null
    });

    await logActivity(
      user?.id,
      user?.username || 'system',
      'PURCHASE_CREATE',
      'purchase',
      purchase.id,
      purchase,
      req.ip,
      req.headers['user-agent']
    );

    Cache.delPrefix('dashboard:stats');
    Cache.delPrefix('alerts:');

    res.status(201).json(purchase);
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
    const user = (req as any).user;
    const { id } = req.params;
    const purchaseId = parseInt(id);
    const { 
      request_number, 
      date, 
      requester, 
      invoice_owner,
      description, 
      receiver, 
      delivery_date, 
      status, 
      notes 
    } = req.body;

    const existing = await PurchaseRepository.findById(purchaseId);
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

    if (request_number && request_number !== existing.request_number) {
      const duplicate = await PurchaseRepository.findByRequestNumber(request_number);
      if (duplicate) {
        throw new ConflictError('Request number already used by another purchase');
      }
    }

    if (delivery_date < date) {
      throw new ValidationError('Delivery date must be after request date');
    }

    const updateData: any = {};
    if (request_number !== undefined) updateData.request_number = request_number;
    if (date !== undefined) updateData.date = date;
    if (requester !== undefined) updateData.requester = requester;
    if (invoice_owner !== undefined) updateData.invoice_owner = invoice_owner || '';
    if (description !== undefined) updateData.description = description;
    if (receiver !== undefined) updateData.receiver = receiver;
    if (delivery_date !== undefined) updateData.delivery_date = delivery_date;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;

    const updated = await PurchaseRepository.update(purchaseId, updateData);

    await logActivity(
      user.id,
      user.username,
      'PURCHASE_UPDATE',
      'purchase',
      purchaseId,
      { old: existing, new: updated },
      req.ip,
      req.headers['user-agent']
    );

    Cache.del(CacheKeys.PURCHASE(purchaseId));
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
    const user = (req as any).user;
    const { id } = req.params;
    const purchaseId = parseInt(id);

    const existing = await PurchaseRepository.findById(purchaseId);
    if (!existing) {
      throw new NotFoundError('Purchase not found');
    }

    if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'manager') {
      throw new AuthorizationError('Only admins and managers can delete purchases');
    }

    if (user.role === 'manager' && existing.requester !== user.username) {
      throw new AuthorizationError('You can only delete your own purchases');
    }

    await PurchaseRepository.delete(purchaseId);

    await logActivity(
      user.id,
      user.username,
      'PURCHASE_DELETE',
      'purchase',
      purchaseId,
      existing,
      req.ip,
      req.headers['user-agent']
    );

    Cache.del(CacheKeys.PURCHASE(purchaseId));
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
        return await PurchaseRepository.getDashboardStats();
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
    const { q, status, from, to, page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 20;

    const result = await PurchaseRepository.findAll({
      search: q as string,
      status: status as string,
      startDate: from as string,
      endDate: to as string,
      page: pageNum,
      limit: limitNum
    });

    res.json({
      data: result.data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: result.total,
        totalPages: Math.ceil(result.total / limitNum)
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
// Update Purchase Status (✅ Fixed for Supabase)
// ============================================

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status } = req.body;
    const { id } = req.params;
    const purchaseId = parseInt(id);

    const validStatuses = ['قيد التنفيذ', 'منجز', 'معلق', 'ملغي'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError('Invalid status', [`Status must be one of: ${validStatuses.join(', ')}`]);
    }

    // ✅ استخدام Supabase عبر PurchaseRepository
    const existing = await PurchaseRepository.findById(purchaseId);
    if (!existing) {
      throw new NotFoundError('Purchase not found');
    }

    // ✅ التحقق من الصلاحيات
    if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'manager') {
      throw new AuthorizationError('Only admins and managers can change status');
    }

    if (user.role === 'manager' && existing.requester !== user.username) {
      throw new AuthorizationError('You can only change status of your own purchases');
    }

    // ✅ إزالة الشرط للسماح بتغيير جميع الحالات (منجز ← قيد التنفيذ وغيرها)
    // if (existing.status === 'منجز' || existing.status === 'ملغي') {
    //   throw new ValidationError('Cannot change status of completed or cancelled purchases');
    // }

    // ✅ تحديث الحالة باستخدام PurchaseRepository
    const updated = await PurchaseRepository.updateStatus(purchaseId, status);

    await logActivity(
      user.id,
      user.username,
      'PURCHASE_STATUS_CHANGE',
      'purchase',
      purchaseId,
      { oldStatus: existing.status, newStatus: status },
      req.ip,
      req.headers['user-agent']
    );

    Cache.del(CacheKeys.PURCHASE(purchaseId));
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
    const user = (req as any).user;
    const { status, from, to } = req.query;

    if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'manager') {
      throw new AuthorizationError('Only admins and managers can export purchases');
    }

    const supabase = getSupabase();
    
    let query = supabase
      .from('purchases')
      .select('*')
      .is('deleted_at', null);

    if (status && status !== '' && status !== 'all') {
      query = query.eq('status', status as string);
    }

    if (from && from !== '') {
      query = query.gte('date', from as string);
    }

    if (to && to !== '') {
      query = query.lte('date', to as string);
    }

    const { data: purchases, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    await logActivity(
      user.id,
      user.username,
      'PURCHASE_EXPORT',
      'purchase',
      undefined,
      { count: purchases?.length || 0, filters: { status, from, to } },
      req.ip,
      req.headers['user-agent']
    );

    res.json({
      success: true,
      count: purchases?.length || 0,
      data: purchases || [],
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
    const overdue = await getOrSet(
      CacheKeys.OVERDUE_PURCHASES(),
      async () => {
        return await PurchaseRepository.getOverdue();
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
    const expiring = await getOrSet(
      CacheKeys.EXPIRING_TODAY(),
      async () => {
        return await PurchaseRepository.getExpiringToday();
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
    const stats = await getOrSet(
      CacheKeys.ALERT_STATS(),
      async () => {
        const overdue = await PurchaseRepository.getOverdue();
        const expiringToday = await PurchaseRepository.getExpiringToday();
        
        // Get expiring soon (next 2-4 days)
        const supabase = getSupabase();
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const future4 = new Date(today);
        future4.setDate(future4.getDate() + 4);
        
        const { data: expiringSoon } = await supabase
          .from('purchases')
          .select('*')
          .is('deleted_at', null)
          .not('status', 'in', '("منجز","ملغي")')
          .gte('delivery_date', tomorrow.toISOString().split('T')[0])
          .lte('delivery_date', future4.toISOString().split('T')[0]);

        return {
          overdue: overdue.length,
          expiringToday: expiringToday.length,
          expiringSoon: expiringSoon?.length || 0,
          mostOverdue: overdue.slice(0, 5).map(p => ({
            id: p.id,
            request_number: p.request_number,
            requester: p.requester,
            description: p.description,
            delivery_date: p.delivery_date,
            status: p.status,
            days_overdue: Math.floor((new Date().getTime() - new Date(p.delivery_date).getTime()) / (1000 * 60 * 60 * 24))
          }))
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
    const user = (req as any).user;
    const { id } = req.params;
    const purchaseId = parseInt(id);

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      throw new AuthorizationError('Only admins can restore purchases');
    }

    const restored = await PurchaseRepository.restore(purchaseId);

    await logActivity(
      user.id,
      user.username,
      'PURCHASE_RESTORE',
      'purchase',
      purchaseId,
      restored,
      req.ip,
      req.headers['user-agent']
    );

    Cache.del(CacheKeys.PURCHASE(purchaseId));
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
    const user = (req as any).user;

    if (user.role !== 'admin' && user.role !== 'super_admin') {
      throw new AuthorizationError('Only admins can view deleted purchases');
    }

    const supabase = getSupabase();
    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) throw error;

    res.json(purchases || []);
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