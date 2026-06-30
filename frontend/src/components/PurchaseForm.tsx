import { useState, useEffect } from 'react';
import type { Purchase } from '../types/purchase.types';

interface Props {
  purchase?: Purchase | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  loading?: boolean;
  nextRequestNumber?: string; // رقم الطلب التالي
}

const PurchaseForm: React.FC<Props> = ({ purchase, onSubmit, onCancel, loading, nextRequestNumber }) => {
  const [formData, setFormData] = useState({
    request_number: '',
    date: new Date().toISOString().split('T')[0],
    requester: '',
    description: '',
    receiver: '',
    delivery_date: '',
    status: 'قيد التنفيذ',
    notes: ''
  });

  useEffect(() => {
    if (purchase) {
      // عند التعديل، استخدم رقم الطلب الحالي
      setFormData({
        request_number: purchase.request_number || '',
        date: purchase.date || new Date().toISOString().split('T')[0],
        requester: purchase.requester || '',
        description: purchase.description || '',
        receiver: purchase.receiver || '',
        delivery_date: purchase.delivery_date || '',
        status: purchase.status || 'قيد التنفيذ',
        notes: purchase.notes || ''
      });
    } else if (nextRequestNumber) {
      // عند الإضافة، استخدم رقم الطلب التالي
      setFormData(prev => ({
        ...prev,
        request_number: nextRequestNumber
      }));
    }
  }, [purchase, nextRequestNumber]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      notes: formData.notes || ''
    });
  };

  const statusOptions = ['قيد التنفيذ', 'منجز', 'معلق', 'ملغي'];

  return (
    <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-3">
        {purchase ? '✏️ تعديل طلب' : '➕ إضافة طلب جديد'}
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">رقم الطلب *</label>
          <input
            type="text"
            name="request_number"
            value={formData.request_number}
            onChange={handleChange}
            className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              purchase ? 'border-gray-300' : 'border-green-400 bg-green-50'
            }`}
            required
            readOnly={!purchase} // فقط للقراءة عند الإضافة
            placeholder={purchase ? '' : 'سيتم توليده تلقائياً'}
          />
          {!purchase && (
            <p className="text-xs text-green-600 mt-1">✅ سيتم إنشاء رقم تلقائي</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">التاريخ *</label>
          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">الجهة الطالبة *</label>
          <input
            type="text"
            name="requester"
            value={formData.requester}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            placeholder="اسم الجهة أو القسم"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">المستلم *</label>
          <input
            type="text"
            name="receiver"
            value={formData.receiver}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            placeholder="اسم المستلم"
          />
        </div>
        
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">وصف الطلب *</label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            required
            placeholder="تفاصيل الطلب..."
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">تاريخ التسليم *</label>
          <input
            type="date"
            name="delivery_date"
            value={formData.delivery_date}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">موقف التنفيذ</label>
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>

        {/* حقل الملحوظات */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">📝 ملحوظات</label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            placeholder="أي ملحوظات إضافية..."
          />
        </div>
      </div>
      
      <div className="mt-6 flex gap-3 justify-end border-t pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          disabled={loading}
        >
          إلغاء
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-300"
          disabled={loading}
        >
          {loading ? 'جاري الحفظ...' : (purchase ? 'تحديث' : 'إضافة')}
        </button>
      </div>
    </form>
  );
};

export default PurchaseForm;