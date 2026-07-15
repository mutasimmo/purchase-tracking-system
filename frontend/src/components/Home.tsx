// src/components/Home.tsx
import { useState, useEffect, useMemo } from 'react';
import { purchaseApi } from '../api/purchaseApi';
import type { DashboardStats } from '../types/purchase.types';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

interface Props {
  onOpenAddForm: () => void;
  onOpenAlerts: () => void;
}

const Home: React.FC<Props> = ({ onOpenAddForm, onOpenAlerts }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFullDashboard, setShowFullDashboard] = useState(false);

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
  // ✅ حساب القيم المحسوبة
  // ============================================

  const completionRate = useMemo(() => {
    if (!stats || stats.total === 0) return 0;
    return Math.round((stats.completed / stats.total) * 100);
  }, [stats]);

  const avgMonthly = useMemo(() => {
    if (!stats || stats.monthlyTrend.length === 0) return 0;
    const sum = stats.monthlyTrend.reduce((acc, item) => acc + item.count, 0);
    return Math.round(sum / stats.monthlyTrend.length);
  }, [stats]);

  const maxMonth = useMemo(() => {
    if (!stats || stats.monthlyTrend.length === 0) return null;
    return stats.monthlyTrend.reduce((max, item) => item.count > max.count ? item : max);
  }, [stats]);

  const alertCount = useMemo(() => {
    if (!stats) return 0;
    return (stats.overdue || 0) + (stats.expiringToday || 0);
  }, [stats]);

  // ============================================
  // ✅ تصدير إلى Excel
  // ============================================

  const exportDashboardToExcel = () => {
    if (!stats) return;
    try {
      const summaryData = [
        { 'المؤشر': 'إجمالي الطلبات', 'القيمة': stats.total },
        { 'المؤشر': 'منجز', 'القيمة': stats.completed },
        { 'المؤشر': 'قيد التنفيذ', 'القيمة': stats.inProgress },
        { 'المؤشر': 'معلق', 'القيمة': stats.pending },
        { 'المؤشر': 'ملغي', 'القيمة': stats.cancelled },
        { 'المؤشر': 'متأخر', 'القيمة': stats.delayed },
        { 'المؤشر': 'تنبيهات', 'القيمة': alertCount },
        { 'المؤشر': 'نسبة الإنجاز', 'القيمة': `${completionRate}%` },
      ];

      const statusData = stats.byStatus.map(item => ({
        'الحالة': item.status,
        'العدد': item.count,
        'النسبة المئوية': stats.total > 0 ? `${Math.round((item.count / stats.total) * 100)}%` : '0%'
      }));

      const requesterData = stats.byRequester.map((item, index) => ({
        'الترتيب': index + 1,
        'الجهة': item.requester,
        'عدد الطلبات': item.count
      }));

      const monthlyData = stats.monthlyTrend.map(item => ({
        'الشهر': item.month,
        'عدد الطلبات': item.count
      }));

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'الملخص');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(statusData), 'توزيع الحالات');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(requesterData), 'أكثر الجهات طلباً');
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyData), 'الاتجاه الشهري');

      const fileName = `تقرير_الإحصائيات_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('📊 تم تصدير الإحصائيات بنجاح');
    } catch (error) {
      toast.error('❌ حدث خطأ في تصدير الإحصائيات');
      console.error(error);
    }
  };

  // ============================================
  // ✅ حالة التحميل
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-semibold">جاري تحميل الإحصائيات...</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  // ============================================
  // ✅ ألوان الحالات
  // ============================================

  const statusColors: Record<string, string> = {
    'منجز': 'bg-green-500',
    'قيد التنفيذ': 'bg-yellow-500',
    'معلق': 'bg-red-500',
    'ملغي': 'bg-gray-400'
  };

  const getStatusBarColors = (status: string) => {
    const colors: Record<string, { bar: string; dot: string }> = {
      'منجز': { bar: 'from-green-500 to-green-600', dot: 'bg-green-500' },
      'قيد التنفيذ': { bar: 'from-yellow-500 to-yellow-600', dot: 'bg-yellow-500' },
      'معلق': { bar: 'from-red-500 to-red-600', dot: 'bg-red-500' },
      'ملغي': { bar: 'from-gray-500 to-gray-600', dot: 'bg-gray-500' }
    };
    return colors[status] || { bar: 'from-gray-400 to-gray-500', dot: 'bg-gray-400' };
  };

  const requesterColors = [
    'from-yellow-400 to-yellow-500',
    'from-gray-400 to-gray-500',
    'from-orange-400 to-orange-500',
    'from-purple-400 to-purple-500',
    'from-pink-400 to-pink-500'
  ];

  // ============================================
  // ✅ بطاقات الوصول السريع
  // ============================================

  const quickCards = [
    { 
      id: 'dashboard',
      icon: 'fa-chart-pie', 
      title: 'التقارير', 
      desc: showFullDashboard ? 'إخفاء الإحصائيات' : 'عرض الإحصائيات',
      color: 'from-blue-500 to-blue-600',
      onClick: () => setShowFullDashboard(!showFullDashboard)
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
      onClick: exportDashboardToExcel
    }
  ];

  // ============================================
  // ✅ الإحصائيات السريعة
  // ============================================

  const statsCards = [
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

  // ============================================
  // ✅ البطاقات الإحصائية الكاملة (Dashboard)
  // ============================================

  const fullStatCards = [
    { label: 'إجمالي', value: stats.total, icon: 'fa-clipboard-list', color: 'dashboard-card' },
    { label: 'منجز', value: stats.completed, icon: 'fa-check-circle', color: 'dashboard-card-green' },
    { label: 'قيد التنفيذ', value: stats.inProgress, icon: 'fa-spinner', color: 'dashboard-card-yellow' },
    { label: 'معلق', value: stats.pending, icon: 'fa-clock', color: 'dashboard-card-red' },
    { label: 'ملغي', value: stats.cancelled, icon: 'fa-times-circle', color: 'dashboard-card-purple' },
    { label: 'متأخر', value: stats.delayed, icon: 'fa-exclamation-triangle', color: 'dashboard-card-orange' },
  ];

  const extraStats = [
    { 
      label: 'نسبة الإنجاز', 
      value: `${completionRate}%`, 
      color: 'from-blue-50 to-blue-100', 
      textColor: 'text-blue-600',
      hasProgress: true
    },
    { 
      label: 'متوسط شهري', 
      value: avgMonthly, 
      color: 'from-green-50 to-green-100', 
      textColor: 'text-green-600', 
      sub: 'طلب في الشهر' 
    },
    { 
      label: 'أعلى شهر', 
      value: maxMonth ? maxMonth.count : 0, 
      color: 'from-purple-50 to-purple-100', 
      textColor: 'text-purple-600', 
      sub: maxMonth ? maxMonth.month : '-' 
    },
    { 
      label: 'تنبيهات', 
      value: alertCount, 
      color: alertCount > 0 ? 'from-red-50 to-red-100' : 'from-green-50 to-green-100', 
      textColor: alertCount > 0 ? 'text-red-600' : 'text-green-600', 
      sub: alertCount > 0 ? 'بحاجة اهتمام' : 'جميع الطلبات جيدة' 
    },
  ];

  // ============================================
  // ✅ Render
  // ============================================

  return (
    <div className="space-y-6">
      {/* ==========================================
           ✅ الجزء 1: الترحيب والبطاقات السريعة
           ========================================== */}
      
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
              />
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

      {/* ==========================================
           ✅ الجزء 2: لوحة التحكم الكاملة (تظهر عند الضغط على "التقارير")
           ========================================== */}
      
      {showFullDashboard && (
        <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-4 md:p-6 lg:p-8 border border-white/50">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl md:text-2xl font-black text-gray-800 flex items-center gap-3">
              <i className="fas fa-chart-pie text-purple-500"></i>
              لوحة التحكم والتقارير
            </h2>
            <button
              onClick={() => setShowFullDashboard(false)}
              className="text-gray-500 hover:text-gray-700 font-semibold px-3 py-2 rounded-xl hover:bg-gray-100 transition-all duration-300 flex items-center gap-2 text-sm"
            >
              <i className="fas fa-times"></i>
              <span className="hidden sm:inline">إغلاق</span>
            </button>
          </div>

          {/* البطاقات الإحصائية الكاملة */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
            {fullStatCards.map((card) => (
              <div key={card.label} className={`${card.color} rounded-2xl p-3 md:p-4 text-white shadow-xl transition-all duration-300 hover:scale-105`}>
                <div className="flex items-center justify-between">
                  <i className={`fas ${card.icon} text-lg md:text-2xl opacity-80`}></i>
                  <span className="text-xl md:text-3xl font-black">{card.value}</span>
                </div>
                <p className="text-xs md:text-sm font-semibold mt-1 opacity-90">{card.label}</p>
              </div>
            ))}
          </div>

          {/* إحصائيات إضافية */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
            {extraStats.map((stat, index) => (
              <div key={index} className={`bg-gradient-to-br ${stat.color} rounded-2xl p-3 md:p-4 text-center`}>
                <p className="text-xs text-gray-600">{stat.label}</p>
                <p className={`text-2xl md:text-3xl font-bold ${stat.textColor}`}>{stat.value}</p>
                {stat.sub && <p className="text-[10px] text-gray-500 mt-0.5">{stat.sub}</p>}
                {stat.hasProgress && (
                  <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                    <div 
                      className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-full h-1.5 transition-all duration-1000" 
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* الرسوم البيانية */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* توزيع الطلبات حسب الحالة */}
            <div className="bg-gray-50 rounded-2xl p-4 md:p-6">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm md:text-base">
                <i className="fas fa-chart-bar text-purple-500"></i>
                توزيع الطلبات حسب الحالة
              </h3>
              <div className="space-y-3">
                {stats.byStatus.map((item) => {
                  const percentage = stats.total > 0 ? (item.count / stats.total) * 100 : 0;
                  const colors = getStatusBarColors(item.status);
                  return (
                    <div key={item.status} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-700 flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`}></span>
                          {item.status}
                        </span>
                        <span className="font-bold text-purple-600">{item.count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div
                          className={`bg-gradient-to-r ${colors.bar} rounded-full h-2.5 transition-all duration-1000`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* أكثر الجهات طلباً */}
            <div className="bg-gray-50 rounded-2xl p-4 md:p-6">
              <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm md:text-base">
                <i className="fas fa-building text-purple-500"></i>
                أكثر الجهات طلباً
              </h3>
              <div className="space-y-3">
                {stats.byRequester.map((item, index) => (
                  <div key={index} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 shadow-sm hover:shadow-md transition-all">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-r ${requesterColors[index % requesterColors.length]}`}>
                      {index + 1}
                    </span>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700 text-sm">{item.requester}</span>
                        <span className="font-bold text-purple-600 text-sm">{item.count} طلب</span>
                      </div>
                    </div>
                  </div>
                ))}
                {stats.byRequester.length === 0 && (
                  <p className="text-gray-500 text-center py-4">لا توجد بيانات</p>
                )}
              </div>
            </div>
          </div>

          {/* الاتجاه الشهري */}
          <div className="mt-6 bg-gray-50 rounded-2xl p-4 md:p-6">
            <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm md:text-base">
              <i className="fas fa-chart-line text-purple-500"></i>
              الاتجاه الشهري (آخر 6 أشهر)
            </h3>
            <div className="flex items-end h-40 gap-2 md:gap-3">
              {stats.monthlyTrend.map((item) => {
                const maxCount = Math.max(...stats.monthlyTrend.map(m => m.count), 1);
                const height = (item.count / maxCount) * 100;
                const trendColor = item.count > avgMonthly ? 'from-green-500 to-green-600' : 'from-purple-500 to-indigo-600';
                return (
                  <div key={item.month} className="flex-1 flex flex-col items-center group">
                    <div 
                      className={`w-full bg-gradient-to-t ${trendColor} rounded-t-lg transition-all duration-1000 flex items-center justify-center relative`}
                      style={{ height: `${Math.max(height, 15)}%`, minHeight: '30px' }}
                    >
                      <span className="text-[10px] text-white font-bold">{item.count}</span>
                    </div>
                    <span className="text-[10px] text-gray-600 mt-1.5 font-medium">{item.month.substring(5)}</span>
                  </div>
                );
              })}
              {stats.monthlyTrend.length === 0 && (
                <p className="text-gray-500 text-center py-8 w-full">لا توجد بيانات</p>
              )}
            </div>
            {stats.monthlyTrend.length > 1 && (
              <div className="flex flex-wrap justify-between mt-3 text-[10px] md:text-xs text-gray-500 border-t pt-3">
                <span>📈 متوسط: {avgMonthly} طلب/شهر</span>
                <span>📊 أعلى شهر: {maxMonth ? `${maxMonth.month} (${maxMonth.count})` : '-'}</span>
              </div>
            )}
          </div>

          {/* تنبيهات */}
          {alertCount > 0 && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between">
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
      )}
    </div>
  );
};

export default Home;