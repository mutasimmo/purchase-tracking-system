import { Router } from 'express';
import {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  deletePurchase,
  getDashboardStats,
  searchPurchases,
  updateStatus,
  exportPurchases,
  getOverduePurchases,
  getExpiringToday,
  getAlertStats,
  getAuditLogs,
  getAuditLogsByPurchase
} from '../controllers/purchase.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// المسارات الأساسية
router.get('/', getAllPurchases);
router.get('/dashboard', getDashboardStats);
router.get('/search', searchPurchases);
router.get('/export', exportPurchases);

// 🔔 مسارات التنبيهات
router.get('/alerts/overdue', getOverduePurchases);
router.get('/alerts/expiring-today', getExpiringToday);
router.get('/alerts/stats', getAlertStats);

// 🆕 مسارات التتبع (Admin فقط)
router.get('/audit-logs', authenticate, authorize('admin'), getAuditLogs);
router.get('/audit-logs/purchase/:id', authenticate, authorize('admin'), getAuditLogsByPurchase);

router.get('/:id', getPurchaseById);
router.post('/', authenticate, createPurchase);
router.put('/:id', authenticate, updatePurchase);
router.patch('/:id/status', authenticate, updateStatus);
router.delete('/:id', authenticate, deletePurchase);

export default router;