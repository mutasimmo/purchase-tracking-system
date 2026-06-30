import { Router } from 'express';
import {
  login,
  register,
  logout,
  getCurrentUser,
  changePassword,
  updateUser,
  getAllUsers,
  getUserById,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
  toggleUserStatus
} from '../controllers/auth.controller.js';
import { authenticate, authorize } from '../middleware/auth.middleware.js';

const router = Router();

// ============================================
// المسارات العامة
// ============================================
router.post('/login', login);
router.post('/register', register);
router.post('/logout', logout);

// ============================================
// المسارات المحمية (للمستخدم العادي)
// ============================================
router.get('/me', authenticate, getCurrentUser);
router.put('/password', authenticate, changePassword);
router.put('/profile', authenticate, updateUser);

// ============================================
// مسارات إدارة المستخدمين (للأدمن فقط)
// ============================================
router.get('/users', authenticate, authorize('admin'), getAllUsers);
router.get('/users/:id', authenticate, authorize('admin'), getUserById);
router.post('/users', authenticate, authorize('admin'), createUserByAdmin);
router.put('/users/:id', authenticate, authorize('admin'), updateUserByAdmin);
router.delete('/users/:id', authenticate, authorize('admin'), deleteUserByAdmin);
router.patch('/users/:id/status', authenticate, authorize('admin'), toggleUserStatus);

export default router;