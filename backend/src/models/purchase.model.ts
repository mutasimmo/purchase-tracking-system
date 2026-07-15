// src/models/purchase.model.ts

export type PurchaseStatus = 'قيد التنفيذ' | 'منجز' | 'معلق' | 'ملغي';

export interface Purchase {
  id?: number;
  request_number: string;
  date: string;
  requester: string;
  invoice_owner?: string;
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

export interface PurchaseCreateRequest {
  request_number: string;
  date: string;
  requester: string;
  invoice_owner?: string;
  description: string;
  receiver: string;
  delivery_date: string;
  status?: PurchaseStatus;
  notes?: string;
}

export interface PurchaseUpdateRequest {
  request_number?: string;
  date?: string;
  requester?: string;
  invoice_owner?: string;
  description?: string;
  receiver?: string;
  delivery_date?: string;
  status?: PurchaseStatus;
  notes?: string;
  priority?: 'low' | 'medium' | 'high';
  department?: string;
}

export interface PurchaseFilters {
  status?: PurchaseStatus | string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  requester?: string;
  invoice_owner?: string;
}

export interface PurchaseResponse {
  data: Purchase[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}