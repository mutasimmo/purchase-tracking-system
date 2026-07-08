import { useState, useEffect } from 'react';
import { purchaseApi } from '../api/purchaseApi';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
  purchaseId?: number;
}

const AuditLogs: React.FC<Props> = ({ onClose, purchaseId }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    action: '',
    entityType: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    loadLogs();
  }, [page, filters]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      let response;
      
      if (purchaseId) {
        response = await purchaseApi.getAuditLogsByPurchase(purchaseId);
        setLogs(response);
        setTotal(response.length);
      } else {
        response = await purchaseApi.getAuditLogs({
          page,
          limit: 20,
          ...filters
        });
        setLogs(response.data);
        setTotal(response.total);
      }
    } catch (error) {
      toast.error('❌ حدث خطأ في تحميل سجل التتبع');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    const styles: Record<string, string> = {
      CREATE: 'bg-green-100 text-green-700',
      UPDATE: 'bg-blue-100 text-blue-700',
      DELETE: 'bg-red-100 text-red-700',
      LOGIN: 'bg-purple-100 text-purple-700',
      LOGOUT: 'bg-gray-100 text-gray-700'
    };
    return styles[action] || 'bg-gray-100 text-gray-700';
  };

  const getActionIcon = (action: string) => {
    const icons: Record<string, string> = {
      CREATE: 'fa-plus-circle',
      UPDATE: 'fa-edit',
      DELETE: 'fa-trash-alt',
      LOGIN: 'fa-sign-in-alt',
      LOGOUT: 'fa-sign-out-alt'
    };
    return icons[action] || 'fa-circle';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-5xl w-full max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
            <i className="fas fa-history text-purple-500 text-2xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              {purchaseId ? 'سجل تتبع الطلب' : 'سجل التتبع'}
            </h2>
            <p className="text-sm text-gray-500">{total} سجل</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>

      {/* Filters (للعرض العام فقط) */}
      {!purchaseId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <input
            type="text"
            placeholder="نوع الإجراء"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value })}
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm"
          />
          <input
            type="text"
            placeholder="نوع الكيان"
            value={filters.entityType}
            onChange={(e) => setFilters({ ...filters, entityType: e.target.value })}
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm"
          />
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm"
          />
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            className="border border-gray-300 rounded-xl px-4 py-2 text-sm"
          />
        </div>
      )}

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {logs.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-inbox text-6xl text-gray-300 mb-4"></i>
            <p className="text-gray-500 text-lg">لا توجد سجلات</p>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="bg-gray-50 rounded-xl p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${getActionBadge(log.action)}`}>
                    <i className={`fas ${getActionIcon(log.action)} ml-1`}></i>
                    {log.action === 'CREATE' ? 'إضافة' :
                     log.action === 'UPDATE' ? 'تعديل' :
                     log.action === 'DELETE' ? 'حذف' :
                     log.action === 'LOGIN' ? 'تسجيل دخول' :
                     log.action === 'LOGOUT' ? 'تسجيل خروج' : log.action}
                  </span>
                  <span className="text-sm font-medium text-gray-700">
                    <i className="fas fa-user text-purple-500 ml-1"></i>
                    {log.username}
                  </span>
                  <span className="text-xs text-gray-500">
                    {log.entity_type}: #{log.entity_id}
                  </span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(log.created_at).toLocaleString('ar-SA')}
                </span>
              </div>
              
              {log.changes && (
                <div className="mt-2 text-xs text-gray-600 bg-white rounded-lg p-3 border border-gray-200">
                  <details>
                    <summary className="cursor-pointer font-medium text-purple-600">
                      <i className="fas fa-chevron-down ml-1"></i>
                      عرض التفاصيل
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs">
                      {JSON.stringify(JSON.parse(log.changes), null, 2)}
                    </pre>
                  </details>
                </div>
              )}
              
              {log.ip_address && (
                <div className="mt-1 text-xs text-gray-400 flex gap-4">
                  <span><i className="fas fa-network-wired ml-1"></i> {log.ip_address}</span>
                  {log.user_agent && (
                    <span><i className="fas fa-desktop ml-1"></i> {log.user_agent?.substring(0, 50)}...</span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {!purchaseId && total > 20 && (
        <div className="flex justify-center gap-2 mt-4 pt-4 border-t">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
          >
            السابق
          </button>
          <span className="px-4 py-2 text-gray-600">صفحة {page}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page * 20 >= total}
            className="px-4 py-2 bg-gray-200 rounded-lg disabled:opacity-50"
          >
            التالي
          </button>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;