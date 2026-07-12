// src/components/ProtectedRoute.tsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMemo } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'user' | 'viewer';
  requiredRoles?: ('admin' | 'user' | 'viewer')[];
  redirectTo?: string;
  fallback?: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ 
  children, 
  requiredRole, 
  requiredRoles,
  redirectTo = '/login',
  fallback
}) => {
  const { isAuthenticated, user, loading } = useAuth();

  // ============================================
  // ✅ التحقق من الصلاحيات
  // ============================================

  const hasRequiredRole = (userRole: string): boolean => {
    // Admin has all permissions
    if (userRole === 'admin') return true;
    
    // Check single role
    if (requiredRole && userRole === requiredRole) return true;
    
    // Check multiple roles
    if (requiredRoles && requiredRoles.includes(userRole as any)) return true;
    
    return false;
  };

  // ============================================
  // ✅ تحسين الأداء
  // ============================================

  const hasAccess = useMemo(() => {
    if (!isAuthenticated) return false;
    if (!requiredRole && !requiredRoles) return true;
    if (!user) return false;
    
    return hasRequiredRole(user.role);
  }, [isAuthenticated, user, requiredRole, requiredRoles]);

  // ============================================
  // ✅ عرض حالة التحميل
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // ✅ إعادة التوجيه إذا لم يكن مصادقاً
  // ============================================

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  // ============================================
  // ✅ عرض رسالة إذا لم يكن لديه صلاحية
  // ============================================

  if (!hasAccess) {
    // ✅ استخدام fallback مخصص إذا تم توفيره
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 max-w-md">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-lock text-red-600 text-3xl"></i>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">غير مصرح</h2>
          <p className="text-gray-600 mb-6">
            ليس لديك صلاحية للوصول إلى هذه الصفحة
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.history.back()}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              العودة
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              الذهاب للرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // ✅ عرض المحتوى
  // ============================================

  return <>{children}</>;
};

export default ProtectedRoute;