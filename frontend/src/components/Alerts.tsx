// src/components/Alerts.tsx
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  
  // ✅ حالة الطلب المختار لعرض التفاصيل
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // ✅ مرجع للنافذة المنبثقة للتمرير التلقائي
  const modalRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);

  // ============================================
  // ✅ جلب التنبيهات
  // ============================================

  const loadAlerts = useCallback(async () => {
    try {
      setLoading(true);
      
      const [overdueData, expiringData, statsData] = await Promise.all([
        purchaseApi.getOverdue(),
        purchaseApi.getExpiringToday(),
        purchaseApi.getAlertStats()
      ]);
      
      console.log('📊 Overdue Data:', overdueData);
      console.log('📊 Expiring Data:', expiringData);
      console.log('📊 Stats Data:', statsData);
      
      setOverdue(overdueData || []);
      setExpiringToday(expiringData || []);
      
      const statsInfo = statsData?.data || statsData || {};
      setStats({
        overdue: statsInfo.overdue || 0,
        expiringToday: statsInfo.expiringToday || 0,
        expiringSoon: statsInfo.expiringSoon || 0,
        mostOverdue: statsInfo.mostOverdue || []
      });
      
    } catch (error) {
      toast.error('❌ حدث خطأ في تحميل التنبيهات');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ============================================
  // ✅ فتح تفاصيل الطلب مع تمرير تلقائي
  // ============================================

  const openDetails = (purchase: Purchase) => {
    setSelectedPurchase(purchase);
    setShowModal(true);
    
    // ✅ تمرير تلقائي إلى النافذة المنبثقة بعد فتحها
    setTimeout(() => {
      if (modalRef.current) {
        modalRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 100);
  };

  // ============================================
  // ✅ إغلاق التفاصيل
  // ============================================

  const closeDetails = () => {
    setShowModal(false);
    setSelectedPurchase(null);
  };

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

  const formatFullDate = (date: string) => {
    return new Date(date).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long'
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
  // ✅ تأثير التمرير التلقائي عند فتح النافذة
  // ============================================

  useEffect(() => {
    if (showModal && modalContentRef.current) {
      // تمرير تلقائي إلى محتوى النافذة
      modalContentRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }, [showModal]);

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
    <>
      {/* القائمة الرئيسية */}
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
                    onClick={() => openDetails(purchase)}
                    className={`${isCritical ? 'bg-red-100 border-red-600' : 'bg-red-50 border-red-500'} border-r-4 p-3 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:shadow-lg transition-all cursor-pointer hover:scale-[1.02]`}
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-800 flex items-center gap-2">
                        {isCritical && (
                          <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                            حرج
                          </span>
                        )}
                        {purchase.request_number}
                      </div>
                      <div className="text-sm text-gray-600">{purchase.requester}</div>
                      <div className="text-xs text-gray-400 line-clamp-1">{purchase.description}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm font-bold ${isCritical ? 'text-red-700' : 'text-red-600'}`}>
                        متأخر {days} يوم
                      </div>
                      <div className="text-xs text-gray-500">{formatDate(purchase.delivery_date)}</div>
                      <div className="text-xs text-blue-500 mt-1 flex items-center gap-1 justify-end">
                        <span>اضغط للتفاصيل</span>
                        <i className="fas fa-chevron-left text-[10px]"></i>
                      </div>
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
                <div 
                  key={purchase.id} 
                  onClick={() => openDetails(purchase)}
                  className="bg-orange-50 border-r-4 border-orange-500 p-3 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 hover:shadow-lg transition-all cursor-pointer hover:scale-[1.02]"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-800">{purchase.request_number}</div>
                    <div className="text-sm text-gray-600">{purchase.requester}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-orange-600">ينتهي اليوم</div>
                    <div className="text-xs text-gray-500">{formatDate(purchase.delivery_date)}</div>
                    <div className="text-xs text-blue-500 mt-1 flex items-center gap-1 justify-end">
                      <span>اضغط للتفاصيل</span>
                      <i className="fas fa-chevron-left text-[10px]"></i>
                    </div>
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
                <div 
                  key={index} 
                  className="bg-purple-50 border-r-4 border-purple-500 p-3 rounded-xl flex justify-between items-center cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02]"
                  onClick={() => {
                    let found = null;
                    if (Array.isArray(overdue) && overdue.length > 0) {
                      found = overdue.find(p => p.id === item.id);
                    }
                    if (found) {
                      openDetails(found);
                    } else {
                      openDetails({
                        id: item.id || Date.now(),
                        request_number: item.request_number || 'غير معروف',
                        requester: item.requester || 'غير معروف',
                        description: item.description || '',
                        date: item.delivery_date || new Date().toISOString().split('T')[0],
                        delivery_date: item.delivery_date || new Date().toISOString().split('T')[0],
                        status: item.status || 'قيد التنفيذ',
                        receiver: item.receiver || 'غير محدد',
                        invoice_owner: item.invoice_owner || '',
                        notes: item.notes || '',
                        priority: item.priority || 'medium',
                        department: item.department || '',
                        created_at: item.created_at || new Date().toISOString(),
                        updated_at: item.updated_at || new Date().toISOString(),
                        created_by: item.created_by || null,
                        assigned_to: item.assigned_to || null
                      } as Purchase);
                    }
                  }}
                >
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

      {/* ============================================
          نافذة تفاصيل الطلب (Modal) مع تمرير تلقائي
          ============================================ */}
      {showModal && selectedPurchase && (
        <div 
          ref={modalRef}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
          onClick={closeDetails}
        >
          <div 
            ref={modalContentRef}
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b p-4 flex justify-between items-center rounded-t-3xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                  <i className="fas fa-file-alt text-red-500"></i>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">تفاصيل الطلب</h3>
                  <p className="text-sm text-gray-500">{selectedPurchase.request_number}</p>
                </div>
              </div>
              <button
                onClick={closeDetails}
                className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-xl"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>

            {/* المحتوى مع تمرير تلقائي */}
            <div className="p-6 space-y-4">
              {/* رقم الطلب والحالة */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">رقم الطلب</p>
                  <p className="font-bold text-gray-800">{selectedPurchase.request_number}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">الحالة</p>
                  <p className={`font-bold ${
                    selectedPurchase.status === 'منجز' ? 'text-green-600' :
                    selectedPurchase.status === 'قيد التنفيذ' ? 'text-yellow-600' :
                    selectedPurchase.status === 'معلق' ? 'text-red-600' :
                    'text-gray-600'
                  }`}>{selectedPurchase.status}</p>
                </div>
              </div>

              {/* الجهة الطالبة */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">الجهة الطالبة</p>
                <p className="font-semibold text-gray-800">{selectedPurchase.requester}</p>
              </div>

              {/* الوصف */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">الوصف</p>
                <p className="text-gray-700">{selectedPurchase.description || 'لا يوجد وصف'}</p>
              </div>

              {/* صاحب الفاتورة */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">صاحب الفاتورة</p>
                <p className="text-gray-700">{selectedPurchase.invoice_owner || 'غير محدد'}</p>
              </div>

              {/* المستلم */}
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400">المستلم</p>
                <p className="text-gray-700">{selectedPurchase.receiver || 'غير محدد'}</p>
              </div>

              {/* الأولوية */}
              {selectedPurchase.priority && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">الأولوية</p>
                  <p className={`font-semibold ${
                    selectedPurchase.priority === 'high' ? 'text-red-600' :
                    selectedPurchase.priority === 'medium' ? 'text-yellow-600' :
                    'text-green-600'
                  }`}>
                    {selectedPurchase.priority === 'high' ? 'عالية' :
                     selectedPurchase.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                  </p>
                </div>
              )}

              {/* التواريخ */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">تاريخ الطلب</p>
                  <p className="font-semibold text-gray-800">{formatFullDate(selectedPurchase.date)}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">تاريخ التسليم</p>
                  <p className={`font-semibold ${
                    new Date(selectedPurchase.delivery_date) < new Date() && 
                    selectedPurchase.status !== 'منجز' ? 'text-red-600' : 'text-gray-800'
                  }`}>{formatFullDate(selectedPurchase.delivery_date)}</p>
                </div>
              </div>

              {/* أيام التأخير */}
              {selectedPurchase.status !== 'منجز' && 
               new Date(selectedPurchase.delivery_date) < new Date() && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs text-red-400">أيام التأخير</p>
                  <p className="font-bold text-red-600 text-xl">
                    {getDaysOverdue(selectedPurchase.delivery_date)} يوم
                  </p>
                </div>
              )}

              {/* الملحوظات */}
              {selectedPurchase.notes && (
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400">ملحوظات</p>
                  <p className="text-gray-700">{selectedPurchase.notes}</p>
                </div>
              )}

              {/* الأزرار */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={closeDetails}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
                >
                  إغلاق
                </button>
                <button
                  onClick={() => {
                    closeDetails();
                    toast('📝 سيتم توجيهك إلى صفحة تعديل الطلب', { icon: '📝' });
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                >
                  <i className="fas fa-edit ml-2"></i>
                  تعديل
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSS */}
      <style>{`
        .line-clamp-1 {
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </>
  );
};

export default Alerts;