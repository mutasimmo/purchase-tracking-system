export interface AuditLog {
  id?: number;
  user_id?: number;
  username: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT';
  entity_type: string;
  entity_id?: number;
  changes?: string;
  ip_address?: string;
  user_agent?: string;
  created_at?: string;
}

export interface AuditLogFilter {
  userId?: number;
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  data: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}