// src/components/AuditLogs.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { purchaseApi } from '../api/purchaseApi';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  purchaseId?: number;
}

interface AuditLog {
  id: number;
  user_id?: number;
  username: string;
  action: string;
  entity_type: string;
  entity_id?: number;
  changes?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

const AuditLogs: React.FC<Props> = ({ onClose, purchaseId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: ''
  });
  const [expandedLog, setExpandedLog] = useState<number | null>(null);

  const limit = 20;

  // ============================================
  // ✅ جلب السجلات
  // ============================================

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      let response;
      
      if (purchaseId) {
        response = await purchaseApi.getAuditLogsByPurchase(purchaseId);
        setLogs(response || []);
        setTotal(response?.length || 0);
      } else {
        response = await purchaseApi.getAuditLogs({
          page,
          limit,
          ...filters
        });
        setLogs(response.data || []);
        setTotal(response.total || 0);
      }
    } catch (error) {
      toast.error('❌ حدث خطأ في تحميل سجل التتبع');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [page, filters, purchaseId]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // ============================================
  // ✅ دوال مساعدة
  // ============================================

  const getActionBadge = (action: string) => {
    const styles: Record<string, string> = {
      CREATE: 'bg-green-100 text-green-700',
      UPDATE: 'bg-blue-100 text-blue-700',
      DELETE: 'bg-red-100 text-red-700',
      LOGIN: 'bg-purple-100 text-purple-700',
      LOGOUT: 'bg-gray-100 text-gray-700',
      PASSWORD_CHANGE: 'bg-yellow-100 text-yellow-700',
      STATUS_CHANGE: 'bg-orange-100 text-orange-700',
      USER_CREATE: 'bg-indigo-100 text-indigo-700',
      USER_UPDATE: 'bg-teal-100 text-teal-700',
      USER_DELETE: 'bg-rose-100 text-rose-700'
    };
    return styles[action] || 'bg-gray-100 text-gray-700';
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      CREATE: 'fa-plus-circle',
      UPDATE: 'fa-edit',
      DELETE: 'fa-trash-alt',
      LOGIN: 'fa-sign-in-alt',
      LOGOUT: 'fa-sign-out-alt',
      PASSWORD_CHANGE: 'fa-key',
      STATUS_CHANGE: 'fa-exchange-alt',
      USER_CREATE: 'fa-user-plus',
      USER_UPDATE: 'fa-user-edit',
      USER_DELETE: 'fa-user-minus'
    };
    return icons[action] || 'fa-circle';
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      CREATE: 'إضافة',
      UPDATE: 'تعديل',
      DELETE: 'حذف',
      LOGIN: 'تسجيل دخول',
      LOGOUT: 'تسجيل خروج',
      PASSWORD_CHANGE: 'تغيير كلمة المرور',
      STATUS_CHANGE: 'تغيير الحالة',
      USER_CREATE: 'إضافة مستخدم',
      USER_UPDATE: 'تعديل مستخدم',
      USER_DELETE: 'حذف مستخدم'
    };
    return labels[action] || action;
  };

  const getEntityLabel = (entityType: string) => {
    const labels: Record<string, string> = {
      purchase: 'طلب شراء',
      user: 'مستخدم',
      auth: 'مصادقة',
      chat: 'دردشة'
    };
    return labels[entityType] || entityType;
  };

  // ============================================
  // ✅ معالج تغيير الفلاتر
  // ============================================

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(1);
  };

  // ============================================
  // ✅ معالج تغيير الصفحة
  // ============================================

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= Math.ceil(total / limit)) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ============================================
  // ✅ عرض التفاصيل
  // ============================================

  const toggleExpand = (logId: number) => {
    setExpandedLog(expandedLog === logId ? null : logId);
  };

  // ============================================
  // ✅ تنسيق التاريخ
  // ============================================

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ============================================
  // ✅ تحليل التغييرات
  // ============================================

  const parseChanges = (changes: string) => {
    try {
      return JSON.parse(changes);
    } catch {
      return changes;
    }
  };

  // ============================================
  // ✅ حساب إجمالي الصفحات
  // ============================================

  const totalPages = useMemo(() => {
    return Math.ceil(total / limit);
  }, [total]);

  // ============================================
  // ✅ حالة التحميل
  // ============================================

  if (loading) {
    return (
      <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-5xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
            <p className="mt-3 text-gray-500">جاري تحميل السجلات...</p>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // ✅ Render
  // ============================================

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-4 sm:p-6 max-w-5xl w-full max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
            <i className="fas fa-history text-purple-500 text-2xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {purchaseId ? '📋 سجل تتبع الطلب' : '📋 سجل التتبع'}
            </h2>
            <p className="text-sm text-gray-500">
              {total} {total === 1 ? 'سجل' : 'سجلات'}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-xl"
        >
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>

      {/* Filters - للعرض العام فقط */}
      {!purchaseId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">نوع الإجراء</label>
            <select
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">الكل</option>
              <option value="CREATE">إضافة</option>
              <option value="UPDATE">تعديل</option>
              <option value="DELETE">حذف</option>
              <option value="LOGIN">تسجيل دخول</option>
              <option value="LOGOUT">تسجيل خروج</option>
              <option value="STATUS_CHANGE">تغيير الحالة</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">نوع الكيان</label>
            <select
              value={filters.entityType}
              onChange={(e) => handleFilterChange('entityType', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">الكل</option>
              <option value="purchase">طلب شراء</option>
              <option value="user">مستخدم</option>
              <option value="auth">مصادقة</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">من تاريخ</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">إلى تاريخ</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-500 text-lg font-medium">لا توجد سجلات</p>
            <p className="text-sm text-gray-400">لم يتم تسجيل أي نشاط بعد</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="bg-gray-50 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getActionBadge(log.action)}`}>
                    <i className={`fas ${getActionIcon(log.action)} ml-1`}></i>
                    {getActionLabel(log.action)}
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    <i className="fas fa-user text-purple-500 ml-1"></i>
                    {log.username || 'system'}
                  </span>
                  {log.entity_type && (
                    <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded-full">
                      {getEntityLabel(log.entity_type)}
                      {log.entity_id && ` #${log.entity_id}`}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {formatDate(log.created_at)}
                </span>
              </div>
              
              {/* تغييرات */}
              {log.changes && (
                <div className="mt-2">
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="text-xs text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                  >
                    <i className={`fas fa-chevron-${expandedLog === log.id ? 'up' : 'down'}`}></i>
                    {expandedLog === log.id ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                  </button>
                  
                  {expandedLog === log.id && (
                    <div className="mt-2 bg-white rounded-lg p-3 border border-gray-200 overflow-x-auto">
                      <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                        {JSON.stringify(parseChanges(log.changes), null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
              
              {/* IP و User Agent */}
              {(log.ip_address || log.user_agent) && (
                <div className="mt-1 text-xs text-gray-400 flex flex-wrap gap-4">
                  {log.ip_address && (
                    <span><i className="fas fa-network-wired ml-1"></i> {log.ip_address}</span>
                  )}
                  {log.user_agent && (
                    <span><i className="fas fa-desktop ml-1"></i> {log.user_agent.substring(0, 60)}...</span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!purchaseId && totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t">
          <button
            onClick={() => handlePageChange(page - 1)}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-chevron-right"></i>
          </button>
          
          <span className="px-4 py-2 text-sm text-gray-600">
            صفحة {page} من {totalPages}
          </span>
          
          <button
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-chevron-left"></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;