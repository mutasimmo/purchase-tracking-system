// src/types/purchase.types.ts

// ============================================
// ✅ الأنواع الأساسية
// ============================================

export type PurchaseStatus = 'قيد التنفيذ' | 'منجز' | 'معلق' | 'ملغي';

export interface Purchase {
  id?: number;
  request_number: string;
  date: string;
  requester: string;
  description: string;
  receiver: string;
  delivery_date: string;
  status: PurchaseStatus;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  created_by?: number;
  assigned_to?: number;
  priority?: 'low' | 'medium' | 'high';
  department?: string;
}

// ============================================
// ✅ الفلاتر - ✅ تم إزالة 'all'
// ============================================

export interface PurchaseFilters {
  status?: PurchaseStatus;  // ✅ إزالة 'all'
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'date' | 'delivery_date' | 'status' | 'requester' | 'request_number';
  sortOrder?: 'ASC' | 'DESC';
  isOverdue?: boolean;
  isExpiring?: boolean;
  requester?: string;
  receiver?: string;
}

// ============================================
// ✅ الاستجابات
// ============================================

export interface PurchaseResponse {
  data: Purchase[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// ✅ الإحصائيات
// ============================================

export interface StatusCount {
  status: PurchaseStatus;
  count: number;
  percentage: number;
}

export interface RequesterCount {
  requester: string;
  count: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  count: number;
  completed: number;
  pending: number;
}

export interface DashboardStats {
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  inProgress: number;
  delayed: number;
  overdue: number;
  expiringToday: number;
  expiringSoon: number;
  completionRate: number;
  onTimeRate: number;
  byStatus: StatusCount[];
  byRequester: RequesterCount[];
  monthlyTrend: MonthlyTrend[];
}

// ============================================
// ✅ ثوابت الحالات
// ============================================

export const statusColors: Record<PurchaseStatus, string> = {
  'قيد التنفيذ': 'bg-yellow-100 text-yellow-800',
  'منجز': 'bg-green-100 text-green-800',
  'معلق': 'bg-red-100 text-red-800',
  'ملغي': 'bg-gray-100 text-gray-800'
};

export const statusColorsDark: Record<PurchaseStatus, string> = {
  'قيد التنفيذ': 'from-yellow-500 to-yellow-600',
  'منجز': 'from-green-500 to-green-600',
  'معلق': 'from-red-500 to-red-600',
  'ملغي': 'from-gray-500 to-gray-600'
};

export const statusIcons: Record<PurchaseStatus, string> = {
  'قيد التنفيذ': 'fa-spinner fa-pulse',
  'منجز': 'fa-check-circle',
  'معلق': 'fa-clock',
  'ملغي': 'fa-times-circle'
};

export const statusLabels: Record<PurchaseStatus, string> = {
  'قيد التنفيذ': 'قيد التنفيذ',
  'منجز': 'منجز',
  'معلق': 'معلق',
  'ملغي': 'ملغي'
};

export const statusOptions: PurchaseStatus[] = ['قيد التنفيذ', 'منجز', 'معلق', 'ملغي'];

// ============================================
// ✅ دوال مساعدة
// ============================================

export const getStatusColor = (status: PurchaseStatus): string => {
  return statusColors[status] || 'bg-gray-100 text-gray-500';
};

export const getStatusColorDark = (status: PurchaseStatus): string => {
  return statusColorsDark[status] || 'from-gray-400 to-gray-500';
};

export const getStatusIcon = (status: PurchaseStatus): string => {
  return statusIcons[status] || 'fa-circle';
};

export const getStatusLabel = (status: PurchaseStatus): string => {
  return statusLabels[status] || status;
};

export const isCompleted = (status: PurchaseStatus): boolean => {
  return status === 'منجز';
};

export const isCancelled = (status: PurchaseStatus): boolean => {
  return status === 'ملغي';
};

export const isActive = (status: PurchaseStatus): boolean => {
  return status === 'قيد التنفيذ' || status === 'معلق';
};

export const isOverdue = (purchase: Purchase): boolean => {
  if (isCompleted(purchase.status) || isCancelled(purchase.status)) {
    return false;
  }
  const today = new Date();
  const deliveryDate = new Date(purchase.delivery_date);
  return deliveryDate < today;
};

export const getDaysRemaining = (purchase: Purchase): number => {
  if (isCompleted(purchase.status) || isCancelled(purchase.status)) {
    return 0;
  }
  const today = new Date();
  const deliveryDate = new Date(purchase.delivery_date);
  const diffTime = deliveryDate.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const getAlertLevel = (purchase: Purchase): 'success' | 'warning' | 'danger' | 'info' => {
  if (isCompleted(purchase.status)) return 'success';
  if (isCancelled(purchase.status)) return 'info';
  
  const daysRemaining = getDaysRemaining(purchase);
  if (daysRemaining < 0) return 'danger';
  if (daysRemaining <= 1) return 'warning';
  if (daysRemaining <= 3) return 'warning';
  return 'info';
};