export interface Purchase {
  id?: number;
  request_number: string;
  date: string;
  requester: string;
  description: string;
  receiver: string;
  delivery_date: string;
  status: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export type PurchaseStatus = 'قيد التنفيذ' | 'منجز' | 'معلق' | 'ملغي';

export interface PurchaseFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PurchaseResponse {
  data: Purchase[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DashboardStats {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  inProgress: number;
  delayed: number;
  byStatus: {
    status: string;
    count: number;
  }[];
  byRequester: {
    requester: string;
    count: number;
  }[];
  monthlyTrend: {
    month: string;
    count: number;
  }[];
}

// ألوان الحالات للعرض
export const statusColors: Record<PurchaseStatus, string> = {
  'قيد التنفيذ': 'bg-yellow-100 text-yellow-800',
  'منجز': 'bg-green-100 text-green-800',
  'معلق': 'bg-red-100 text-red-800',
  'ملغي': 'bg-gray-100 text-gray-800'
};

// خيارات الحالات
export const statusOptions: PurchaseStatus[] = ['قيد التنفيذ', 'منجز', 'معلق', 'ملغي'];

// ألوان الحالات للـ Dashboard
export const statusColorsDark: Record<PurchaseStatus, string> = {
  'قيد التنفيذ': 'from-yellow-500 to-yellow-600',
  'منجز': 'from-green-500 to-green-600',
  'معلق': 'from-red-500 to-red-600',
  'ملغي': 'from-gray-500 to-gray-600'
};

// أيقونات الحالات
export const statusIcons: Record<PurchaseStatus, string> = {
  'قيد التنفيذ': 'fa-spinner fa-pulse',
  'منجز': 'fa-check-circle',
  'معلق': 'fa-clock',
  'ملغي': 'fa-times-circle'
};

// تسميات الحالات باللغة العربية
export const statusLabels: Record<PurchaseStatus, string> = {
  'قيد التنفيذ': 'قيد التنفيذ',
  'منجز': 'منجز',
  'معلق': 'معلق',
  'ملغي': 'ملغي'
};