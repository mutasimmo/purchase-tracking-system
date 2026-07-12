// src/components/Pagination.tsx
import { useState, useMemo } from 'react';

interface Props {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  totalItems?: number;
  itemsPerPage?: number;
}

const Pagination: React.FC<Props> = ({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  loading,
  totalItems,
  itemsPerPage 
}) => {
  // ============================================
  // ✅ حساب نطاق العناصر المعروضة
  // ============================================

  const itemRange = useMemo(() => {
    if (!totalItems || !itemsPerPage) return null;
    const start = (currentPage - 1) * itemsPerPage + 1;
    const end = Math.min(currentPage * itemsPerPage, totalItems);
    return { start, end };
  }, [currentPage, totalItems, itemsPerPage]);

  // ============================================
  // ✅ حساب أرقام الصفحات
  // ============================================

  const getPageNumbers = (): (number | string)[] => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    pages.push(1);

    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
      pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      if (i !== 1 && i !== totalPages) {
        pages.push(i);
      }
    }

    if (end < totalPages - 1) {
      pages.push('...');
    }

    if (totalPages > 1) {
      pages.push(totalPages);
    }

    return pages;
  };

  // ============================================
  // ✅ معالج تغيير الصفحة
  // ============================================

  const handlePageChange = (page: number) => {
    if (page !== currentPage && page >= 1 && page <= totalPages && !loading) {
      onPageChange(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // ============================================
  // ✅ معالج الانتقال إلى الصفحة المحددة
  // ============================================

  const [goToPage, setGoToPage] = useState<number | string>('');
  
  const handleGoTo = (e: React.FormEvent) => {
    e.preventDefault();
    const page = Number(goToPage);
    if (page >= 1 && page <= totalPages) {
      handlePageChange(page);
    }
    setGoToPage('');
  };

  // ============================================
  // ✅ إذا كان هناك صفحة واحدة فقط
  // ============================================

  if (totalPages <= 1) return null;

  // ============================================
  // ✅ Render
  // ============================================

  return (
    <div className="flex flex-col items-center gap-3 mt-6">
      {/* معلومات العرض */}
      {itemRange && (
        <div className="text-sm text-gray-500">
          عرض {itemRange.start} - {itemRange.end} من {totalItems} 
          {totalItems === 1 ? ' طلب' : ' طلبات'}
        </div>
      )}

      {/* أزرار التصفح */}
      <div className="flex flex-wrap items-center justify-center gap-1 md:gap-2">
        {/* زر الصفحة الأولى */}
        <button
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1 || loading}
          className="px-3 py-2 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          title="الصفحة الأولى"
        >
          <i className="fas fa-angle-double-right"></i>
        </button>

        {/* زر السابق */}
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || loading}
          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
        >
          <i className="fas fa-chevron-right"></i>
          <span className="hidden sm:inline">السابق</span>
        </button>

        {/* أرقام الصفحات */}
        <div className="flex gap-1">
          {getPageNumbers().map((page, index) => (
            typeof page === 'number' ? (
              <button
                key={index}
                onClick={() => handlePageChange(page)}
                className={`min-w-[40px] h-10 px-3 rounded-lg transition-colors text-sm font-medium ${
                  page === currentPage
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                disabled={loading}
              >
                {page}
              </button>
            ) : (
              <span key={index} className="min-w-[40px] h-10 flex items-center justify-center text-gray-400 text-sm">
                {page}
              </span>
            )
          ))}
        </div>

        {/* زر التالي */}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || loading}
          className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-1"
        >
          <span className="hidden sm:inline">التالي</span>
          <i className="fas fa-chevron-left"></i>
        </button>

        {/* زر الصفحة الأخيرة */}
        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages || loading}
          className="px-3 py-2 text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          title="الصفحة الأخيرة"
        >
          <i className="fas fa-angle-double-left"></i>
        </button>
      </div>

      {/* مربع الانتقال إلى صفحة محددة */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">انتقل إلى</span>
        <form onSubmit={handleGoTo} className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={totalPages}
            value={goToPage}
            onChange={(e) => setGoToPage(e.target.value)}
            className="w-16 px-2 py-1 border border-gray-300 rounded-lg text-center focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="صفحة"
            disabled={loading}
          />
          <button
            type="submit"
            className="px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm"
            disabled={loading}
          >
            اذهب
          </button>
        </form>
        <span className="text-gray-500">من {totalPages}</span>
      </div>

      {/* مؤشر التحميل */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <i className="fas fa-spinner fa-spin"></i>
          جاري التحميل...
        </div>
      )}
    </div>
  );
};

export default Pagination;