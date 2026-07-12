// src/components/Filters.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import type { PurchaseFilters, PurchaseStatus } from '../types/purchase.types';

interface Props {
  onFilterChange: (filters: PurchaseFilters) => void;
  onSearch: (search: string) => void;
  loading?: boolean;
  initialFilters?: PurchaseFilters;
}

const Filters: React.FC<Props> = ({ 
  onFilterChange, 
  onSearch, 
  loading, 
  initialFilters 
}) => {
  const [searchTerm, setSearchTerm] = useState(initialFilters?.search || '');
  const [status, setStatus] = useState<PurchaseStatus | ''>((initialFilters?.status as any) || '');
  const [startDate, setStartDate] = useState(initialFilters?.startDate || '');
  const [endDate, setEndDate] = useState(initialFilters?.endDate || '');
  
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const filters: PurchaseFilters = {};
    // ✅ إزالة التحقق !== ''
    if (status) {
      filters.status = status;
    }
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (searchTerm) filters.search = searchTerm;

    searchTimeoutRef.current = setTimeout(() => {
      onFilterChange(filters);
    }, 500);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [status, startDate, endDate, searchTerm, onFilterChange]);

  const handleSearch = useCallback(() => {
    onSearch(searchTerm);
    const filters: PurchaseFilters = {};
    // ✅ إزالة التحقق !== ''
    if (status) filters.status = status;
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (searchTerm) filters.search = searchTerm;
    onFilterChange(filters);
  }, [searchTerm, status, startDate, endDate, onSearch, onFilterChange]);

  const handleClear = useCallback(() => {
    const activeFilters = [searchTerm, status, startDate, endDate].filter(Boolean).length;
    
    if (activeFilters > 0) {
      if (!window.confirm('هل أنت متأكد من مسح جميع الفلاتر؟')) {
        return;
      }
    }
    
    setSearchTerm('');
    setStatus('');
    setStartDate('');
    setEndDate('');
    onFilterChange({});
    onSearch('');
  }, [searchTerm, status, startDate, endDate, onFilterChange, onSearch]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const statusOptions: (PurchaseStatus | '')[] = ['', 'قيد التنفيذ', 'منجز', 'معلق', 'ملغي'];
  const activeFiltersCount = [searchTerm, status, startDate, endDate].filter(Boolean).length;

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-3 md:p-4 mb-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 md:gap-3 items-end">
        <div className="col-span-2 sm:col-span-1">
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
            <i className="fas fa-search text-purple-500"></i> بحث
          </label>
          <div className="flex">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="رقم الطلب، الجهة..."
              className="flex-1 border border-gray-300 rounded-r-lg px-2 py-1.5 md:px-4 md:py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs md:text-sm"
              disabled={loading}
            />
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-purple-600 text-white rounded-l-lg hover:bg-purple-700 transition-colors"
              disabled={loading}
            >
              <i className="fas fa-search text-xs md:text-sm"></i>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
            <i className="fas fa-tag text-purple-500"></i> الحالة
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as PurchaseStatus | '')}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 md:px-4 md:py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs md:text-sm"
            disabled={loading}
          >
            {statusOptions.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'الكل'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
            <i className="fas fa-calendar-alt text-purple-500"></i> من
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 md:px-4 md:py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs md:text-sm"
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-xs md:text-sm font-medium text-gray-700 mb-1">
            <i className="fas fa-calendar-alt text-purple-500"></i> إلى
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 md:px-4 md:py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-xs md:text-sm"
            disabled={loading}
          />
        </div>

        <div className="flex gap-1 md:gap-2">
          <button
            onClick={handleClear}
            className="flex-1 px-2 py-1.5 md:px-4 md:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-xs md:text-sm flex items-center justify-center gap-1 md:gap-2"
            disabled={loading}
          >
            <i className="fas fa-undo text-xs"></i>
            <span className="hidden sm:inline">مسح</span>
          </button>
        </div>
      </div>

      {activeFiltersCount > 0 && (
        <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-gray-200">
          <div className="flex flex-wrap items-center gap-1 md:gap-2">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <i className="fas fa-filter"></i> 
              الفلترة ({activeFiltersCount}):
            </span>
            {searchTerm && (
              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 md:py-1 rounded-full">
                بحث: {searchTerm}
              </span>
            )}
            {status && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 md:py-1 rounded-full">
                {status}
              </span>
            )}
            {startDate && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 md:py-1 rounded-full">
                من: {startDate}
              </span>
            )}
            {endDate && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 md:py-1 rounded-full">
                إلى: {endDate}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Filters;