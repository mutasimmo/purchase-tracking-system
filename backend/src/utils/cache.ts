// backend/src/utils/cache.ts
import NodeCache from 'node-cache';

// ✅ إنشاء كاش مع TTL افتراضي
const cache = new NodeCache({
  stdTTL: 300, // 5 دقائق
  checkperiod: 60,
  useClones: false
});

// ============================================
// ✅ دوال الكاش
// ============================================

export const Cache = {
  // ✅ حفظ في الكاش
  set: <T>(key: string, value: T, ttl?: number): boolean => {
    if (ttl !== undefined) {
      return cache.set(key, value, ttl);
    }
    return cache.set(key, value);
  },

  // ✅ استرجاع من الكاش
  get: <T>(key: string): T | undefined => {
    return cache.get<T>(key);
  },

  // ✅ حذف من الكاش
  del: (key: string): number => {
    return cache.del(key);
  },

  // ✅ حذف جميع المفاتيح التي تبدأ بـ prefix
  delPrefix: (prefix: string): number => {
    const keys = cache.keys();
    const filteredKeys = keys.filter(key => key.startsWith(prefix));
    if (filteredKeys.length === 0) return 0;
    return cache.del(filteredKeys);
  },

  // ✅ التحقق من وجود المفتاح
  has: (key: string): boolean => {
    return cache.has(key);
  },

  // ✅ إفراغ الكاش بالكامل
  flush: (): void => {
    cache.flushAll();
  },

  // ✅ إحصائيات الكاش
  stats: () => {
    const stats = cache.getStats();
    return {
      keys: cache.keys().length,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) || 0
    };
  }
};

// ============================================
// ✅ دوال مساعدة
// ============================================

// ✅ الحصول من الكاش أو تنفيذ دالة للحصول على البيانات
export const getOrSet = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number
): Promise<T> => {
  const cached = Cache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  const data = await fetcher();
  Cache.set(key, data, ttl);
  return data;
};

// ✅ مفاتيح مسبقة التعريف
export const CacheKeys = {
  // مستخدمين
  USER: (id: number) => `user:${id}`,
  USERS_LIST: (page: number, limit: number) => `users:list:${page}:${limit}`,
  
  // مشتريات
  PURCHASE: (id: number) => `purchase:${id}`,
  PURCHASES_LIST: (page: number, limit: number, filters: string) => 
    `purchases:list:${page}:${limit}:${filters}`,
  DASHBOARD_STATS: (userId: number) => `dashboard:stats:${userId}`,
  
  // تنبيهات
  ALERT_STATS: () => 'alerts:stats',
  OVERDUE_PURCHASES: () => 'alerts:overdue',
  EXPIRING_TODAY: () => 'alerts:expiring-today'
};

export default {
  Cache,
  getOrSet,
  CacheKeys
};