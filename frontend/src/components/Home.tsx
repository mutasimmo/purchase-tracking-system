// src/components/Home.tsx
import { useState, useEffect, useMemo } from 'react';
import { purchaseApi } from '../api/purchaseApi';
import type { DashboardStats } from '../types/purchase.types';
import toast from 'react-hot-toast';

interface Props {
  onOpenDashboard: () => void;
  onOpenAddForm: () => void;
  onOpenAlerts: () => void;
  onExportExcel: () => void;
}

const Home: React.FC<Props> = ({ 
  onOpenDashboard, 
  onOpenAddForm, 
  onOpenAlerts, 
  onExportExcel 
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  // ============================================
  // ✅ جلب الإحصائيات
  // ============================================

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await purchaseApi.getDashboardStats();
      setStats(data);
    } catch (error) {
      toast.error('❌ حدث خطأ في تحميل الإحصائيات');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ✅ حساب النسب
  // ============================================

  const completionRate = useMemo(() => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  }, [stats]);

  const alertCount = useMemo(() => {
    if (!stats) return 0;
    return (stats.overdue || 0) + (stats.expiringToday || 0);
  }, [stats]);

  const statusColors: Record<string, string> = {
    'منجز': 'bg-green-500',
    'قيد التنفيذ': 'bg-yellow-500',
    'معلق': 'bg-red-500',
    'ملغي': 'bg-gray-400'
  };

  // ============================================
  // ✅ بيانات البطاقات
  // ============================================

  const quickCards = useMemo(() => [
    { 
      id: 'dashboard',
      icon: 'fa-chart-pie', 
      title: 'التقارير', 
      desc: 'عرض الإحصائيات',
      color: 'from-blue-500 to-blue-600',
      onClick: onOpenDashboard
    },
    { 
      id: 'add',
      icon: 'fa-plus-circle', 
      title: 'طلب جديد', 
      desc: 'إضافة طلب',
      color: 'from-green-500 to-green-600',
      onClick: onOpenAddForm
    },
    { 
      id: 'alerts',
      icon: 'fa-bell', 
      title: 'تنبيهات', 
      desc: alertCount > 0 ? `${alertCount} تنبيه` : 'لا توجد تنبيهات',
      color: alertCount > 0 ? 'from-red-500 to-red-600' : 'from-gray-400 to-gray-500',
      onClick: onOpenAlerts,
      badge: alertCount > 0 ? alertCount : null
    },
    { 
      id: 'export',
      icon: 'fa-file-excel', 
      title: 'تصدير', 
      desc: 'تصدير البيانات',
      color: 'from-orange-500 to-orange-600',
      onClick: onExportExcel
    }
  ], [alertCount, onOpenDashboard, onOpenAddForm, onOpenAlerts, onExportExcel]);

  const statsCards = useMemo(() => {
    if (!stats) return [];
    return [
      { 
        id: 'total',
        icon: 'fa-clipboard-list', 
        title: 'إجمالي الطلبات', 
        value: stats.total,
        color: 'bg-blue-100',
        iconColor: 'text-blue-600'
      },
      { 
        id: 'completed',
        icon: 'fa-check-circle', 
        title: 'الطلبات المنجزة', 
        value: stats.completed,
        color: 'bg-green-100',
        iconColor: 'text-green-600'
      },
      { 
        id: 'delayed',
        icon: 'fa-clock', 
        title: 'الطلبات المتأخرة', 
        value: stats.delayed,
        color: 'bg-orange-100',
        iconColor: 'text-orange-600'
      }
    ];
  }, [stats]);

  // ============================================
  // ✅ حالة التحميل
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // ============================================
  // ✅ Render
  // ============================================

  return (
    <div className="space-y-6">
      {/* بطاقة الترحيب */}
      <div className="bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-700 rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>
        
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-1">مرحباً بك 👋</h2>
              <p className="text-purple-200 text-sm md:text-base">نظام متابعة المشتريات</p>
            </div>
            <div className="flex items-center gap-6 bg-white/10 rounded-2xl px-4 py-2 backdrop-blur-sm">
              <div className="text-center">
                <p className="text-purple-200 text-xs">إجمالي الطلبات</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="w-px h-10 bg-purple-400/30"></div>
              <div className="text-center">
                <p className="text-purple-200 text-xs">نسبة الإنجاز</p>
                <p className="text-2xl font-bold">{completionRate}%</p>
              </div>
            </div>
          </div>
          
          <div className="mt-4">
            <div className="flex justify-between text-sm text-purple-200 mb-1">
              <span>التقدم في الطلبات</span>
              <span>{completionRate}%</span>
            </div>
            <div className="w-full bg-purple-500/30 rounded-full h-2.5">
              <div 
                className="bg-white rounded-full h-2.5 transition-all duration-1000"
                style={{ width: `${completionRate}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* بطاقات الوصول السريع */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {quickCards.map((card) => (
          <div 
            key={card.id}
            onClick={card.onClick}
            className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-300 text-center relative"
          >
            {card.badge && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {card.badge}
              </span>
            )}
            <div className={`w-12 h-12 bg-gradient-to-br ${card.color} rounded-2xl flex items-center justify-center mx-auto mb-2`}>
              <i className={`fas ${card.icon} text-white text-xl`}></i>
            </div>
            <p className="font-bold text-gray-800 text-sm">{card.title}</p>
            <p className="text-gray-400 text-xs">{card.desc}</p>
          </div>
        ))}
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statsCards.map((card) => (
          <div key={card.id} className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100 flex items-center gap-4">
            <div className={`w-14 h-14 ${card.color} rounded-2xl flex items-center justify-center flex-shrink-0`}>
              <i className={`fas ${card.icon} ${card.iconColor} text-2xl`}></i>
            </div>
            <div>
              <p className="text-gray-400 text-xs">{card.title}</p>
              <p className="text-2xl font-bold text-gray-800">{card.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* توزيع الطلبات */}
      <div className="bg-white rounded-2xl p-4 shadow-lg border border-gray-100">
        <div className="flex justify-between items-center mb-3">
          <p className="text-sm font-bold text-gray-700">📊 توزيع الطلبات</p>
          <span className="text-xs text-gray-400">{stats.total} طلب</span>
        </div>
        
        <div className="flex h-4 rounded-full overflow-hidden">
          {stats.byStatus.map((item) => {
            const percentage = stats.total > 0 ? (item.count / stats.total) * 100 : 0;
            return (
              <div 
                key={item.status}
                className={`${statusColors[item.status] || 'bg-gray-400'} transition-all duration-1000`}
                style={{ width: `${percentage}%` }}
                title={`${item.status}: ${item.count}`}
              />
            );
          })}
        </div>
        
        <div className="flex flex-wrap gap-3 mt-2 text-xs">
          {stats.byStatus.map((item) => (
            <span key={item.status} className="flex items-center gap-1">
              <span className={`w-2.5 h-2.5 rounded-full ${statusColors[item.status] || 'bg-gray-400'}`}></span>
              {item.status} ({item.count})
            </span>
          ))}
        </div>
      </div>

      {/* تنبيهات سريعة */}
      {alertCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <i className="fas fa-bell text-red-500"></i>
            </div>
            <div>
              <p className="text-sm font-bold text-red-700">لديك {alertCount} تنبيه</p>
              <p className="text-xs text-red-500">طلبات متأخرة أو منتهية اليوم</p>
            </div>
          </div>
          <button
            onClick={onOpenAlerts}
            className="px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm"
          >
            عرض
          </button>
        </div>
      )}
    </div>
  );
};

export default Home;