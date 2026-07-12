// src/routes/auth.routes.ts
import { Router } from 'express';
import {
  login,
  register,
  logout,
  refreshToken,
  getCurrentUser,
  changePassword,
  updateUser,
  getAllUsers,
  getUserById,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
  toggleUserStatus,
  changeUserRole
} from '../controllers/auth.controller.js';
import { authenticate, authorize, authRateLimiter, registerRateLimiter } from '../middleware/auth.middleware.js';

const router = Router();

// ============================================
// Public Routes (with Rate Limiting)
// ============================================

router.post('/login', authRateLimiter, login);
router.post('/register', registerRateLimiter, register);
router.post('/refresh-token', refreshToken);
// ✅ Logout - لا يحتاج إلى توكن
router.post('/logout', logout);

// ============================================
// Protected Routes (for regular users)
// ============================================

router.get('/me', authenticate, getCurrentUser);
router.put('/password', authenticate, changePassword);
router.put('/profile', authenticate, updateUser);

// ============================================
// Admin Routes (for admin only)
// ============================================

router.get('/users', authenticate, authorize('admin', 'super_admin'), getAllUsers);
router.get('/users/:id', authenticate, authorize('admin', 'super_admin'), getUserById);
router.post('/users', authenticate, authorize('admin', 'super_admin'), createUserByAdmin);
router.put('/users/:id', authenticate, authorize('admin', 'super_admin'), updateUserByAdmin);
router.delete('/users/:id', authenticate, authorize('admin', 'super_admin'), deleteUserByAdmin);
router.patch('/users/:id/status', authenticate, authorize('admin', 'super_admin'), toggleUserStatus);
router.patch('/users/:id/role', authenticate, authorize('super_admin'), changeUserRole);

export default router;