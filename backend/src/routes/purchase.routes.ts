// src/routes/purchase.routes.ts
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
  getAuditLogsByPurchase,
  restorePurchase,
  getDeletedPurchases
} from '../controllers/purchase.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { validatePurchaseExists, validatePurchaseOwnership } from '../middleware/purchase.middleware.js';

const router = Router();

// ============================================
// 📊 Dashboard & Reports
// ============================================

router.get('/dashboard', authenticate, getDashboardStats);
router.get('/export', authenticate, authorize('admin', 'manager'), exportPurchases);

// ============================================
// 🔍 Search
// ============================================

router.get('/search', authenticate, searchPurchases);

// ============================================
// 🔔 Alerts
// ============================================

router.get('/alerts/overdue', authenticate, getOverduePurchases);
router.get('/alerts/expiring-today', authenticate, getExpiringToday);
router.get('/alerts/stats', authenticate, getAlertStats);

// ============================================
// 📋 Audit Logs (Admin only)
// ============================================

router.get('/audit-logs', authenticate, authorize('admin'), getAuditLogs);
router.get('/audit-logs/purchase/:id', authenticate, authorize('admin'), getAuditLogsByPurchase);

// ============================================
// 🗑️ Deleted Purchases (Admin only)
// ============================================

router.get('/trash', authenticate, authorize('admin'), getDeletedPurchases);
router.patch('/:id/restore', authenticate, authorize('admin'), restorePurchase);

// ============================================
// 📌 Core CRUD Routes
// ============================================

router.get('/', authenticate, getAllPurchases);
router.get('/:id', authenticate, validatePurchaseExists, getPurchaseById);
router.post('/', authenticate, createPurchase);
router.put('/:id', authenticate, validatePurchaseExists, validatePurchaseOwnership, updatePurchase);
router.patch('/:id/status', authenticate, validatePurchaseExists, updateStatus);
router.delete('/:id', authenticate, validatePurchaseExists, authorize('admin', 'manager'), deletePurchase);

export default router;