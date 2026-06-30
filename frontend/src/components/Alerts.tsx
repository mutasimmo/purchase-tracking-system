import { useState, useEffect } from 'react';
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
    mostOverdue: []
  });

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      const [overdueData, expiringData, statsData] = await Promise.all([
        purchaseApi.getOverdue(),
        purchaseApi.getExpiringToday(),
        purchaseApi.getAlertStats()
      ]);
      
      setOverdue(overdueData);
      setExpiringToday(expiringData);
      setStats(statsData);
    } catch (error) {
      toast.error('❌ حدث خطأ في تحميل التنبيهات');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-red-500 border-t-transparent"></div>
      </div>
    );
  }

  const totalAlerts = stats.overdue + stats.expiringToday;

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-6 border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center">
            <i className="fas fa-bell text-red-500 text-2xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">التنبيهات</h2>
            <p className="text-sm text-gray-500">
              {totalAlerts === 0 ? 'لا توجد تنبيهات' : `لديك ${totalAlerts} تنبيه`}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-red-50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          <div className="text-xs text-gray-600">متأخر</div>
        </div>
        <div className="bg-orange-50 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">{stats.expiringToday}</div>
          <div className="text-xs text-gray-600">ينتهي اليوم</div>
        </div>
        <div className="bg-yellow-50 rounded-2xl p-4 text-center">
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
              const days = Math.ceil((new Date().getTime() - new Date(purchase.delivery_date).getTime()) / (1000 * 60 * 60 * 24));
              return (
                <div key={purchase.id} className="bg-red-50 border-r-4 border-red-500 p-3 rounded-xl flex justify-between items-center">
                  <div>
                    <div className="font-medium text-gray-800">{purchase.request_number}</div>
                    <div className="text-sm text-gray-600">{purchase.requester}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-red-600">متأخر {days} يوم</div>
                    <div className="text-xs text-gray-500">{purchase.delivery_date}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* طلبات تنتهي اليوم */}
      {expiringToday.length > 0 && (
        <div>
          <h3 className="font-bold text-orange-600 mb-3 flex items-center gap-2">
            <i className="fas fa-clock"></i>
            تنتهي اليوم ({expiringToday.length})
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {expiringToday.map((purchase) => (
              <div key={purchase.id} className="bg-orange-50 border-r-4 border-orange-500 p-3 rounded-xl flex justify-between items-center">
                <div>
                  <div className="font-medium text-gray-800">{purchase.request_number}</div>
                  <div className="text-sm text-gray-600">{purchase.requester}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-orange-600">ينتهي غداً</div>
                  <div className="text-xs text-gray-500">{purchase.delivery_date}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalAlerts === 0 && (
        <div className="text-center py-8">
          <div className="text-6xl text-green-300 mb-4">✅</div>
          <p className="text-gray-500 font-medium">جميع الطلبات في الموعد المحدد</p>
          <p className="text-sm text-gray-400">لا توجد طلبات متأخرة أو منتهية</p>
        </div>
      )}
    </div>
  );
};

export default Alerts;