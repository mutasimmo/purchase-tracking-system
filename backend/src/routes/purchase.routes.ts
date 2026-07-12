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
  getAuditLogsByPurchase
} from '../controllers/purchase.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';
import { validatePurchaseExists, validatePurchaseOwnership } from '../middleware/purchase.middleware.js';

const router = Router();

// ============================================
// Public Routes (for all authenticated users)
// ============================================

router.get('/search', authenticate, searchPurchases);
router.get('/dashboard', authenticate, getDashboardStats);
router.get('/export', authenticate, authorize('admin', 'manager'), exportPurchases);

// ============================================
// Alert Routes
// ============================================

router.get('/alerts/overdue', authenticate, getOverduePurchases);
router.get('/alerts/expiring-today', authenticate, getExpiringToday);
router.get('/alerts/stats', authenticate, getAlertStats);

// ============================================
// Audit Log Routes (Admin only)
// ============================================

router.get('/audit-logs', authenticate, authorize('admin'), getAuditLogs);
router.get('/audit-logs/purchase/:id', authenticate, authorize('admin'), getAuditLogsByPurchase);

// ============================================
// Core Routes (with validation and ownership checks)
// ============================================

router.get('/', authenticate, getAllPurchases);
router.get('/:id', authenticate, validatePurchaseExists, getPurchaseById);
router.post('/', authenticate, createPurchase);
router.put('/:id', authenticate, validatePurchaseExists, validatePurchaseOwnership, updatePurchase);
router.patch('/:id/status', authenticate, validatePurchaseExists, updateStatus);
router.delete('/:id', authenticate, validatePurchaseExists, authorize('admin', 'manager'), deletePurchase);

export default router;