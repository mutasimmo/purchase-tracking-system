// frontend/src/api/purchaseApi.ts
import axios, { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import type { Purchase, PurchaseFilters, PurchaseResponse, DashboardStats } from '../types/purchase.types';

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
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.log(`📤 ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error: any): Promise<any> => {
    console.error('❌ Request error:', error);
    return Promise.reject(error);
  }
);

// ============================================
// ✅ Interceptor للاستجابات
// ============================================

api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    console.log(`📥 ${response.status} ${response.config.url}`);
    return response;
  },
  (error: any): Promise<any> => {
    let errorMessage = 'حدث خطأ غير متوقع';
    
    if (error.response) {
      const serverError = error.response.data;
      errorMessage = serverError?.error || serverError?.message || errorMessage;
      
      if (error.response.status === 401) {
        errorMessage = 'غير مصرح لك بالوصول، يرجى تسجيل الدخول مرة أخرى';
      } else if (error.response.status === 403) {
        errorMessage = 'غير مصرح لك بالوصول إلى هذه الموارد';
      } else if (error.response.status === 404) {
        errorMessage = 'الطلب غير موجود';
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
    // ✅ تأكد من وجود invoice_owner
    if (response.data && !response.data.invoice_owner) {
      return {
        ...response.data,
        invoice_owner: ''
      };
    }
    return response.data;
  },
  
  create: async (purchase: Omit<Purchase, 'id' | 'created_at' | 'updated_at'>): Promise<Purchase> => {
    // ✅ تأكد من إرسال invoice_owner
    const data = {
      ...purchase,
      invoice_owner: purchase.invoice_owner || '',
      notes: purchase.notes || ''
    };
    const response = await api.post<Purchase>('/purchases', data);
    return response.data;
  },
  
  update: async (id: number, purchase: Partial<Purchase>): Promise<Purchase> => {
    // ✅ تأكد من إرسال invoice_owner
    const data = {
      ...purchase,
      invoice_owner: purchase.invoice_owner || '',
      notes: purchase.notes || ''
    };
    const response = await api.put<Purchase>(`/purchases/${id}`, data);
    return response.data;
  },
  
  delete: async (id: number): Promise<{ success: boolean; message: string }> => {
    console.log('🗑️ API Delete called for ID:', id);
    try {
      const response = await api.delete(`/purchases/${id}`);
      console.log('✅ Delete response status:', response.status);
      return { 
        success: true, 
        message: 'تم حذف الطلب بنجاح' 
      };
    } catch (error) {
      console.error('❌ Delete error:', error);
      throw error;
    }
  },
  
  // ============================================
  // الإحصائيات والتقارير
  // ============================================
  
  getDashboardStats: async (): Promise<DashboardStats> => {
    const response = await api.get<DashboardStats>('/purchases/dashboard');
    return response.data;
  },
  
  search: async (query: any): Promise<PurchaseResponse> => {
    const response = await api.get<PurchaseResponse>('/purchases/search', { params: query });
    return response.data;
  },
  
  updateStatus: async (id: number, status: string): Promise<Purchase> => {
    const response = await api.patch<Purchase>(`/purchases/${id}/status`, { status });
    return response.data;
  },
  
  // ============================================
  // التصدير
  // ============================================
  
  export: async (filters?: any): Promise<Blob> => {
    const response = await api.get('/purchases/export', { 
      params: filters,
      responseType: 'blob'
    });
    return response.data;
  },
  
  // ============================================
  // التنبيهات
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
  // سجل التتبع (Admin فقط)
  // ============================================
  
  getAuditLogs: async (filters?: any): Promise<any> => {
    const response = await api.get('/purchases/audit-logs', { params: filters });
    return response.data;
  },

  getAuditLogsByPurchase: async (purchaseId: number): Promise<any> => {
    const response = await api.get(`/purchases/audit-logs/purchase/${purchaseId}`);
    return response.data;
  },

  // ============================================
  // استرجاع الطلبات المحذوفة (Admin فقط)
  // ============================================
  
  restore: async (id: number): Promise<Purchase> => {
    const response = await api.patch<Purchase>(`/purchases/${id}/restore`);
    return response.data;
  },

  getDeleted: async (): Promise<Purchase[]> => {
    const response = await api.get<Purchase[]>('/purchases/trash');
    return response.data;
  },

  // ============================================
  // عمليات مجمعة (Admin فقط)
  // ============================================
  
  batchDelete: async (ids: number[]): Promise<any> => {
    const response = await api.delete('/purchases/batch', { data: { ids } });
    return response.data;
  },

  batchUpdateStatus: async (ids: number[], status: string): Promise<any> => {
    const response = await api.patch('/purchases/batch/status', { ids, status });
    return response.data;
  }
};

export default purchaseApi;