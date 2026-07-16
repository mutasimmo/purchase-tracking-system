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
// ✅ Validation Functions - النسخة النهائية
// ============================================

const validatePurchase = (data: any): PurchaseValidationResult => {
  const errors: { field: string; message: string }[] = [];
  
  // ✅ الحقول الأساسية فقط (مطلوبة)
  if (!data.request_number || data.request_number.trim().length < 1) {
    errors.push({ field: 'request_number', message: 'رقم الطلب مطلوب' });
  }
  if (!data.date) {
    errors.push({ field: 'date', message: 'التاريخ مطلوب' });
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) {
    errors.push({ field: 'date', message: 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)' });
  }
  if (!data.requester || data.requester.trim().length < 1) {
    errors.push({ field: 'requester', message: 'اسم الطالب مطلوب' });
  }
  if (!data.description || data.description.trim().length < 1) {
    errors.push({ field: 'description', message: 'الوصف مطلوب' });
  }
  
  // ✅ الحقول الاختيارية - فقط تحقق من الصيغة إذا تم إرسالها
  if (data.receiver && data.receiver.trim().length < 1) {
    errors.push({ field: 'receiver', message: 'لا يمكن أن يكون المستلم فارغاً' });
  }
  
  if (data.delivery_date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.delivery_date)) {
      errors.push({ field: 'delivery_date', message: 'صيغة تاريخ التسليم غير صحيحة (YYYY-MM-DD)' });
    }
    // التحقق من أن تاريخ التسليم بعد تاريخ الطلب (فقط إذا تم إرسال كلا التاريخين)
    if (data.date && data.delivery_date && data.delivery_date < data.date) {
      errors.push({ field: 'delivery_date', message: 'تاريخ التسليم يجب أن يكون بعد تاريخ الطلب' });
    }
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
      success: true,
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
      success: false,
      error: 'فشل في جلب الطلبات',
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
      throw new NotFoundError('الطلب غير موجود');
    }
    
    // Ensure invoice_owner exists
    if (!purchase.invoice_owner) {
      purchase.invoice_owner = '';
    }
    
    res.json({
      success: true,
      data: purchase
    });
  } catch (error) {
    logger.error('Error fetching purchase:', error);
    
    if (error instanceof NotFoundError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'فشل في جلب الطلب',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// ✅ Create New Purchase - النسخة النهائية
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
      notes,
      priority,
      department
    } = req.body;

    // ✅ سجل البيانات المستلمة
    console.log('📥 [createPurchase] Received data:', {
      request_number,
      date,
      requester,
      invoice_owner,
      description,
      receiver,
      delivery_date,
      status,
      notes,
      priority,
      department,
      user_id: user?.id,
      user_role: user?.role
    });

    // ✅ التحقق من صحة البيانات
    const validation = validatePurchase(req.body);
    if (!validation.valid) {
      console.log('❌ [createPurchase] Validation failed:', validation.errors);
      throw new ValidationError('بيانات غير صالحة', validation.errors);
    }
    console.log('✅ [createPurchase] Validation passed');

    // ✅ التحقق من وجود رقم الطلب
    const existing = await PurchaseRepository.findByRequestNumber(request_number);
    if (existing) {
      console.log('❌ [createPurchase] Request number already exists:', request_number);
      throw new ConflictError('رقم الطلب موجود مسبقاً');
    }
    console.log('✅ [createPurchase] Request number is unique');

    // ✅ إنشاء الطلب مع القيم الافتراضية
    console.log('📤 [createPurchase] Calling PurchaseRepository.create...');
    const purchase = await PurchaseRepository.create({
      request_number: request_number.trim(),
      date: date,
      requester: requester.trim(),
      invoice_owner: invoice_owner?.trim() || '',
      description: description.trim(),
      receiver: receiver?.trim() || 'غير محدد',
      delivery_date: delivery_date || new Date().toISOString().split('T')[0],
      status: status || 'قيد التنفيذ',
      notes: notes || '',
      priority: priority || 'medium',
      department: department || '',
      created_by: user?.id || null
    });
    console.log('✅ [createPurchase] Purchase created successfully, ID:', purchase.id);

    // ✅ تسجيل النشاط
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
    console.log('✅ [createPurchase] Activity logged');

    // ✅ مسح الكاش
    Cache.delPrefix('dashboard:stats');
    Cache.delPrefix('alerts:');
    console.log('✅ [createPurchase] Cache cleared');

    res.status(201).json({
      success: true,
      message: 'تم إنشاء الطلب بنجاح',
      data: purchase
    });
  } catch (error) {
    // ✅ سجل الخطأ بالتفصيل
    console.error('❌ [createPurchase] Error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body
    });
    logger.error('Error creating purchase:', error);
    
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.errors
      });
    }
    
    if (error instanceof ConflictError) {
      return res.status(409).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'فشل في إنشاء الطلب',
      code: 'SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : undefined : undefined
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
      notes,
      priority,
      department
    } = req.body;

    const existing = await PurchaseRepository.findById(purchaseId);
    if (!existing) {
      throw new NotFoundError('الطلب غير موجود');
    }

    if (user.role !== 'admin' && user.role !== 'super_admin' && existing.requester !== user.username) {
      throw new AuthorizationError('يمكنك فقط تحديث طلباتك الخاصة');
    }

    if (status && status !== existing.status && user.role !== 'admin' && user.role !== 'super_admin') {
      throw new AuthorizationError('فقط المدير يمكنه تغيير الحالة');
    }

    const validation = validatePurchase(req.body);
    if (!validation.valid) {
      throw new ValidationError('بيانات غير صالحة', validation.errors);
    }

    if (request_number && request_number !== existing.request_number) {
      const duplicate = await PurchaseRepository.findByRequestNumber(request_number);
      if (duplicate) {
        throw new ConflictError('رقم الطلب مستخدم من قبل طلب آخر');
      }
    }

    if (delivery_date && date && delivery_date < date) {
      throw new ValidationError('تاريخ التسليم يجب أن يكون بعد تاريخ الطلب');
    }

    const updateData: any = {};
    if (request_number !== undefined) updateData.request_number = request_number;
    if (date !== undefined) updateData.date = date;
    if (requester !== undefined) updateData.requester = requester;
    if (invoice_owner !== undefined) updateData.invoice_owner = invoice_owner || '';
    if (description !== undefined) updateData.description = description;
    if (receiver !== undefined) updateData.receiver = receiver || 'غير محدد';
    if (delivery_date !== undefined) updateData.delivery_date = delivery_date;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (priority !== undefined) updateData.priority = priority;
    if (department !== undefined) updateData.department = department;

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

    res.json({
      success: true,
      message: 'تم تحديث الطلب بنجاح',
      data: updated
    });
  } catch (error) {
    logger.error('Error updating purchase:', error);
    
    if (error instanceof ValidationError || 
        error instanceof NotFoundError || 
        error instanceof AuthorizationError ||
        error instanceof ConflictError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error instanceof ValidationError ? error.errors : undefined
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'فشل في تحديث الطلب',
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
      throw new NotFoundError('الطلب غير موجود');
    }

    if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'manager') {
      throw new AuthorizationError('فقط المديرين يمكنهم حذف الطلبات');
    }

    if (user.role === 'manager' && existing.requester !== user.username) {
      throw new AuthorizationError('يمكنك فقط حذف طلباتك الخاصة');
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
      message: 'تم حذف الطلب بنجاح' 
    });
  } catch (error) {
    logger.error('Delete error:', error);
    
    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }
    
    res.status(500).json({ 
      success: false,
      error: 'فشل في حذف الطلب',
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
      success: false,
      error: 'فشل في جلب الإحصائيات',
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
      success: true,
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
      success: false,
      error: 'فشل في البحث عن الطلبات',
      code: 'SERVER_ERROR'
    });
  }
};

// ============================================
// Update Purchase Status
// ============================================

export const updateStatus = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { status } = req.body;
    const { id } = req.params;
    const purchaseId = parseInt(id);

    const validStatuses = ['قيد التنفيذ', 'منجز', 'معلق', 'ملغي'];
    if (!validStatuses.includes(status)) {
      throw new ValidationError('حالة غير صالحة', [`الحالة يجب أن تكون واحدة من: ${validStatuses.join(', ')}`]);
    }

    const existing = await PurchaseRepository.findById(purchaseId);
    if (!existing) {
      throw new NotFoundError('الطلب غير موجود');
    }

    if (user.role !== 'admin' && user.role !== 'super_admin' && user.role !== 'manager') {
      throw new AuthorizationError('فقط المديرين يمكنهم تغيير الحالة');
    }

    if (user.role === 'manager' && existing.requester !== user.username) {
      throw new AuthorizationError('يمكنك فقط تغيير حالة طلباتك الخاصة');
    }

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
      message: `تم تغيير الحالة من ${existing.status} إلى ${status}`,
      data: updated
    });
  } catch (error) {
    logger.error('Error updating status:', error);

    if (error instanceof ValidationError || 
        error instanceof NotFoundError || 
        error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code,
        details: error instanceof ValidationError ? error.errors : undefined
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'فشل في تحديث الحالة',
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
      throw new AuthorizationError('فقط المديرين يمكنهم تصدير الطلبات');
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
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'فشل في تصدير الطلبات',
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

    res.json({
      success: true,
      data: overdue
    });
  } catch (error) {
    logger.error('Error fetching overdue purchases:', error);
    res.status(500).json({ 
      success: false,
      error: 'فشل في جلب الطلبات المتأخرة',
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

    res.json({
      success: true,
      data: expiring
    });
  } catch (error) {
    logger.error('Error fetching expiring purchases:', error);
    res.status(500).json({ 
      success: false,
      error: 'فشل في جلب الطلبات المنتهية اليوم',
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
          success: true,
          data: {
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
          }
        };
      },
      60
    );

    res.json(stats);
  } catch (error) {
    logger.error('Error fetching alert stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'فشل في جلب إحصائيات التنبيهات',
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
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error fetching audit logs:', error);
    res.status(500).json({ 
      success: false,
      error: 'فشل في جلب سجل التدقيق',
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
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    logger.error('Error fetching audit logs by purchase:', error);
    res.status(500).json({ 
      success: false,
      error: 'فشل في جلب سجل التدقيق للطلب',
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
      throw new AuthorizationError('فقط المديرين يمكنهم استعادة الطلبات');
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
      message: 'تم استعادة الطلب بنجاح',
      data: restored
    });
  } catch (error) {
    logger.error('Error restoring purchase:', error);

    if (error instanceof NotFoundError || error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'فشل في استعادة الطلب',
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
      throw new AuthorizationError('فقط المديرين يمكنهم عرض الطلبات المحذوفة');
    }

    const supabase = getSupabase();
    const { data: purchases, error } = await supabase
      .from('purchases')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: purchases || []
    });
  } catch (error) {
    logger.error('Error fetching deleted purchases:', error);

    if (error instanceof AuthorizationError) {
      return res.status(error.statusCode).json({
        success: false,
        error: error.message,
        code: error.code
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'فشل في جلب الطلبات المحذوفة',
      code: 'SERVER_ERROR'
    });
  }
};