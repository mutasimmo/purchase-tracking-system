// src/components/PurchaseTable.tsx
import { useRef, useCallback, useMemo } from 'react';
import type { Purchase } from '../types/purchase.types';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

// ============================================
// ✅ دوال مساعدة
// ============================================

const getStatusClass = (status: string): string => {
  const statusMap: Record<string, string> = {
    'منجز': 'status-completed',
    'قيد التنفيذ': 'status-inprogress',
    'معلق': 'status-pending',
    'ملغي': 'status-cancelled'
  };
  return statusMap[status] || 'status-pending';
};

const getStatusIcon = (status: string): string => {
  const iconMap: Record<string, string> = {
    'منجز': 'fa-check-circle',
    'قيد التنفيذ': 'fa-spinner fa-pulse',
    'معلق': 'fa-clock',
    'ملغي': 'fa-times-circle'
  };
  return iconMap[status] || 'fa-circle';
};

const isOverdue = (purchase: Purchase): boolean => {
  if (purchase.status === 'منجز' || purchase.status === 'ملغي') return false;
  const deliveryDate = new Date(purchase.delivery_date);
  const today = new Date();
  const diffDays = Math.ceil((today.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 2;
};

const getAlertClass = (purchase: Purchase): string => {
  if (purchase.status === 'منجز' || purchase.status === 'ملغي') return '';
  const deliveryDate = new Date(purchase.delivery_date);
  const today = new Date();
  const diffDays = Math.ceil((today.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays >= 2) return 'bg-red-50 border-r-4 border-red-500';
  if (diffDays >= 1) return 'bg-orange-50 border-r-4 border-orange-400';
  return '';
};

const getDaysRemaining = (purchase: Purchase): number => {
  if (purchase.status === 'منجز' || purchase.status === 'ملغي') return 0;
  const deliveryDate = new Date(purchase.delivery_date);
  const today = new Date();
  return Math.ceil((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

// ============================================
// ✅ المكون الرئيسي
// ============================================

interface Props {
  purchases: Purchase[];
  onEdit: (purchase: Purchase) => void;
  onDelete: (id: number) => void;
  onStatusChange?: (id: number, status: string) => void;
  loading?: boolean;
}

const PurchaseTable: React.FC<Props> = ({ 
  purchases, 
  onEdit, 
  onDelete, 
  onStatusChange,
  loading 
}) => {
  const printRef = useRef<HTMLDivElement>(null);

  // ============================================
  // ✅ إحصائيات محسوبة
  // ============================================

  const overdueCount = useMemo(() => {
    return purchases.filter(p => isOverdue(p)).length;
  }, [purchases]);

  const statusCounts = useMemo(() => {
    return purchases.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [purchases]);

  // ============================================
  // ✅ عرض حالة الطلب مع قائمة منسدلة
  // ============================================

  const renderStatus = (purchase: Purchase) => {
    if (onStatusChange) {
      return (
        <select
          value={purchase.status}
          onChange={(e) => onStatusChange(purchase.id!, e.target.value)}
          className="border rounded-lg px-2 py-1 text-xs md:text-sm focus:ring-2 focus:ring-purple-500"
        >
          <option value="قيد التنفيذ">قيد التنفيذ</option>
          <option value="منجز">منجز</option>
          <option value="معلق">معلق</option>
          <option value="ملغي">ملغي</option>
        </select>
      );
    }
    
    return (
      <span className={`status-badge ${getStatusClass(purchase.status)} text-xs md:text-sm`}>
        <i className={`fas ${getStatusIcon(purchase.status)}`}></i>
        <span className="hidden sm:inline">{purchase.status}</span>
        <span className="sm:hidden">
          {purchase.status === 'قيد التنفيذ' ? 'تنفيذ' :
           purchase.status === 'منجز' ? 'منجز' :
           purchase.status === 'معلق' ? 'معلق' :
           'ملغي'}
        </span>
      </span>
    );
  };

  // ============================================
  // ✅ تصدير إلى Excel
  // ============================================

  const exportToExcel = useCallback(() => {
    try {
      if (purchases.length === 0) {
        toast.error('❌ لا توجد بيانات للتصدير');
        return;
      }

      const data = purchases.map(p => ({
        'رقم الطلب': p.request_number,
        'التاريخ': new Date(p.date).toLocaleDateString('ar-SA'),
        'الجهة الطالبة': p.requester,
        'وصف الطلب': p.description,
        'المستلم': p.receiver,
        'تاريخ التسليم': new Date(p.delivery_date).toLocaleDateString('ar-SA'),
        'المتبقي (أيام)': getDaysRemaining(p),
        'ملحوظات': p.notes || '',
        'موقف التنفيذ': p.status
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'طلبات المشتريات');
      
      ws['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 30 },
        { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 25 },
        { wch: 15 }
      ];

      const fileName = `تقرير_المشتريات_${new Date().toLocaleDateString('ar-SA').replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('📊 تم تصدير الملف بنجاح');
    } catch (error) {
      toast.error('❌ حدث خطأ في تصدير الملف');
      console.error(error);
    }
  }, [purchases]);

  // ============================================
  // ✅ طباعة التقرير
  // ============================================

  const handlePrintReport = useCallback(() => {
    if (purchases.length === 0) {
      toast.error('❌ لا توجد بيانات للطباعة');
      return;
    }

    const printHTML = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>تقرير طلبات المشتريات</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Cairo', 'Tajawal', sans-serif;
            background: white;
            padding: 20px 15px;
            direction: rtl;
          }

          @page {
            size: A4 landscape;
            margin: 10mm 8mm 10mm 8mm;
          }

          .report-header {
            text-align: center;
            margin-bottom: 15px;
            padding-bottom: 12px;
            border-bottom: 3px solid #1a1a2e;
          }

          .report-header h1 {
            font-size: 24px;
            font-weight: 900;
            color: #1a1a2e;
            margin-bottom: 3px;
          }

          .report-header .subtitle {
            font-size: 14px;
            color: #666;
            font-weight: 500;
          }

          .report-header .date-info {
            font-size: 12px;
            color: #999;
            margin-top: 5px;
          }

          .report-header .total-info {
            font-size: 13px;
            color: #555;
            margin-top: 3px;
            font-weight: 600;
          }

          .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 11px;
            margin-top: 5px;
          }

          .report-table thead {
            background: #1a1a2e;
          }

          .report-table thead th {
            color: white;
            padding: 8px 6px;
            font-size: 10px;
            font-weight: 700;
            text-align: center;
            border: 1px solid #1a1a2e;
            letter-spacing: 0.3px;
            white-space: nowrap;
          }

          .report-table tbody td {
            padding: 6px 5px;
            font-size: 10px;
            text-align: center;
            border: 1px solid #ddd;
            color: #1a1a2e;
            vertical-align: middle;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 120px;
          }

          .report-table tbody tr:nth-child(even) {
            background-color: #f8f9fa;
          }

          .report-table tbody tr:hover {
            background-color: #f0f0f0;
          }

          .col-number { width: 30px; min-width: 30px; }
          .col-request { width: 70px; min-width: 70px; }
          .col-date { width: 75px; min-width: 75px; }
          .col-requester { width: 110px; min-width: 110px; }
          .col-description { width: 150px; min-width: 100px; max-width: 180px; }
          .col-receiver { width: 100px; min-width: 100px; }
          .col-delivery { width: 75px; min-width: 75px; }
          .col-notes { width: 100px; min-width: 80px; max-width: 140px; }
          .col-status { width: 85px; min-width: 85px; }

          .report-status {
            padding: 3px 10px;
            border-radius: 4px;
            font-size: 9px;
            font-weight: 700;
            display: inline-block;
            white-space: nowrap;
          }

          .report-status.completed {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }

          .report-status.inprogress {
            background: #fff3cd;
            color: #856404;
            border: 1px solid #ffeaa7;
          }

          .report-status.pending {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }

          .report-status.cancelled {
            background: #e2e3e5;
            color: #383d41;
            border: 1px solid #d6d8db;
          }

          .overdue-text {
            color: #dc3545;
            font-weight: 700;
          }

          .overdue-badge {
            background: #dc3545;
            color: white;
            font-size: 8px;
            padding: 1px 5px;
            border-radius: 3px;
            margin-right: 3px;
            display: inline-block;
          }

          .report-footer {
            text-align: center;
            font-size: 10px;
            color: #999;
            margin-top: 15px;
            padding-top: 10px;
            border-top: 1px solid #eee;
          }

          @media print {
            body {
              padding: 8px !important;
              margin: 0 !important;
            }
            .report-header h1 {
              font-size: 20px !important;
            }
            .report-header .subtitle {
              font-size: 12px !important;
            }
            .report-table {
              font-size: 9px !important;
            }
            .report-table thead th {
              font-size: 8px !important;
              padding: 5px 3px !important;
            }
            .report-table tbody td {
              font-size: 8px !important;
              padding: 4px 3px !important;
            }
            .report-status {
              font-size: 8px !important;
              padding: 2px 6px !important;
            }
            .no-print {
              display: none !important;
            }
          }

          @media screen and (max-width: 1024px) {
            .report-table {
              font-size: 10px !important;
            }
            .report-table thead th,
            .report-table tbody td {
              padding: 4px 3px !important;
              font-size: 9px !important;
            }
            .report-header h1 {
              font-size: 20px !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <h1>📋 تقرير طلبات المشتريات</h1>
          <div class="subtitle">نظام متابعة المشتريات</div>
          <div class="date-info">📅 تاريخ الطباعة: ${new Date().toLocaleString('ar-SA', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}</div>
          <div class="total-info">📊 إجمالي الطلبات: <span style="color: #667eea; font-size: 16px;">${purchases.length}</span></div>
        </div>

        <table class="report-table">
          <thead>
            <tr>
              <th class="col-number">#</th>
              <th class="col-request">رقم الطلب</th>
              <th class="col-date">التاريخ</th>
              <th class="col-requester">الجهة الطالبة</th>
              <th class="col-description">وصف الطلب</th>
              <th class="col-receiver">المستلم</th>
              <th class="col-delivery">تاريخ التسليم</th>
              <th class="col-notes">ملحوظات</th>
              <th class="col-status">موقف التنفيذ</th>
            </tr>
          </thead>
          <tbody>
            ${purchases.map((purchase, index) => {
              const status = purchase.status;
              const statusClass = 
                status === 'منجز' ? 'completed' :
                status === 'قيد التنفيذ' ? 'inprogress' :
                status === 'معلق' ? 'pending' :
                'cancelled';
              
              const isOverdueStatus = isOverdue(purchase);
              const deliveryDate = new Date(purchase.delivery_date).toLocaleDateString('ar-SA');
              
              return `
                <tr>
                  <td>${index + 1}</td>
                  <td><strong>${purchase.request_number}</strong></td>
                  <td>${new Date(purchase.date).toLocaleDateString('ar-SA')}</td>
                  <td style="text-align: right;">${purchase.requester}</td>
                  <td style="text-align: right; font-size: 9px;">${purchase.description || '-'}</td>
                  <td>${purchase.receiver}</td>
                  <td>
                    ${deliveryDate}
                    ${isOverdueStatus ? '<span class="overdue-badge">⚠️</span>' : ''}
                  </td>
                  <td style="text-align: right; font-size: 9px; color: #666;">${purchase.notes || '-'}</td>
                  <td>
                    <span class="report-status ${statusClass}">
                      ${status}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>

        <div class="report-footer">
          تم إنشاء هذا التقرير بواسطة نظام متابعة المشتريات | جميع الحقوق محفوظة © ${new Date().getFullYear()}
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank', 'width=1100,height=700');
    if (!printWindow) {
      toast.error('❌ يرجى السماح للنوافذ المنبثقة لتتمكن من الطباعة');
      return;
    }

    printWindow.document.write(printHTML);
    printWindow.document.close();
  }, [purchases]);

  // ============================================
  // ✅ حالة التحميل
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 md:h-16 md:w-16 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600 font-semibold text-base md:text-lg">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // ✅ لا توجد بيانات
  // ============================================

  if (purchases.length === 0) {
    return (
      <div className="text-center py-16">
        <i className="fas fa-inbox text-4xl md:text-6xl text-gray-300 mb-4"></i>
        <p className="text-gray-500 text-lg md:text-xl font-semibold">لا توجد طلبات لعرضها</p>
        <p className="text-gray-400 text-sm md:text-base">قم بإضافة طلب جديد باستخدام الزر أعلاه</p>
      </div>
    );
  }

  // ============================================
  // ✅ العرض الرئيسي
  // ============================================

  return (
    <div>
      {/* ملخص وأزرار */}
      <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
        <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-xl">
          <span className="text-sm text-gray-600">
            📊 إجمالي: <strong>{purchases.length}</strong>
          </span>
          {Object.entries(statusCounts).map(([status, count]) => (
            <span key={status} className="text-sm text-gray-600">
              {status}: <strong>{count}</strong>
            </span>
          ))}
          {overdueCount > 0 && (
            <span className="text-sm text-red-600">
              ⚠️ متأخر: <strong>{overdueCount}</strong>
            </span>
          )}
        </div>
        
        <div className="flex gap-2 no-print">
          <button
            onClick={handlePrintReport}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
          >
            <i className="fas fa-print"></i>
            <span className="hidden sm:inline">طباعة</span>
          </button>
          <button
            onClick={exportToExcel}
            className="px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
          >
            <i className="fas fa-file-excel"></i>
            <span className="hidden sm:inline">تصدير Excel</span>
          </button>
        </div>
      </div>

      {/* الجدول */}
      <div ref={printRef} className="table-modern fade-in-up print-container overflow-x-auto">
        <table className="min-w-[800px] md:min-w-full">
          <thead>
            <tr>
              <th className="whitespace-nowrap">#</th>
              <th className="whitespace-nowrap">رقم الطلب</th>
              <th className="whitespace-nowrap">التاريخ</th>
              <th className="whitespace-nowrap hidden sm:table-cell">الجهة الطالبة</th>
              <th className="whitespace-nowrap hidden md:table-cell">وصف الطلب</th>
              <th className="whitespace-nowrap hidden lg:table-cell">المستلم</th>
              <th className="whitespace-nowrap hidden sm:table-cell">تاريخ التسليم</th>
              <th className="whitespace-nowrap hidden xl:table-cell">ملحوظات</th>
              <th className="whitespace-nowrap">موقف التنفيذ</th>
              <th className="whitespace-nowrap no-print">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((purchase, index) => (
              <tr 
                key={purchase.id} 
                className={`border-b hover:bg-gray-50 transition-colors ${getAlertClass(purchase)}`}
              >
                <td className="text-center text-gray-500 text-xs md:text-sm">{index + 1}</td>
                <td className="font-bold text-purple-700 text-sm md:text-lg">{purchase.request_number}</td>
                <td className="text-xs md:text-sm">{new Date(purchase.date).toLocaleDateString('ar-SA')}</td>
                <td className="font-medium text-xs md:text-sm hidden sm:table-cell">{purchase.requester}</td>
                <td className="max-w-xs truncate text-xs md:text-sm hidden md:table-cell" title={purchase.description}>
                  {purchase.description}
                </td>
                <td className="text-xs md:text-sm hidden lg:table-cell">{purchase.receiver}</td>
                <td className="text-xs md:text-sm hidden sm:table-cell">
                  {new Date(purchase.delivery_date).toLocaleDateString('ar-SA')}
                  {isOverdue(purchase) && <span className="text-red-500 mr-1">⚠️</span>}
                </td>
                <td className="max-w-xs truncate text-gray-600 text-xs md:text-sm hidden xl:table-cell" title={purchase.notes || 'لا توجد ملحوظات'}>
                  {purchase.notes || '—'}
                </td>
                <td>
                  {isOverdue(purchase) && (
                    <span className="text-red-500 text-xs ml-1" title="متأخر">
                      <i className="fas fa-exclamation-triangle"></i>
                    </span>
                  )}
                  {/* ✅ قائمة منسدلة لتغيير الحالة */}
                  {renderStatus(purchase)}
                </td>
                <td className="no-print">
                  <div className="flex justify-center gap-1 md:gap-2">
                    <button
                      onClick={() => onEdit(purchase)}
                      className="text-purple-600 hover:text-purple-800 font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2 rounded-xl border-2 border-purple-200 hover:bg-purple-50 transition-all duration-300 flex items-center gap-1 md:gap-1.5"
                    >
                      <i className="fas fa-edit text-xs md:text-sm"></i>
                      <span className="hidden sm:inline">تعديل</span>
                    </button>
                    <button
                      onClick={() => onDelete(purchase.id!)}
                      className="text-red-600 hover:text-red-800 font-semibold text-xs md:text-sm px-2 py-1 md:px-4 md:py-2 rounded-xl border-2 border-red-200 hover:bg-red-50 transition-all duration-300 flex items-center gap-1 md:gap-1.5"
                    >
                      <i className="fas fa-trash-alt text-xs md:text-sm"></i>
                      <span className="hidden sm:inline">حذف</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PurchaseTable;