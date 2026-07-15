// src/context/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { authApi } from '../api/authApi';
import toast from 'react-hot-toast';

// ============================================
// ✅ أنواع البيانات
// ============================================

interface User {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
  created_at?: string;
  last_login?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (data: any) => Promise<boolean>;
  updateUser: (data: Partial<User>) => void;
  updatePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  hasPermission: (requiredRole: 'admin' | 'user' | 'viewer') => boolean;
  hasSpecificPermission: (permission: string) => boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

// ============================================
// ✅ Context
// ============================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ============================================
// ✅ Provider
// ============================================

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // ============================================
  // ✅ التحقق من المصادقة عند بدء التشغيل
  // ============================================

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setLoading(false);
          return;
        }

        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }

        const response = await authApi.getCurrentUser();
        if (response.user) {
          setUser(response.user);
          localStorage.setItem('user', JSON.stringify(response.user));
        } else {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          setUser(null);
        }
      } catch (error) {
        console.log('Not authenticated');
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // ============================================
  // ✅ دوال المصادقة
  // ============================================

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await authApi.login(username, password);
      
      console.log('📥 Login response:', response);
      
      if (response.token && response.user) {
        setUser(response.user);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('token', response.token);
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        
        console.log('✅ Token saved:', localStorage.getItem('token'));
        toast.success(`مرحباً ${response.user.full_name}!`);
        return true;
      }
      
      if (response.data?.token && response.data?.user) {
        setUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        localStorage.setItem('token', response.data.token);
        if (response.data.refreshToken) {
          localStorage.setItem('refreshToken', response.data.refreshToken);
        }
        console.log('✅ Token saved from response.data:', localStorage.getItem('token'));
        toast.success(`مرحباً ${response.data.user.full_name}!`);
        return true;
      }
      
      if (response.success && response.token && response.user) {
        setUser(response.user);
        localStorage.setItem('user', JSON.stringify(response.user));
        localStorage.setItem('token', response.token);
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
        console.log('✅ Token saved from success response:', localStorage.getItem('token'));
        toast.success(`مرحباً ${response.user.full_name}!`);
        return true;
      }
      
      console.error('❌ No token in response:', response);
      toast.error('فشل تسجيل الدخول: لم يتم استلام التوكن');
      return false;
    } catch (error: any) {
      console.error('❌ Login error:', error);
      const message = error.response?.data?.error || error.message || 'فشل تسجيل الدخول';
      toast.error(message);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ✅ دالة تسجيل الخروج المعدلة
  const logout = async () => {
    try {
      // محاولة إعلام الـ Backend بتسجيل الخروج
      await authApi.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // مسح جميع البيانات
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      // مسح cookies
      document.cookie.split(';').forEach(cookie => {
        document.cookie = cookie
          .replace(/^ +/, '')
          .replace(/=.*/, `=; expires=${new Date(0).toUTCString()}; path=/`);
      });
      
      toast.success('تم تسجيل الخروج بنجاح');
      
      // ✅ إعادة التوجيه إلى صفحة تسجيل الدخول
      window.location.href = '/login';
    }
  };

  const register = async (data: any): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await authApi.register(data);
      if (response.success) {
        toast.success('تم إنشاء الحساب بنجاح! يرجى تسجيل الدخول');
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'فشل إنشاء الحساب');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ✅ دوال إدارة المستخدم
  // ============================================

  const updateUser = (updatedData: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updatedData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const updatePassword = async (currentPassword: string, newPassword: string): Promise<boolean> => {
    try {
      setLoading(true);
      await authApi.changePassword(currentPassword, newPassword);
      toast.success('تم تغيير كلمة المرور بنجاح');
      return true;
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'فشل تغيير كلمة المرور');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ✅ دوال التحقق من الصلاحيات
  // ============================================

  const hasPermission = (requiredRole: 'admin' | 'user' | 'viewer'): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    const roleHierarchy = { admin: 2, user: 1, viewer: 0 };
    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  };

  const hasSpecificPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const permissions: Record<string, string[]> = {
      admin: ['manage_users', 'manage_purchases', 'view_reports', 'export_data'],
      user: ['create_purchase', 'view_own_purchases'],
      viewer: ['view_own_purchases']
    };

    return permissions[user.role]?.includes(permission) || false;
  };

  // ============================================
  // ✅ القيم المصدرة
  // ============================================

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    register,
    updateUser,
    updatePassword,
    hasPermission,
    hasSpecificPermission,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;