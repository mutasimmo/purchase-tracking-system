// src/components/Alerts.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { purchaseApi } from '../api/purchaseApi';
import type { Purchase } from '../types/purchase.types';
import toast from 'react-hot-toast';

interface Props {
  onClose?: () => void;
}

const Alerts: React.FC<Props> = ({ onClose }) => {
  const [overdue, setOverdue] = useState<Purchase[]>([]);
  const [expiringToday, setExpiringToday] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    overdue: 0,
    expiringToday: 0,
    expiringSoon: 0,
    mostOverdue: [] as any[]
  });
  const [refreshing, setRefreshing] = useState(false);

  // ============================================
  // ✅ جلب التنبيهات - النسخة النهائية
  // ============================================

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      
      // ✅ جلب البيانات
      const [overdueData, expiringData, statsData] = await Promise.all([
        purchaseApi.getOverdue(),
        purchaseApi.getExpiringToday(),
        purchaseApi.getAlertStats()
      ]);
      
      console.log('📊 Overdue Data:', overdueData);
      console.log('📊 Expiring Data:', expiringData);
      console.log('📊 Stats Data:', statsData);
      
      // ✅ تحديث القوائم
      setOverdue(overdueData || []);
      setExpiringToday(expiringData || []);
      
      // ✅ استخراج الإحصائيات من data.data (التنسيق الصحيح)
      const statsInfo = statsData?.data || statsData || {};
      setStats({
        overdue: statsInfo.overdue || 0,
        expiringToday: statsInfo.expiringToday || 0,
        expiringSoon: statsInfo.expiringSoon || 0,
        mostOverdue: statsInfo.mostOverdue || []
      });
      
      console.log('📊 Updated Stats:', {
        overdue: statsInfo.overdue || 0,
        expiringToday: statsInfo.expiringToday || 0
      });
      
    } catch (error) {
      toast.error('❌ حدث خطأ في تحميل التنبيهات');
      console.error('❌ Load Alerts Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // ✅ التحميل الأولي
  // ============================================

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 60000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  // ============================================
  // ✅ تحديث يدوي
  // ============================================

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAlerts();
    setRefreshing(false);
    toast.success('🔄 تم تحديث التنبيهات');
  };

  // ============================================
  // ✅ حساب الإجمالي
  // ============================================

  const totalAlerts = useMemo(() => {
    return stats.overdue + stats.expiringToday;
  }, [stats]);

  const hasAlerts = useMemo(() => {
    return totalAlerts > 0;
  }, [totalAlerts]);

  // ============================================
  // ✅ تنسيق التاريخ
  // ============================================

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysOverdue = (deliveryDate: string) => {
    const diff = Math.ceil(
      (new Date().getTime() - new Date(deliveryDate).getTime()) / 
      (1000 * 60 * 60 * 24)
    );
    return diff;
  };

  // ============================================
  // ✅ عرض رسالة عند التحميل
  // ============================================

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-100">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent"></div>
            <p className="mt-3 text-gray-500 text-sm">جاري تحميل التنبيهات...</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // ✅ Render
  // ============================================

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-4 sm:p-6 border border-gray-100 max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
            <i className="fas fa-bell text-red-500 text-2xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">التنبيهات</h2>
            <p className="text-sm text-gray-500">
              {!hasAlerts ? '✅ لا توجد تنبيهات' : `⚠️ لديك ${totalAlerts} تنبيه`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
            title="تحديث"
          >
            <i className={`fas fa-sync-alt ${refreshing ? 'animate-spin' : ''}`}></i>
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-xl"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-red-50 rounded-2xl p-4 text-center hover:scale-105 transition-transform">
          <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          <div className="text-xs text-gray-600">متأخر</div>
        </div>
        <div className="bg-orange-50 rounded-2xl p-4 text-center hover:scale-105 transition-transform">
          <div className="text-2xl font-bold text-orange-600">{stats.expiringToday}</div>
          <div className="text-xs text-gray-600">ينتهي اليوم</div>
        </div>
        <div className="bg-yellow-50 rounded-2xl p-4 text-center hover:scale-105 transition-transform">
          <div className="text-2xl font-bold text-yellow-600">{stats.expiringSoon}</div>
          <div className="text-xs text-gray-600">قريباً</div>
        </div>
      </div>

      {/* الطلبات المتأخرة */}
      {overdue.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2">
            <i className="fas fa-exclamation-circle"></i>
            طلبات متأخرة ({overdue.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {overdue.map((purchase) => {
              const days = getDaysOverdue(purchase.delivery_date);
              const isCritical = days >= 7;
              return (
                <div 
                  key={purchase.id} 
                  className={`${isCritical ? 'bg-red-100 border-red-600' : 'bg-red-50 border-red-500'} border-r-4 p-3 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:shadow-md transition-shadow`}
                >
                  <div>
                    <div className="font-medium text-gray-800 flex items-center gap-2">
                      {isCritical && (
                        <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">
                          حرج
                        </span>
                      )}
                      {purchase.request_number}
                    </div>
                    <div className="text-sm text-gray-600">{purchase.requester}</div>
                    <div className="text-xs text-gray-400">{purchase.description?.substring(0, 50)}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${isCritical ? 'text-red-700' : 'text-red-600'}`}>
                      متأخر {days} يوم
                    </div>
                    <div className="text-xs text-gray-500">{formatDate(purchase.delivery_date)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* طلبات تنتهي اليوم */}
      {expiringToday.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-orange-600 mb-3 flex items-center gap-2">
            <i className="fas fa-clock"></i>
            تنتهي اليوم ({expiringToday.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {expiringToday.map((purchase) => (
              <div key={purchase.id} className="bg-orange-50 border-r-4 border-orange-500 p-3 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:shadow-md transition-shadow">
                <div>
                  <div className="font-medium text-gray-800">{purchase.request_number}</div>
                  <div className="text-sm text-gray-600">{purchase.requester}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-orange-600">ينتهي اليوم</div>
                  <div className="text-xs text-gray-500">{formatDate(purchase.delivery_date)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* أكثر الطلبات تأخراً */}
      {stats.mostOverdue && stats.mostOverdue.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-purple-600 mb-3 flex items-center gap-2">
            <i className="fas fa-fire"></i>
            أكثر الطلبات تأخراً
          </h3>
          <div className="space-y-2">
            {stats.mostOverdue.slice(0, 5).map((item: any, index: number) => (
              <div key={index} className="bg-purple-50 border-r-4 border-purple-500 p-3 rounded-xl flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-800">{item.request_number}</div>
                  <div className="text-sm text-gray-600">{item.requester}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-purple-600">
                    متأخر {Math.round(item.days_overdue)} يوم
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* لا توجد تنبيهات */}
      {!hasAlerts && (
        <div className="text-center py-8">
          <div className="text-6xl text-green-300 mb-4">✅</div>
          <p className="text-gray-500 font-medium">جميع الطلبات في الموعد المحدد</p>
          <p className="text-sm text-gray-400">لا توجد طلبات متأخرة أو منتهية</p>
        </div>
      )}

      {/* وقت آخر تحديث */}
      <div className="text-center text-xs text-gray-400 mt-4 border-t pt-4">
        آخر تحديث: {new Date().toLocaleTimeString('ar-SA')}
      </div>
    </div>
  );
};

export default Alerts;