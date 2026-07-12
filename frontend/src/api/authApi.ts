// src/api/api.ts
import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
  withCredentials: true
});

// ============================================
// ✅ Interceptor للطلبات
// ============================================

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// ============================================
// ✅ Interceptor للاستجابات (مع تجديد التوكن)
// ============================================

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => {
    // ✅ حفظ التوكنات من الاستجابة
    if (response.data?.token) {
      localStorage.setItem('token', response.data.token);
    }
    if (response.data?.refreshToken) {
      localStorage.setItem('refreshToken', response.data.refreshToken);
    }
    if (response.data?.user) {
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    console.log(`📥 ${response.status} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // ✅ معالجة 401 - تجديد التوكن
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        const response = await api.post('/auth/refresh-token', { refreshToken });
        const { token, refreshToken: newRefreshToken } = response.data;

        localStorage.setItem('token', token);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }

        processQueue(null, token);
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // ✅ معالجة الأخطاء الأخرى
    let errorMessage = 'حدث خطأ غير متوقع';
    
    if (error.response) {
      const serverError = error.response.data;
      errorMessage = serverError?.error || serverError?.message || errorMessage;
      
      if (error.response.status === 403) {
        errorMessage = 'غير مصرح لك بالوصول إلى هذه الصفحة';
      } else if (error.response.status === 404) {
        errorMessage = 'المورد غير موجود';
      } else if (error.response.status === 429) {
        errorMessage = 'لقد تجاوزت عدد المحاولات المسموح بها، يرجى المحاولة بعد 15 دقيقة';
      }
    } else if (error.request) {
      errorMessage = 'لا يمكن الاتصال بالسيرفر، يرجى التحقق من الاتصال';
    }
    
    console.error('❌ API Error:', errorMessage);
    const customError = new Error(errorMessage);
    (customError as any).originalError = error;
    return Promise.reject(customError);
  }
);

// ============================================
// ✅ دوال API
// ============================================

export const authApi = {
  // المصادقة الأساسية
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  logout: async () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    const response = await api.post('/auth/logout');
    return response.data;
  },

  register: async (data: any) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await api.put('/auth/password', { currentPassword, newPassword });
    return response.data;
  },

  updateProfile: async (data: any) => {
    const response = await api.put('/auth/profile', data);
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await api.post('/auth/refresh-token', { refreshToken });
    return response.data;
  },

  // إدارة المستخدمين (للأدمن فقط)
  getAllUsers: async () => {
    const response = await api.get('/auth/users');
    return response.data;
  },

  getUsers: async (page: number = 1, limit: number = 20, filters?: any) => {
    const response = await api.get('/auth/users', { 
      params: { page, limit, ...filters } 
    });
    return response.data;
  },

  getUserById: async (id: number) => {
    const response = await api.get(`/auth/users/${id}`);
    return response.data;
  },

  createUser: async (data: any) => {
    const response = await api.post('/auth/users', data);
    return response.data;
  },

  updateUser: async (id: number, data: any) => {
    const response = await api.put(`/auth/users/${id}`, data);
    return response.data;
  },

  deleteUser: async (id: number) => {
    const response = await api.delete(`/auth/users/${id}`);
    return response.data;
  },

  toggleUserStatus: async (id: number, isActive: boolean) => {
    const response = await api.patch(`/auth/users/${id}/status`, { is_active: isActive });
    return response.data;
  },

  changeUserRole: async (id: number, role: string) => {
    const response = await api.patch(`/auth/users/${id}/role`, { role });
    return response.data;
  }
};

export default authApi;