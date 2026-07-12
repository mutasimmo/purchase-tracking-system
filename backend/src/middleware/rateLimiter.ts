// backend/src/middleware/rateLimiter.ts
import rateLimit from 'express-rate-limit';

// ✅ للتسجيل والدخول (5 محاولات في 15 دقيقة)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  max: 5, // 5 محاولات فقط
  message: {
    error: 'Too many attempts',
    message: 'Please try again after 15 minutes',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true
});

// ✅ لجميع المسارات (100 طلب في الساعة)
export const globalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ساعة
  max: 100, // 100 طلب في الساعة
  message: {
    error: 'Too many requests',
    message: 'Please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ✅ لإنشاء الطلبات (50 طلب في الساعة)
export const purchaseLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // ساعة
  max: 50, // 50 طلب في الساعة
  message: {
    error: 'Too many purchase requests',
    message: 'Please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

export default {
  authLimiter,
  globalLimiter,
  purchaseLimiter
};