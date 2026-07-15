// src/models/audit.model.ts

export type AuditAction = 
  | 'CREATE' 
  | 'UPDATE' 
  | 'DELETE' 
  | 'LOGIN' 
  | 'LOGOUT'
  | 'REGISTER'
  | 'PASSWORD_CHANGE'
  | 'PURCHASE_CREATE'
  | 'PURCHASE_UPDATE'
  | 'PURCHASE_DELETE'
  | 'PURCHASE_STATUS_CHANGE'
  | 'PURCHASE_RESTORE'
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_DELETE'
  | 'USER_STATUS'
  | 'USER_ROLE_CHANGE'
  | 'UPDATE_PROFILE'
  | 'FAILED_LOGIN'
  | 'JOIN_ROOM'
  | 'DISCONNECT'
  | 'PURCHASE_EXPORT';

export interface AuditLog {
  id?: number;
  user_id?: number;
  username: string;
  action: AuditAction | string;
  entity_type: string;
  entity_id?: number;
  changes?: any;
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

export interface AuditStats {
  total: number;
  today: number;
  byAction: {
    action: string;
    count: number;
  }[];
  byEntity: {
    entity_type: string;
    count: number;
  }[];
}