import { useState, useEffect } from 'react';
import { purchaseApi } from '../api/purchaseApi';
import type { DashboardStats } from '../types/purchase.types';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

const Dashboard: React.FC<Props> = ({ onClose }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await purchaseApi.getDashboardStats();
      setStats(data);
    } catch (err) {
      setError('حدث خطأ في تحميل الإحصائيات');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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
        { 'المؤشر': 'تنبيهات', 'القيمة': (stats.overdue || 0) + (stats.expiringToday || 0) },
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

  if (error) {
    return (
      <div className="bg-red-50 border-r-4 border-red-500 text-red-700 px-6 py-4 rounded-2xl flex items-center gap-3">
        <i className="fas fa-exclamation-circle text-red-500 text-xl"></i>
        <span className="font-medium">{error}</span>
      </div>
    );
  }

  if (!stats) return null;

  const completionRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
  const avgMonthly = stats.monthlyTrend.length > 0
    ? Math.round(stats.monthlyTrend.reduce((sum, item) => sum + item.count, 0) / stats.monthlyTrend.length)
    : 0;
  const maxMonth = stats.monthlyTrend.length > 0
    ? stats.monthlyTrend.reduce((max, item) => item.count > max.count ? item : max, stats.monthlyTrend[0])
    : null;
  const alertCount = (stats.overdue || 0) + (stats.expiringToday || 0);

  // ✅ بيانات موحدة للبطاقات الإحصائية
  const statCards = [
    { label: 'إجمالي', value: stats.total, icon: 'fa-clipboard-list', color: 'dashboard-card' },
    { label: 'منجز', value: stats.completed, icon: 'fa-check-circle', color: 'dashboard-card-green' },
    { label: 'قيد التنفيذ', value: stats.inProgress, icon: 'fa-spinner', color: 'dashboard-card-yellow' },
    { label: 'معلق', value: stats.pending, icon: 'fa-clock', color: 'dashboard-card-red' },
    { label: 'ملغي', value: stats.cancelled, icon: 'fa-times-circle', color: 'dashboard-card-purple' },
    { label: 'متأخر', value: stats.delayed, icon: 'fa-exclamation-triangle', color: 'dashboard-card-orange' },
  ];

  // ✅ بيانات الإحصائيات الإضافية
  const extraStats = [
    { label: 'نسبة الإنجاز', value: `${completionRate}%`, color: 'from-blue-50 to-blue-100', textColor: 'text-blue-600' },
    { label: 'متوسط شهري', value: avgMonthly, color: 'from-green-50 to-green-100', textColor: 'text-green-600', sub: 'طلب في الشهر' },
    { label: 'أعلى شهر', value: maxMonth ? maxMonth.count : 0, color: 'from-purple-50 to-purple-100', textColor: 'text-purple-600', sub: maxMonth ? maxMonth.month : '-' },
    { label: 'تنبيهات', value: alertCount, color: alertCount > 0 ? 'from-red-50 to-red-100' : 'from-green-50 to-green-100', textColor: alertCount > 0 ? 'text-red-600' : 'text-green-600', sub: alertCount > 0 ? 'بحاجة اهتمام' : 'جميع الطلبات جيدة' },
  ];

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-3xl shadow-2xl p-4 md:p-6 lg:p-8 border border-white/50">
      {/* ✅ Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl md:text-2xl font-black text-gray-800 flex items-center gap-3">
          <i className="fas fa-chart-pie text-purple-500"></i>
          لوحة التحكم والتقارير
        </h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 font-semibold px-3 py-1.5 md:px-4 md:py-2 rounded-xl hover:bg-gray-100 transition-all duration-300 flex items-center gap-2 no-print text-sm"
        >
          <i className="fas fa-times"></i>
          إغلاق
        </button>
      </div>

      {/* ✅ البطاقات الإحصائية - باستخدام حلقة */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4 mb-6">
        {statCards.map((card) => (
          <div key={card.label} className={`${card.color} rounded-2xl p-3 md:p-4 text-white shadow-xl transition-all duration-300 hover:scale-105`}>
            <div className="flex items-center justify-between">
              <i className={`fas ${card.icon} text-lg md:text-2xl opacity-80`}></i>
              <span className="text-xl md:text-3xl font-black">{card.value}</span>
            </div>
            <p className="text-xs md:text-sm font-semibold mt-1 opacity-90">{card.label}</p>
          </div>
        ))}
      </div>

      {/* ✅ إحصائيات إضافية - باستخدام حلقة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {extraStats.map((stat, index) => (
          <div key={index} className={`bg-gradient-to-br ${stat.color} rounded-2xl p-3 md:p-4 text-center`}>
            <p className="text-xs text-gray-600">{stat.label}</p>
            <p className={`text-2xl md:text-3xl font-bold ${stat.textColor}`}>{stat.value}</p>
            {stat.sub && <p className="text-[10px] text-gray-500 mt-0.5">{stat.sub}</p>}
            {stat.label === 'نسبة الإنجاز' && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-full h-1.5 transition-all duration-1000" style={{ width: `${completionRate}%` }}></div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ✅ الرسوم البيانية */}
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
              const barColor = 
                item.status === 'منجز' ? 'from-green-500 to-green-600' :
                item.status === 'قيد التنفيذ' ? 'from-yellow-500 to-yellow-600' :
                item.status === 'معلق' ? 'from-red-500 to-red-600' :
                'from-gray-500 to-gray-600';
              const dotColor =
                item.status === 'منجز' ? 'bg-green-500' :
                item.status === 'قيد التنفيذ' ? 'bg-yellow-500' :
                item.status === 'معلق' ? 'bg-red-500' :
                'bg-gray-500';
              return (
                <div key={item.status} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700 flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${dotColor}`}></span>
                      {item.status}
                    </span>
                    <span className="font-bold text-purple-600">{item.count}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`bg-gradient-to-r ${barColor} rounded-full h-2.5 transition-all duration-1000`}
                      style={{ width: `${percentage}%` }}
                    ></div>
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
            {stats.byRequester.map((item, index) => {
              const colors = ['from-yellow-400 to-yellow-500', 'from-gray-400 to-gray-500', 'from-orange-400 to-orange-500', 'from-purple-400 to-purple-500', 'from-pink-400 to-pink-500'];
              return (
                <div key={index} className="flex items-center gap-3 bg-white rounded-xl px-3 py-2.5 shadow-sm hover:shadow-md transition-all">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-gradient-to-r ${colors[index % colors.length]}`}>
                    {index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700 text-sm">{item.requester}</span>
                      <span className="font-bold text-purple-600 text-sm">{item.count} طلب</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {stats.byRequester.length === 0 && <p className="text-gray-500 text-center py-4">لا توجد بيانات</p>}
          </div>
        </div>
      </div>

      {/* ✅ الاتجاه الشهري */}
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
          {stats.monthlyTrend.length === 0 && <p className="text-gray-500 text-center py-8 w-full">لا توجد بيانات</p>}
        </div>
        {stats.monthlyTrend.length > 1 && (
          <div className="flex flex-wrap justify-between mt-3 text-[10px] md:text-xs text-gray-500 border-t pt-3">
            <span>📈 متوسط: {avgMonthly} طلب/شهر</span>
            <span>📊 أعلى شهر: {maxMonth ? `${maxMonth.month} (${maxMonth.count})` : '-'}</span>
          </div>
        )}
      </div>

      {/* ✅ أزرار التصدير */}
      <div className="mt-6 flex flex-wrap gap-2 md:gap-3 justify-end border-t pt-4 md:pt-6 no-print">
        <button
          onClick={exportDashboardToExcel}
          className="px-3 py-1.5 md:px-5 md:py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 flex items-center gap-1.5 md:gap-2 text-sm"
        >
          <i className="fas fa-file-excel"></i>
          <span className="hidden sm:inline">تصدير Excel</span>
          <span className="sm:hidden">Excel</span>
        </button>
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 md:px-5 md:py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 flex items-center gap-1.5 md:gap-2 text-sm"
        >
          <i className="fas fa-print"></i>
          <span className="hidden sm:inline">طباعة</span>
          <span className="sm:hidden">🖨️</span>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;