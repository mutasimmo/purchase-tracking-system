// src/repositories/purchase.repository.ts
import { getSupabase } from '../config/database.js';
import { NotFoundError, ConflictError, ValidationError } from '../types/errors.js';
import logger from '../config/logger.js';

export interface Purchase {
  id: number;
  request_number: string;
  date: string;
  requester: string;
  invoice_owner?: string;
  description: string;
  receiver: string;
  delivery_date: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  created_by?: number;
  assigned_to?: number;
  priority?: string;
  department?: string;
}

export interface PurchaseCreate {
  request_number: string;
  date: string;
  requester: string;
  invoice_owner?: string;
  description: string;
  receiver: string;
  delivery_date: string;
  status?: string;
  notes?: string;
  created_by?: number;
}

export interface PurchaseFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

// ============================================
// 📌 Purchase Repository
// ============================================

export const PurchaseRepository = {
  // ✅ Find purchase by ID
  findById: async (id: number): Promise<Purchase | null> => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('PurchaseRepository.findById error:', error);
      throw error;
    }
  },

  // ✅ Find purchase by request number
  findByRequestNumber: async (requestNumber: string): Promise<Purchase | null> => {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('request_number', requestNumber)
        .is('deleted_at', null)
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      logger.error('PurchaseRepository.findByRequestNumber error:', error);
      throw error;
    }
  },

  // ✅ Create new purchase
  create: async (data: PurchaseCreate): Promise<Purchase> => {
    try {
      const supabase = getSupabase();

      // Check unique request number
      const existing = await PurchaseRepository.findByRequestNumber(data.request_number);
      if (existing) {
        throw new ConflictError('Request number already exists');
      }

      const { data: result, error } = await supabase
        .from('purchases')
        .insert({
          request_number: data.request_number,
          date: data.date,
          requester: data.requester,
          invoice_owner: data.invoice_owner || '',
          description: data.description,
          receiver: data.receiver,
          delivery_date: data.delivery_date,
          status: data.status || 'قيد التنفيذ',
          notes: data.notes || '',
          created_by: data.created_by || null
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      logger.error('PurchaseRepository.create error:', error);
      throw error;
    }
  },

  // ✅ Update purchase
  update: async (id: number, updates: Partial<Purchase>): Promise<Purchase> => {
    try {
      const supabase = getSupabase();

      const existing = await PurchaseRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('Purchase not found');
      }

      // Check request number uniqueness
      if (updates.request_number && updates.request_number !== existing.request_number) {
        const duplicate = await PurchaseRepository.findByRequestNumber(updates.request_number);
        if (duplicate) {
          throw new ConflictError('Request number already used by another purchase');
        }
      }

      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      const fields = [
        'request_number', 'date', 'requester', 'invoice_owner',
        'description', 'receiver', 'delivery_date', 'status',
        'notes', 'priority', 'department', 'assigned_to'
      ];

      for (const field of fields) {
        if (updates[field as keyof Purchase] !== undefined) {
          updateData[field] = updates[field as keyof Purchase];
        }
      }

      const { data: result, error } = await supabase
        .from('purchases')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      logger.error('PurchaseRepository.update error:', error);
      throw error;
    }
  },

  // ✅ Soft delete purchase
  delete: async (id: number): Promise<void> => {
    try {
      const supabase = getSupabase();

      const existing = await PurchaseRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('Purchase not found');
      }

      const { error } = await supabase
        .from('purchases')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    } catch (error) {
      logger.error('PurchaseRepository.delete error:', error);
      throw error;
    }
  },

  // ✅ Restore deleted purchase
  restore: async (id: number): Promise<Purchase> => {
    try {
      const supabase = getSupabase();

      const { data: result, error } = await supabase
        .from('purchases')
        .update({
          deleted_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      logger.error('PurchaseRepository.restore error:', error);
      throw error;
    }
  },

  // ✅ Get all purchases with filters and pagination
  findAll: async (filters: PurchaseFilters = {}): Promise<{ data: Purchase[]; total: number }> => {
    try {
      const supabase = getSupabase();
      const {
        status,
        startDate,
        endDate,
        search,
        page = 1,
        limit = 10,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = filters;

      const offset = (page - 1) * limit;

      let query = supabase
        .from('purchases')
        .select('*', { count: 'exact' })
        .is('deleted_at', null);

      // Apply filters
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      if (startDate) {
        query = query.gte('date', startDate);
      }

      if (endDate) {
        query = query.lte('date', endDate);
      }

      if (search) {
        query = query.or(
          `request_number.ilike.%${search}%,` +
          `requester.ilike.%${search}%,` +
          `invoice_owner.ilike.%${search}%,` +
          `description.ilike.%${search}%,` +
          `receiver.ilike.%${search}%,` +
          `notes.ilike.%${search}%`
        );
      }

      // Apply sorting
      const validSortColumns = ['created_at', 'date', 'delivery_date', 'status', 'requester', 'request_number', 'invoice_owner'];
      const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = sortOrder === 'ASC' ? true : false;

      const { data, error, count } = await query
        .range(offset, offset + limit - 1)
        .order(sortColumn, { ascending: sortDirection });

      if (error) throw error;
      return { data: data || [], total: count || 0 };
    } catch (error) {
      logger.error('PurchaseRepository.findAll error:', error);
      throw error;
    }
  },

  // ✅ Get dashboard statistics
  getDashboardStats: async (): Promise<any> => {
    try {
      const supabase = getSupabase();

      // Get all purchases (not deleted)
      const { data: allPurchases, error } = await supabase
        .from('purchases')
        .select('*')
        .is('deleted_at', null);

      if (error) throw error;

      const purchases = allPurchases || [];
      const total = purchases.length;

      // Calculate statistics
      const completed = purchases.filter(p => p.status === 'منجز').length;
      const pending = purchases.filter(p => p.status === 'قيد التنفيذ').length;
      const cancelled = purchases.filter(p => p.status === 'ملغي').length;
      const inProgress = purchases.filter(p => p.status === 'معلق').length;

      const today = new Date();
      const delayed = purchases.filter(p => {
        if (p.status === 'منجز' || p.status === 'ملغي') return false;
        return new Date(p.delivery_date) < today;
      }).length;

      const overdue = purchases.filter(p => {
        if (p.status === 'منجز' || p.status === 'ملغي') return false;
        const deliveryDate = new Date(p.delivery_date);
        const diffDays = (today.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays >= 2;
      }).length;

      const completionRate = total > 0 ? (completed / total) * 100 : 0;

      // By status
      const statusMap = new Map();
      for (const p of purchases) {
        statusMap.set(p.status, (statusMap.get(p.status) || 0) + 1);
      }
      const byStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
        status,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0
      }));

      // By requester (top 5)
      const requesterMap = new Map();
      for (const p of purchases) {
        requesterMap.set(p.requester, (requesterMap.get(p.requester) || 0) + 1);
      }
      const byRequester = Array.from(requesterMap.entries())
        .map(([requester, count]) => ({
          requester,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Monthly trend (last 6 months)
      const monthlyTrend = [];
      for (let i = 5; i >= 0; i--) {
        const month = new Date();
        month.setMonth(month.getMonth() - i);
        const monthStr = month.toISOString().substring(0, 7);

        const monthPurchases = purchases.filter(p => p.date && p.date.startsWith(monthStr));
        monthlyTrend.push({
          month: monthStr,
          count: monthPurchases.length,
          completed: monthPurchases.filter(p => p.status === 'منجز').length,
          pending: monthPurchases.filter(p => p.status !== 'منجز' && p.status !== 'ملغي').length
        });
      }

      return {
        total,
        completed,
        pending,
        cancelled,
        inProgress,
        delayed,
        overdue,
        expiringToday: 0,
        expiringSoon: 0,
        completionRate,
        onTimeRate: 0,
        byStatus,
        byRequester,
        monthlyTrend
      };
    } catch (error) {
      logger.error('PurchaseRepository.getDashboardStats error:', error);
      throw error;
    }
  },

  // ✅ Get overdue purchases
  getOverdue: async (): Promise<Purchase[]> => {
    try {
      const supabase = getSupabase();
      const today = new Date().toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .is('deleted_at', null)
        .not('status', 'in', '("منجز","ملغي")')
        .lt('delivery_date', today)
        .order('delivery_date', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('PurchaseRepository.getOverdue error:', error);
      throw error;
    }
  },

  // ✅ Get expiring today
  getExpiringToday: async (): Promise<Purchase[]> => {
    try {
      const supabase = getSupabase();
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .is('deleted_at', null)
        .not('status', 'in', '("منجز","ملغي")')
        .eq('delivery_date', tomorrowStr);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('PurchaseRepository.getExpiringToday error:', error);
      throw error;
    }
  },

  // ✅ Update status
  updateStatus: async (id: number, status: string): Promise<Purchase> => {
    try {
      const supabase = getSupabase();

      const existing = await PurchaseRepository.findById(id);
      if (!existing) {
        throw new NotFoundError('Purchase not found');
      }

      const { data: result, error } = await supabase
        .from('purchases')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return result;
    } catch (error) {
      logger.error('PurchaseRepository.updateStatus error:', error);
      throw error;
    }
  },

  // ✅ Search purchases
  search: async (query: string, filters: any = {}): Promise<Purchase[]> => {
    try {
      const supabase = getSupabase();
      let searchQuery = supabase
        .from('purchases')
        .select('*')
        .is('deleted_at', null)
        .or(
          `request_number.ilike.%${query}%,` +
          `requester.ilike.%${query}%,` +
          `invoice_owner.ilike.%${query}%,` +
          `description.ilike.%${query}%,` +
          `receiver.ilike.%${query}%`
        );

      if (filters.status && filters.status !== 'all') {
        searchQuery = searchQuery.eq('status', filters.status);
      }

      const { data, error } = await searchQuery
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    } catch (error) {
      logger.error('PurchaseRepository.search error:', error);
      throw error;
    }
  }
};

export default PurchaseRepository;