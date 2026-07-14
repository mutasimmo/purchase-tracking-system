// src/App.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { purchaseApi } from './api/purchaseApi';
import type { Purchase, PurchaseFilters, PurchaseStatus } from './types/purchase.types';
import { AuthProvider, useAuth } from './context/AuthContext';
import PurchaseTable from './components/PurchaseTable';
import PurchaseForm from './components/PurchaseForm';
import Dashboard from './components/Dashboard';
import Home from './components/Home';
import Filters from './components/Filters';
import Pagination from './components/Pagination';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import Alerts from './components/Alerts';
import AlertBell from './components/AlertBell';
import UserManagement from './components/UserManagement';
import Chat from './components/Chat';
import * as XLSX from 'xlsx';
import toast, { Toaster } from 'react-hot-toast';
import './App.css';

// ============================================
// ✅ مكون التطبيق الرئيسي
// ============================================

const AppContent = () => {
  const { user, logout, isAdmin } = useAuth();
  const isUserAdmin = user?.role === 'admin';
  
  // ============================================
  // ✅ State
  // ============================================

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showHome, setShowHome] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [nextRequestNumber, setNextRequestNumber] = useState<string>('');
  const [filters, setFilters] = useState<PurchaseFilters>({ page: 1, limit: 10 });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ============================================
  // ✅ دوال مساعدة
  // ============================================

  const generateNextRequestNumber = useCallback((existingPurchases: Purchase[]) => {
    if (existingPurchases.length === 0) return '001';
    const numbers = existingPurchases
      .map(p => parseInt(p.request_number))
      .filter(n => !isNaN(n));
    if (numbers.length === 0) return '001';
    const maxNumber = Math.max(...numbers);
    return String(maxNumber + 1).padStart(3, '0');
  }, []);

  // ============================================
  // ✅ جلب الطلبات
  // ============================================

  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filterParams: PurchaseFilters = {
        page: filters.page || 1,
        limit: filters.limit || 10
      };
      
      if (filters.status) filterParams.status = filters.status;
      if (filters.startDate) filterParams.startDate = filters.startDate;
      if (filters.endDate) filterParams.endDate = filters.endDate;
      if (filters.search) filterParams.search = filters.search;
      
      const response = await purchaseApi.getAll(filterParams);
      setPurchases(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
      setCurrentPage(response.page);
      
      const nextNum = generateNextRequestNumber(response.data);
      setNextRequestNumber(nextNum);
    } catch (err: any) {
      if (err.response?.status === 401) {
        toast.error('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً');
      } else {
        setError('حدث خطأ في تحميل البيانات');
        toast.error('❌ حدث خطأ في تحميل البيانات');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, generateNextRequestNumber]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  // ============================================
  // ✅ تحديث البيانات بدون إعادة تحميل الصفحة
  // ============================================

  const refreshPurchases = useCallback(async () => {
    try {
      const filterParams: PurchaseFilters = {
        page: filters.page || 1,
        limit: filters.limit || 10
      };
      
      if (filters.status) filterParams.status = filters.status;
      if (filters.startDate) filterParams.startDate = filters.startDate;
      if (filters.endDate) filterParams.endDate = filters.endDate;
      if (filters.search) filterParams.search = filters.search;
      
      const response = await purchaseApi.getAll(filterParams);
      setPurchases(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
      setCurrentPage(response.page);
    } catch (error) {
      console.error('Error refreshing purchases:', error);
    }
  }, [filters]);

  // ============================================
  // ✅ تحديث حالة الطلب (بدون إعادة تحميل)
  // ============================================

  const handleStatusUpdate = useCallback(async (id: number, newStatus: string) => {
    try {
      await purchaseApi.updateStatus(id, newStatus);
      
      // ✅ تحويل newStatus إلى PurchaseStatus
      setPurchases(prev => prev.map(p => 
        p.id === id ? { ...p, status: newStatus as PurchaseStatus } : p
      ));
      
      toast.success(`✅ تم تغيير الحالة إلى "${newStatus}"`);
    } catch (error) {
      toast.error('❌ حدث خطأ في تحديث الحالة');
      console.error(error);
    }
  }, []);

  // ============================================
  // ✅ تحديث رقم الطلب التالي
  // ============================================

  const updateNextRequestNumber = useCallback(async () => {
    try {
      const filterParams: PurchaseFilters = {
        page: filters.page || 1,
        limit: filters.limit || 10
      };
      if (filters.status) filterParams.status = filters.status;
      if (filters.startDate) filterParams.startDate = filters.startDate;
      if (filters.endDate) filterParams.endDate = filters.endDate;
      if (filters.search) filterParams.search = filters.search;
      
      const response = await purchaseApi.getAll(filterParams);
      const nextNum = generateNextRequestNumber(response.data);
      setNextRequestNumber(nextNum);
    } catch (error) {
      console.error('Error updating next request number:', error);
    }
  }, [filters, generateNextRequestNumber]);

  // ============================================
  // ✅ دوال CRUD
  // ============================================

  const handleAdd = useCallback(() => {
    if (!isUserAdmin) {
      toast.error('❌ ليس لديك صلاحية لإضافة طلبات');
      return;
    }
    setEditingPurchase(null);
    setShowForm(true);
  }, [isUserAdmin]);

  const handleEdit = useCallback((purchase: Purchase) => {
    if (!isUserAdmin) {
      toast.error('❌ ليس لديك صلاحية لتعديل الطلبات');
      return;
    }
    setEditingPurchase(purchase);
    setShowForm(true);
  }, [isUserAdmin]);

  const handleDeleteClick = useCallback((id: number) => {
    if (!isUserAdmin) {
      toast.error('❌ ليس لديك صلاحية لحذف الطلبات');
      return;
    }
    setDeleteId(id);
    setShowDeleteModal(true);
  }, [isUserAdmin]);

  const confirmDelete = useCallback(async () => {
    if (!deleteId) return;
    
    try {
      setDeleting(true);
      await purchaseApi.delete(deleteId);
      toast.success('🗑️ تم حذف الطلب بنجاح');
      setShowDeleteModal(false);
      setDeleteId(null);
      await refreshPurchases();
      await updateNextRequestNumber(); // ✅ تحديث الرقم بعد الحذف
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || '❌ حدث خطأ في حذف الطلب';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  }, [deleteId, refreshPurchases, updateNextRequestNumber]);

  const handleSubmit = useCallback(async (data: any) => {
    try {
      setFormLoading(true);
      if (editingPurchase?.id) {
        await purchaseApi.update(editingPurchase.id, data);
        toast.success('✅ تم تحديث الطلب بنجاح');
      } else {
        await purchaseApi.create(data);
        toast.success('✅ تم إضافة الطلب بنجاح');
        
        // ✅ تحديث رقم الطلب التالي بعد الإضافة
        await updateNextRequestNumber();
      }
      setShowForm(false);
      setEditingPurchase(null);
      await refreshPurchases();
    } catch (err) {
      toast.error('❌ حدث خطأ في حفظ الطلب');
      console.error(err);
    } finally {
      setFormLoading(false);
    }
  }, [editingPurchase, refreshPurchases, updateNextRequestNumber]);

  // ============================================
  // ✅ دوال البحث والفلترة
  // ============================================

  const handleSearch = useCallback((search: string) => {
    setFilters(prev => ({ ...prev, search: search || undefined, page: 1 }));
  }, []);

  const handleFilterChange = useCallback((newFilters: PurchaseFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: 1 }));
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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
        'ملحوظات': p.notes || '',
        'موقف التنفيذ': p.status
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'طلبات المشتريات');
      
      ws['!cols'] = [
        { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 30 },
        { wch: 20 }, { wch: 15 }, { wch: 25 }, { wch: 15 }
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
  // ✅ قيم محسوبة للعرض
  // ============================================

  const isHomeVisible = showHome;
  const isDashboardVisible = showDashboard;

  // ============================================
  // ✅ Render
  // ============================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-200 p-2 sm:p-4 md:p-8">
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            fontFamily: 'Cairo, sans-serif',
            direction: 'rtl',
            padding: '16px 24px',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          },
          success: {
            duration: 3000,
            iconTheme: { primary: '#22c55e', secondary: '#fff' },
            style: { background: '#065f46', color: '#fff' },
          },
          error: {
            duration: 4000,
            iconTheme: { primary: '#ef4444', secondary: '#fff' },
            style: { background: '#7f1d1d', color: '#fff' },
          },
        }}
      />
      
      <div className="container mx-auto max-w-7xl">
        {/* HEADER */}
        <header className="bg-white/80 backdrop-blur-lg rounded-2xl md:rounded-3xl shadow-2xl p-3 sm:p-4 md:p-6 lg:p-8 mb-4 sm:mb-6 md:mb-8 border border-white/50 fade-in-up">
          <div className="flex flex-col lg:flex-row justify-between items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 w-full lg:w-auto">
              <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
                <i className="fas fa-clipboard-list text-white text-base sm:text-lg md:text-2xl"></i>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="page-title text-base sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-black truncate">
                  نظام متابعة المشتريات
                </h1>
                <div className="flex flex-wrap items-center gap-1 sm:gap-2 md:gap-3 mt-0.5 sm:mt-1">
                  <p className="text-[10px] sm:text-xs md:text-sm text-gray-500 font-medium flex items-center gap-0.5 sm:gap-1 md:gap-2">
                    <i className="fas fa-chart-line text-purple-500 text-[10px] sm:text-xs"></i>
                    <span className="hidden xs:inline">إجمالي الطلبات:</span>
                    <span className="font-bold text-purple-700 text-xs sm:text-sm md:text-lg">{total}</span>
                  </p>
                  <span className="text-[8px] sm:text-[10px] md:text-xs text-green-600 bg-green-50 px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                    <i className="fas fa-plus-circle text-[8px] sm:text-[10px]"></i> {nextRequestNumber}
                  </span>
                  <span className="text-[8px] sm:text-[10px] md:text-xs bg-purple-100 text-purple-700 px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap hidden sm:inline">
                    <i className="fas fa-user text-[8px] sm:text-[10px]"></i> {user?.full_name}
                  </span>
                  {isUserAdmin && (
                    <span className="text-[8px] sm:text-[10px] md:text-xs bg-red-100 text-red-700 px-1.5 sm:px-2 md:px-3 py-0.5 sm:py-1 rounded-full whitespace-nowrap">
                      <i className="fas fa-crown text-[8px] sm:text-[10px]"></i> مدير
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-1 sm:gap-1.5 md:gap-2 w-full lg:w-auto">
              <AlertBell onClick={() => setShowAlerts(!showAlerts)} />
              
              <button
                onClick={() => setShowChat(!showChat)}
                className="px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 bg-blue-500 text-white rounded-lg md:rounded-xl hover:bg-blue-600 transition-colors flex items-center gap-1 md:gap-2 no-print text-[10px] sm:text-xs md:text-sm whitespace-nowrap"
              >
                <i className="fas fa-comment-dots text-[10px] sm:text-xs"></i>
                <span className="hidden sm:inline">دردشة</span>
                <span className="sm:hidden">💬</span>
              </button>
              
              {isUserAdmin && (
                <button
                  onClick={() => setShowUserManagement(!showUserManagement)}
                  className="px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 bg-indigo-500 text-white rounded-lg md:rounded-xl hover:bg-indigo-600 transition-colors flex items-center gap-1 md:gap-2 no-print text-[10px] sm:text-xs md:text-sm whitespace-nowrap"
                >
                  <i className="fas fa-users-cog text-[10px] sm:text-xs"></i>
                  <span className="hidden sm:inline">إدارة المستخدمين</span>
                  <span className="sm:hidden">👥</span>
                </button>
              )}
              
              <button
                onClick={logout}
                className="px-2 sm:px-3 md:px-4 py-1 sm:py-1.5 md:py-2 bg-red-500 text-white rounded-lg md:rounded-xl hover:bg-red-600 transition-colors flex items-center gap-1 md:gap-2 no-print text-[10px] sm:text-xs md:text-sm whitespace-nowrap"
              >
                <i className="fas fa-sign-out-alt text-[10px] sm:text-xs"></i>
                <span className="hidden sm:inline">خروج</span>
                <span className="sm:hidden">🚪</span>
              </button>
            </div>
          </div>
        </header>

        {/* المحتوى الرئيسي */}
        {isHomeVisible ? (
          <div className="fade-in-up">
            <Home 
              onOpenDashboard={() => {
                setShowHome(false);
                setShowDashboard(true);
              }}
              onOpenAddForm={handleAdd}
              onOpenAlerts={() => setShowAlerts(true)}
              onExportExcel={exportToExcel}
            />
          </div>
        ) : (
          <>
            {isDashboardVisible && (
              <div className="mb-4 sm:mb-6 md:mb-8 fade-in-up">
                <Dashboard onClose={() => {
                  setShowDashboard(false);
                  setShowHome(true);
                }} />
              </div>
            )}

            <Filters 
              onFilterChange={handleFilterChange}
              onSearch={handleSearch}
              loading={loading}
            />

            {error && (
              <div className="bg-red-50 border-r-4 border-red-500 text-red-700 px-3 sm:px-4 md:px-6 py-3 sm:py-4 rounded-xl md:rounded-2xl mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3 fade-in-up text-sm sm:text-base">
                <i className="fas fa-exclamation-circle text-red-500 text-base sm:text-xl"></i>
                <span className="font-medium">{error}</span>
              </div>
            )}

            <div className="fade-in-up">
              <PurchaseTable
                purchases={purchases}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onStatusChange={handleStatusUpdate}
                loading={loading}
              />
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              loading={loading}
            />
          </>
        )}

        {/* MODALS */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 fade-in-up">
            <div className="bg-white rounded-2xl md:rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <PurchaseForm
                purchase={editingPurchase}
                onSubmit={handleSubmit}
                onCancel={() => {
                  setShowForm(false);
                  setEditingPurchase(null);
                }}
                loading={formLoading}
                nextRequestNumber={!editingPurchase ? nextRequestNumber : undefined}
              />
            </div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 fade-in-up">
            <div className="bg-white rounded-2xl md:rounded-3xl max-w-md w-full p-4 sm:p-6 md:p-8 shadow-2xl">
              <div className="text-center">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <i className="fas fa-exclamation-triangle text-red-600 text-2xl sm:text-3xl"></i>
                </div>
                <h3 className="text-lg sm:text-2xl font-bold text-gray-800 mb-2">تأكيد الحذف</h3>
                <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
                  هل أنت متأكد من حذف هذا الطلب؟<br />
                  <span className="text-xs sm:text-sm text-red-500">لا يمكن التراجع عن هذا الإجراء</span>
                </p>
                <div className="flex gap-2 sm:gap-3 justify-center">
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setDeleteId(null);
                    }}
                    className="px-4 sm:px-6 py-1.5 sm:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm sm:text-base"
                    disabled={deleting}
                  >
                    إلغاء
                  </button>
                  <button
                    onClick={confirmDelete}
                    className="px-4 sm:px-6 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base"
                    disabled={deleting}
                  >
                    {deleting ? (
                      <>
                        <i className="fas fa-spinner fa-spin"></i>
                        جاري الحذف...
                      </>
                    ) : (
                      <>
                        <i className="fas fa-trash-alt"></i>
                        حذف
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showAlerts && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 fade-in-up">
            <div className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <Alerts onClose={() => setShowAlerts(false)} />
            </div>
          </div>
        )}

        {showUserManagement && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 fade-in-up">
            <div className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
              <UserManagement onClose={() => setShowUserManagement(false)} />
            </div>
          </div>
        )}

        {showChat && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 fade-in-up">
            <Chat onClose={() => setShowChat(false)} />
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// ✅ صفحة تسجيل الدخول
// ============================================

const LoginPage = () => {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 p-3 sm:p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <i className="fas fa-clipboard-list text-white text-2xl sm:text-3xl"></i>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-800 mt-3 sm:mt-4">نظام متابعة المشتريات</h1>
          <p className="text-sm sm:text-base text-gray-500">قم بتسجيل الدخول للوصول إلى النظام</p>
        </div>
        <Login />
      </div>
    </div>
  );
};

// ============================================
// ✅ صفحة التسجيل
// ============================================

const RegisterPage = () => {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-teal-100 p-3 sm:p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <i className="fas fa-user-plus text-white text-2xl sm:text-3xl"></i>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-800 mt-3 sm:mt-4">إنشاء حساب جديد</h1>
          <p className="text-sm sm:text-base text-gray-500">سجل بياناتك للانضمام إلى النظام</p>
        </div>
        <Register />
      </div>
    </div>
  );
};

// ============================================
// ✅ التطبيق الرئيسي
// ============================================

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppContent />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;