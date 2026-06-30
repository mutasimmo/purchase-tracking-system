import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Purchase, PurchaseFilters, PurchaseResponse, DashboardStats } from '../types/purchase.types';

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
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error: any): Promise<any> => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    console.log(`📥 ${response.status} ${response.config.url}`);
    return response;
  },
  (error: any): Promise<any> => {
    console.error('Response error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export const purchaseApi = {
  // ============================================
  // العمليات الأساسية
  // ============================================
  getAll: async (filters?: PurchaseFilters): Promise<PurchaseResponse> => {
    const response = await api.get<PurchaseResponse>('/purchases', { params: filters });
    return response.data;
  },
  
  getById: async (id: number): Promise<Purchase> => {
    const response = await api.get<Purchase>(`/purchases/${id}`);
    return response.data;
  },
  
  create: async (purchase: Omit<Purchase, 'id' | 'created_at' | 'updated_at'>): Promise<Purchase> => {
    const response = await api.post<Purchase>('/purchases', purchase);
    return response.data;
  },
  
  update: async (id: number, purchase: Partial<Purchase>): Promise<Purchase> => {
    const response = await api.put<Purchase>(`/purchases/${id}`, purchase);
    return response.data;
  },
  
  delete: async (id: number): Promise<void> => {
    await api.delete(`/purchases/${id}`);
  },
  
  // ============================================
  // الإحصائيات والتقارير
  // ============================================
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await api.get<DashboardStats>('/purchases/dashboard');
    return response.data;
  },
  
  search: async (query: any): Promise<Purchase[]> => {
    const response = await api.get<Purchase[]>('/purchases/search', { params: query });
    return response.data;
  },
  
  updateStatus: async (id: number, status: string): Promise<Purchase> => {
    const response = await api.patch<Purchase>(`/purchases/${id}/status`, { status });
    return response.data;
  },
  
  // ============================================
  // 🔔 دوال التنبيهات
  // ============================================
  getOverdue: async (): Promise<Purchase[]> => {
    const response = await api.get<Purchase[]>('/purchases/alerts/overdue');
    return response.data;
  },

  getExpiringToday: async (): Promise<Purchase[]> => {
    const response = await api.get<Purchase[]>('/purchases/alerts/expiring-today');
    return response.data;
  },

  getAlertStats: async (): Promise<any> => {
    const response = await api.get('/purchases/alerts/stats');
    return response.data;
  },

  // ============================================
  // 📝 دوال سجل التتبع (Admin فقط)
  // ============================================
  getAuditLogs: async (filters?: any): Promise<any> => {
    const response = await api.get('/purchases/audit-logs', { params: filters });
    return response.data;
  },

  getAuditLogsByPurchase: async (purchaseId: number): Promise<any> => {
    const response = await api.get(`/purchases/audit-logs/purchase/${purchaseId}`);
    return response.data;
  },
};

export default purchaseApi;