// utils/cache.ts
import NodeCache from 'node-cache';

// ============================================
// Create cache with default TTL
// ============================================

const cache = new NodeCache({
  stdTTL: 300, // 5 minutes default
  checkperiod: 60, // Check every minute
  useClones: false
});

// ============================================
// Cache functions
// ============================================

export const Cache = {
  // Set value in cache
  set: <T>(key: string, value: T, ttl?: number): boolean => {
    if (ttl !== undefined) {
      return cache.set(key, value, ttl);
    }
    return cache.set(key, value);
  },

  // Get value from cache
  get: <T>(key: string): T | undefined => {
    return cache.get<T>(key);
  },

  // Delete from cache
  del: (key: string): number => {
    return cache.del(key);
  },

  // Delete all keys with prefix
  delPrefix: (prefix: string): number => {
    const keys = cache.keys();
    const filteredKeys = keys.filter(key => key.startsWith(prefix));
    if (filteredKeys.length === 0) return 0;
    return cache.del(filteredKeys);
  },

  // Check if key exists
  has: (key: string): boolean => {
    return cache.has(key);
  },

  // Flush all cache
  flush: (): void => {
    cache.flushAll();
  },

  // Get cache statistics
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
// Helper functions for cache
// ============================================

// Get from cache or execute fetcher function
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

// Pre-defined cache keys
export const CacheKeys = {
  // Users
  USER: (id: number) => `user:${id}`,
  USERS_LIST: (page: number, limit: number) => `users:list:${page}:${limit}`,
  
  // Purchases
  PURCHASE: (id: number) => `purchase:${id}`,
  PURCHASES_LIST: (page: number, limit: number, filters: string) => `purchases:list:${page}:${limit}:${filters}`,
  DASHBOARD_STATS: (userId: number) => `dashboard:stats:${userId}`,
  
  // Alerts
  ALERT_STATS: () => 'alerts:stats',
  OVERDUE_PURCHASES: () => 'alerts:overdue',
  EXPIRING_TODAY: () => 'alerts:expiring-today'
};

// ============================================
// Export default
// ============================================

export default {
  Cache,
  getOrSet,
  CacheKeys
};