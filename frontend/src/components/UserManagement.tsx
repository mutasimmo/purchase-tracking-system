// src/components/UserManagement.tsx
import { useState, useEffect, useMemo } from 'react';
import { authApi } from '../api/authApi';
import toast from 'react-hot-toast';

interface Props {
  onClose: () => void;
}

interface User {
  id: number;
  username: string;
  full_name: string;
  email: string;
  role: 'admin' | 'user' | 'viewer';
  is_active: number;
  created_at: string;
  updated_at: string;
}

const UserManagement: React.FC<Props> = ({ onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; userId: number | null }>({
    show: false,
    userId: null
  });
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    full_name: '',
    email: '',
    role: 'user',
    is_active: true
  });

  const usersPerPage = 10;

  // ============================================
  // ✅ جلب المستخدمين
  // ============================================

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await authApi.getAllUsers();
      setUsers(data);
    } catch (error) {
      handleApiError(error, 'حدث خطأ في تحميل المستخدمين');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ✅ معالجة الأخطاء
  // ============================================

  const handleApiError = (error: any, defaultMessage: string) => {
    const errorMessage = error.response?.data?.error || 
                         error.response?.data?.message || 
                         error.message || 
                         defaultMessage;
    
    if (error.response?.status === 403) {
      toast.error('❌ ليس لديك صلاحية للقيام بهذا الإجراء');
      return;
    }
    
    if (error.response?.status === 401) {
      toast.error('❌ انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً');
      return;
    }
    
    toast.error(`❌ ${errorMessage}`);
  };

  // ============================================
  // ✅ الفلترة والترقيم
  // ============================================

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = user.username.includes(searchTerm) || 
                            user.full_name.includes(searchTerm) ||
                            (user.email && user.email.includes(searchTerm));
      const matchesRole = filterRole ? user.role === filterRole : true;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, filterRole]);

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const currentUsers = filteredUsers.slice(
    (currentPage - 1) * usersPerPage,
    currentPage * usersPerPage
  );

  // ============================================
  // ✅ دوال النموذج
  // ============================================

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target as HTMLInputElement;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
  };

  const validateForm = () => {
    if (!editingUser && !formData.password) {
      toast.error('❌ كلمة المرور مطلوبة');
      return false;
    }
    if (formData.password && formData.password.length < 6) {
      toast.error('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return false;
    }
    if (!formData.username.trim()) {
      toast.error('❌ اسم المستخدم مطلوب');
      return false;
    }
    if (!formData.full_name.trim()) {
      toast.error('❌ الاسم الكامل مطلوب');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    try {
      setFormLoading(true);
      if (editingUser) {
        await authApi.updateUser(editingUser.id, formData);
        toast.success('✅ تم تحديث المستخدم بنجاح');
      } else {
        await authApi.createUser(formData);
        toast.success('✅ تم إضافة المستخدم بنجاح');
      }
      setShowForm(false);
      setEditingUser(null);
      resetForm();
      await loadUsers();
    } catch (error: any) {
      handleApiError(error, 'حدث خطأ في حفظ المستخدم');
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      username: '',
      password: '',
      full_name: '',
      email: '',
      role: 'user',
      is_active: true
    });
  };

  // ============================================
  // ✅ دوال الإجراءات
  // ============================================

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      password: '',
      full_name: user.full_name,
      email: user.email || '',
      role: user.role,
      is_active: user.is_active === 1
    });
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    setDeleteConfirm({ show: true, userId: id });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.userId) return;
    try {
      await authApi.deleteUser(deleteConfirm.userId);
      toast.success('🗑️ تم حذف المستخدم بنجاح');
      await loadUsers();
    } catch (error: any) {
      handleApiError(error, 'حدث خطأ في حذف المستخدم');
    } finally {
      setDeleteConfirm({ show: false, userId: null });
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: number) => {
    try {
      const newStatus = currentStatus === 1 ? false : true;
      await authApi.toggleUserStatus(id, newStatus);
      toast.success(`✅ تم ${newStatus ? 'تفعيل' : 'تعطيل'} المستخدم بنجاح`);
      await loadUsers();
    } catch (error: any) {
      handleApiError(error, 'حدث خطأ في تغيير حالة المستخدم');
    }
  };

  // ============================================
  // ✅ دوال العرض
  // ============================================

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      admin: 'bg-red-100 text-red-700',
      user: 'bg-blue-100 text-blue-700',
      viewer: 'bg-gray-100 text-gray-700'
    };
    return styles[role] || 'bg-gray-100 text-gray-700';
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: 'مدير',
      user: 'مستخدم',
      viewer: 'مشاهد'
    };
    return labels[role] || role;
  };

  // ============================================
  // ✅ Render
  // ============================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-6 max-w-5xl w-full max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center">
            <i className="fas fa-users text-purple-500 text-2xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">إدارة المستخدمين</h2>
            <p className="text-sm text-gray-500">{filteredUsers.length} مستخدم</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
          {/* بحث */}
          <div className="relative flex-1 sm:flex-none">
            <input
              type="text"
              placeholder="بحث..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full sm:w-48 border border-gray-300 rounded-xl px-4 py-2 pr-10 focus:ring-2 focus:ring-purple-500 text-sm"
            />
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
          </div>
          
          {/* فلتر الدور */}
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="border border-gray-300 rounded-xl px-3 py-2 focus:ring-2 focus:ring-purple-500 text-sm"
          >
            <option value="">جميع الأدوار</option>
            <option value="admin">مدير</option>
            <option value="user">مستخدم</option>
            <option value="viewer">مشاهد</option>
          </select>
          
          <button
            onClick={() => {
              setEditingUser(null);
              resetForm();
              setShowForm(true);
            }}
            className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors flex items-center gap-2 text-sm"
          >
            <i className="fas fa-plus-circle"></i>
            إضافة مستخدم
          </button>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors px-2"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-right text-sm font-bold text-gray-600">#</th>
              <th className="px-4 py-3 text-right text-sm font-bold text-gray-600">اسم المستخدم</th>
              <th className="px-4 py-3 text-right text-sm font-bold text-gray-600">الاسم الكامل</th>
              <th className="px-4 py-3 text-right text-sm font-bold text-gray-600">البريد الإلكتروني</th>
              <th className="px-4 py-3 text-right text-sm font-bold text-gray-600">الدور</th>
              <th className="px-4 py-3 text-right text-sm font-bold text-gray-600">الحالة</th>
              <th className="px-4 py-3 text-center text-sm font-bold text-gray-600">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.map((user, index) => (
              <tr key={user.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sm text-gray-500">
                  {(currentPage - 1) * usersPerPage + index + 1}
                </td>
                <td className="px-4 py-3 text-sm font-medium">{user.username}</td>
                <td className="px-4 py-3 text-sm">{user.full_name}</td>
                <td className="px-4 py-3 text-sm">{user.email || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${getRoleBadge(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${user.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {user.is_active ? 'نشط' : 'معطل'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-center gap-2">
                    {user.username !== 'admin' && (
                      <>
                        <button
                          onClick={() => handleToggleStatus(user.id, user.is_active)}
                          className={`px-2 py-1 rounded text-xs font-medium ${user.is_active ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}
                        >
                          {user.is_active ? 'تعطيل' : 'تفعيل'}
                        </button>
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-600 hover:text-blue-800 font-medium text-sm px-2 py-1"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          onClick={() => handleDelete(user.id)}
                          className="text-red-600 hover:text-red-800 font-medium text-sm px-2 py-1"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </>
                    )}
                    {user.username === 'admin' && (
                      <span className="text-xs text-gray-400">مدير النظام</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded-lg disabled:opacity-50"
            >
              السابق
            </button>
            <span className="px-3 py-1">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded-lg disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        )}
      </div>

      {/* ============================================
          Delete Confirmation Modal
          ============================================ */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i className="fas fa-exclamation-triangle text-red-600 text-2xl"></i>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">تأكيد الحذف</h3>
            <p className="text-gray-600 mb-6">
              هل أنت متأكد من حذف هذا المستخدم؟<br />
              <span className="text-sm text-red-500">لا يمكن التراجع عن هذا الإجراء</span>
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setDeleteConfirm({ show: false, userId: null })}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
              >
                إلغاء
              </button>
              <button
                onClick={confirmDelete}
                className="px-6 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors"
              >
                حذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================
          Form Modal
          ============================================ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              {editingUser ? '✏️ تعديل مستخدم' : '➕ إضافة مستخدم جديد'}
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المستخدم *</label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleFormChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500"
                  required
                  disabled={!!editingUser}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {editingUser ? 'كلمة المرور (اتركها فارغة للحفاظ على الحالية)' : 'كلمة المرور *'}
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleFormChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500"
                  required={!editingUser}
                  minLength={6}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleFormChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">الدور</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleFormChange}
                  className="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="admin">مدير</option>
                  <option value="user">مستخدم</option>
                  <option value="viewer">مشاهد</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleFormChange}
                  className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                />
                <label className="text-sm font-medium text-gray-700">مفعل</label>
              </div>

              <div className="flex gap-3 justify-end border-t pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingUser(null);
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-6 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {formLoading ? 'جاري الحفظ...' : (editingUser ? 'تحديث' : 'إضافة')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;