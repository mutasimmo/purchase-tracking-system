// src/components/AlertBell.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { purchaseApi } from '../api/purchaseApi';
import toast from 'react-hot-toast';

interface Props {
  onClick: () => void;
}

const AlertBell: React.FC<Props> = ({ onClick }) => {
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasNewAlerts, setHasNewAlerts] = useState(false);
  const previousCountRef = useRef(0);

  // ============================================
  // ✅ جلب عدد التنبيهات - النسخة المعدلة
  // ============================================

  const loadAlertCount = useCallback(async () => {
    try {
      const stats = await purchaseApi.getAlertStats();
      
      // ✅ استخراج البيانات بشكل صحيح
      const overdueCount = stats.data?.overdue || stats.overdue || 0;
      const expiringTodayCount = stats.data?.expiringToday || stats.expiringToday || 0;
      const count = overdueCount + expiringTodayCount;
      
      console.log('🔔 AlertBell - Overdue:', overdueCount);
      console.log('🔔 AlertBell - Expiring Today:', expiringTodayCount);
      console.log('🔔 AlertBell - Total:', count);
      
      // ✅ التحقق من وجود تنبيهات جديدة
      if (count > previousCountRef.current) {
        setHasNewAlerts(true);
        // ✅ إلغاء التنبيه بعد 5 ثوانٍ
        setTimeout(() => setHasNewAlerts(false), 5000);
      }
      
      previousCountRef.current = count;
      setAlertCount(count);
      setLoading(false);
    } catch (error) {
      console.error('Error loading alert count:', error);
      setLoading(false);
    }
  }, []);

  // ============================================
  // ✅ التحميل الأولي والتحديث الدوري
  // ============================================

  useEffect(() => {
    loadAlertCount();
    
    // ✅ تحديث كل 30 ثانية
    const interval = setInterval(loadAlertCount, 30000);
    
    // ✅ تحديث عند تغيير التركيز (عودة المستخدم للصفحة)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadAlertCount();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadAlertCount]);

  // ============================================
  // ✅ معالج النقر مع إعادة تعيين التنبيه
  // ============================================

  const handleClick = () => {
    setHasNewAlerts(false);
    onClick();
  };

  // ============================================
  // ✅ تنسيق العرض
  // ============================================

  const displayCount = alertCount > 9 ? '9+' : alertCount;
  const showBadge = !loading && alertCount > 0;

  // ============================================
  // ✅ Render
  // ============================================

  return (
    <button
      onClick={handleClick}
      className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors group"
      title={alertCount > 0 ? `${alertCount} تنبيه` : 'لا توجد تنبيهات'}
    >
      {/* ✅ أيقونة الجرس */}
      <i className={`fas fa-bell text-xl transition-colors ${
        alertCount > 0 ? 'text-red-500' : 'text-gray-600'
      }`}>
      </i>
      
      {/* ✅ نبض للتنبيهات الجديدة */}
      {hasNewAlerts && (
        <span className="absolute inset-0 rounded-full animate-ping bg-red-400/30"></span>
      )}
      
      {/* ✅ العدد */}
      {showBadge && (
        <span className="absolute -top-1 -right-1 bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center shadow-lg animate-pulse">
          {displayCount}
        </span>
      )}
      
      {/* ✅ Tooltip عند التحميل */}
      {loading && (
        <span className="absolute -top-1 -right-1 w-4 h-4">
          <span className="animate-spin rounded-full h-3 w-3 border-2 border-purple-500 border-t-transparent block"></span>
        </span>
      )}
    </button>
  );
};

export default AlertBell;