import axios from 'axios';

const API_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    console.log(`📤 Auth ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('Auth request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    console.log(`📥 Auth ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('Auth response error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const authApi = {
  // ============================================
  // المصادقة الأساسية
  // ============================================
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  },

  logout: async () => {
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

  // ============================================
  // 🆕 إدارة المستخدمين (للأدمن فقط)
  // ============================================
  getAllUsers: async () => {
    const response = await api.get('/auth/users');
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
  }
};

export default authApi;