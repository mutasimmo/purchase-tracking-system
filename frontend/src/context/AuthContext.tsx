import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { authApi } from '../api/authApi.ts';
import toast from 'react-hot-toast';

interface User {
  id: number;
  username: string;
  full_name: string;
  email?: string;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (data: any) => Promise<boolean>;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // التحقق من المستخدم عند تحميل التطبيق
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await authApi.getCurrentUser();
        if (response.user) {
          setUser(response.user);
        }
      } catch (error) {
        console.log('Not authenticated');
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      setLoading(true);
      const response = await authApi.login(username, password);
      if (response.success && response.user) {
        setUser(response.user);
        toast.success(`مرحباً ${response.user.full_name}!`);
        return true;
      }
      return false;
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'فشل تسجيل الدخول');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
      setUser(null);
      toast.success('تم تسجيل الخروج بنجاح');
    } catch (error) {
      toast.error('حدث خطأ في تسجيل الخروج');
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

  const value = {
    user,
    loading,
    login,
    logout,
    register,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};