// frontend/src/components/PurchaseForm.tsx
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Purchase } from '../types/purchase.types';

interface Props {
  purchase?: Purchase | null;
  onSubmit: (data: any) => void;
  onCancel: () => void;
  onDelete?: () => void;
  loading?: boolean;
  nextRequestNumber?: string;
}

const PurchaseForm: React.FC<Props> = ({ 
  purchase, 
  onSubmit, 
  onCancel, 
  onDelete,
  loading, 
  nextRequestNumber 
}) => {
  const [formData, setFormData] = useState({
    request_number: '',
    date: new Date().toISOString().split('T')[0],
    requester: '',
    invoice_owner: '',
    description: '',
    receiver: '',
    delivery_date: '',
    status: 'قيد التنفيذ',
    notes: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const isEditing = !!purchase;

  // ✅ Refs
  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const mouseContainerRef = useRef<HTMLDivElement>(null);

  // ✅ حالة التمرير
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | 'none'>('none');
  const [isHovering, setIsHovering] = useState(false);
  
  // ✅ متغيرات التمرير
  const animationRef = useRef<number | null>(null);
  const targetSpeedRef = useRef<number>(0);
  const isScrollingRef = useRef<boolean>(false);

  // ============================================
  // ✅ 1. Auto-scroll عند فتح الفورم
  // ============================================
  useEffect(() => {
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
      setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
        }
      }, 300);
    }, 150);
  }, []);

  // ============================================
  // ✅ 2. Auto-scroll عند اقتراب المؤشر من الحواف
  // ============================================

  const startScrolling = useCallback(() => {
    const container = formRef.current;
    if (!container) {
      animationRef.current = null;
      isScrollingRef.current = false;
      return;
    }
    
    const maxScroll = container.scrollHeight - container.clientHeight;
    const speed = targetSpeedRef.current;
    
    if (Math.abs(speed) < 0.05 || maxScroll <= 0) {
      animationRef.current = null;
      isScrollingRef.current = false;
      setScrollDirection('none');
      return;
    }
    
    const currentScroll = container.scrollTop;
    let newScrollTop = currentScroll + speed;
    
    if (newScrollTop < 0) {
      newScrollTop = 0;
      targetSpeedRef.current = 0;
    } else if (newScrollTop > maxScroll) {
      newScrollTop = maxScroll;
      targetSpeedRef.current = 0;
    }
    
    container.scrollTop = newScrollTop;
    
    if (Math.abs(targetSpeedRef.current) > 0.05) {
      animationRef.current = requestAnimationFrame(startScrolling);
    } else {
      animationRef.current = null;
      isScrollingRef.current = false;
      setScrollDirection('none');
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = formRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const height = rect.height;
    const maxScroll = container.scrollHeight - container.clientHeight;
    
    if (maxScroll <= 0) {
      targetSpeedRef.current = 0;
      setScrollDirection('none');
      return;
    }
    
    const edgeThreshold = 0.3;
    const centerStart = height * edgeThreshold;
    const centerEnd = height * (1 - edgeThreshold);
    
    if (mouseY >= centerStart && mouseY <= centerEnd) {
      targetSpeedRef.current = 0;
      setScrollDirection('none');
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        isScrollingRef.current = false;
      }
      return;
    }
    
    let speed = 0;
    const maxSpeed = 8;
    
    if (mouseY < centerStart) {
      const distanceFromTop = mouseY / centerStart;
      speed = -(1 - distanceFromTop) * maxSpeed;
      setScrollDirection('up');
    } 
    else if (mouseY > centerEnd) {
      const distanceFromBottom = (mouseY - centerEnd) / (height - centerEnd);
      speed = distanceFromBottom * maxSpeed;
      setScrollDirection('down');
    }
    
    targetSpeedRef.current = speed;
    
    if (!isScrollingRef.current && Math.abs(speed) > 0.05) {
      isScrollingRef.current = true;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      animationRef.current = requestAnimationFrame(startScrolling);
    }
  }, [startScrolling]);

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    targetSpeedRef.current = 0;
    setScrollDirection('none');
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      isScrollingRef.current = false;
    }
  }, []);

  // ✅ تنظيف
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
        isScrollingRef.current = false;
      }
    };
  }, []);

  // ============================================
  // ✅ 3. باقي منطق الفورم
  // ============================================

  useEffect(() => {
    if (!isEditing && nextRequestNumber) {
      setFormData(prev => ({
        ...prev,
        request_number: nextRequestNumber
      }));
      if (errors.request_number) {
        setErrors(prev => ({ ...prev, request_number: '' }));
      }
    }
  }, [nextRequestNumber, isEditing, errors.request_number]);

  useEffect(() => {
    if (purchase) {
      setFormData({
        request_number: purchase.request_number || '',
        date: purchase.date || new Date().toISOString().split('T')[0],
        requester: purchase.requester || '',
        invoice_owner: purchase.invoice_owner || '',
        description: purchase.description || '',
        receiver: purchase.receiver || '',
        delivery_date: purchase.delivery_date || '',
        status: purchase.status || 'قيد التنفيذ',
        notes: purchase.notes || ''
      });
    }
  }, [purchase]);

  const validateForm = (data: typeof formData): Record<string, string> => {
    const errors: Record<string, string> = {};
    
    if (!data.request_number.trim()) {
      errors.request_number = 'رقم الطلب مطلوب';
    }
    if (!data.date) {
      errors.date = 'التاريخ مطلوب';
    }
    if (!data.requester.trim()) {
      errors.requester = 'الجهة الطالبة مطلوبة';
    }
    if (!data.description.trim()) {
      errors.description = 'وصف الطلب مطلوب';
    }
    if (data.date && data.delivery_date && data.delivery_date < data.date) {
      errors.delivery_date = 'تاريخ التسليم يجب أن يكون بعد تاريخ الطلب';
    }
    return errors;
  };

  const validationErrors = useMemo(() => validateForm(formData), [formData]);
  const isFormValid = Object.keys(validationErrors).length === 0;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name } = e.target;
    setTouched({ ...touched, [name]: true });
    const fieldErrors = validateForm(formData);
    if (fieldErrors[name]) {
      setErrors({ ...errors, [name]: fieldErrors[name] });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const allErrors = validateForm(formData);
    setErrors(allErrors);
    
    const allTouched: Record<string, boolean> = {};
    Object.keys(formData).forEach(key => {
      allTouched[key] = true;
    });
    setTouched(allTouched);
    
    if (Object.keys(allErrors).length > 0) {
      const firstErrorField = Object.keys(allErrors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        (element as HTMLElement).focus();
      }
      return;
    }
    
    const submitData = {
      request_number: formData.request_number.trim(),
      date: formData.date,
      requester: formData.requester.trim(),
      invoice_owner: formData.invoice_owner?.trim() || '',
      description: formData.description.trim(),
      receiver: formData.receiver?.trim() || 'غير محدد',
      delivery_date: formData.delivery_date || new Date().toISOString().split('T')[0],
      status: formData.status || 'قيد التنفيذ',
      notes: formData.notes?.trim() || ''
    };
    
    onSubmit(submitData);
  };

  const handleDelete = () => {
    if (window.confirm('هل أنت متأكد من حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء')) {
      onDelete?.();
    }
  };

  const statusOptions = ['قيد التنفيذ', 'منجز', 'معلق', 'ملغي'];

  // ============================================
  // ✅ 4. دوال مساعدة لعرض حالة التمرير (بدون نص)
  // ============================================

  const getScrollIcon = () => {
    if (scrollDirection === 'up') return '⬆️';
    if (scrollDirection === 'down') return '⬇️';
    return '🖱️';
  };

  const getScrollColor = () => {
    if (scrollDirection === 'up') return 'text-green-600 border-green-300 bg-green-50';
    if (scrollDirection === 'down') return 'text-blue-600 border-blue-300 bg-blue-50';
    return isHovering ? 'text-gray-600 border-gray-300 bg-gray-50' : 'text-gray-400 border-gray-200 bg-gray-50';
  };

  // ============================================
  // ✅ 5. Render
  // ============================================

  return (
    <form 
      ref={formRef}
      onSubmit={handleSubmit} 
      className="bg-white p-6 rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto scroll-smooth"
    >
      {/* ✅ حاوية الماوس فقط */}
      <div 
        ref={mouseContainerRef}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative"
      >
        {/* ✅ مؤشر حالة التمرير - أيقونة فقط */}
        <div className={`absolute top-2 right-2 text-base px-2 py-1 rounded-full border flex items-center gap-1 z-10 transition-all duration-300 ${getScrollColor()}`}>
          <span>{getScrollIcon()}</span>
          {isHovering && (
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          )}
        </div>

        {/* ✅ رأس الفورم */}
        <div className="flex justify-between items-center mb-6 border-b pb-3">
          <h2 className="text-2xl font-bold text-gray-800">
            {isEditing ? '✏️ تعديل طلب' : '➕ إضافة طلب جديد'}
          </h2>
          {isEditing && (
            <button
              type="button"
              onClick={handleDelete}
              className="text-red-600 hover:text-red-800 transition-colors"
              title="حذف الطلب"
            >
              <i className="fas fa-trash-alt text-xl"></i>
            </button>
          )}
        </div>
        
        {/* ✅ حقول الفورم */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* رقم الطلب */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              رقم الطلب <span className="text-red-500">*</span>
            </label>
            <input
              ref={firstInputRef}
              type="text"
              name="request_number"
              value={formData.request_number}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                errors.request_number && touched.request_number ? 'border-red-500' : 
                isEditing ? 'border-gray-300' : 'border-green-400 bg-green-50'
              }`}
              required
              readOnly={!isEditing}
              placeholder={isEditing ? '' : 'سيتم توليده تلقائياً'}
            />
            {!isEditing && (
              <p className="text-xs text-green-600 mt-1">✅ سيتم إنشاء رقم تلقائي</p>
            )}
            {errors.request_number && touched.request_number && (
              <p className="text-red-500 text-xs mt-1">{errors.request_number}</p>
            )}
          </div>
          
          {/* التاريخ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              التاريخ <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                errors.date && touched.date ? 'border-red-500' : 'border-gray-300'
              }`}
              required
            />
            {errors.date && touched.date && (
              <p className="text-red-500 text-xs mt-1">{errors.date}</p>
            )}
          </div>
          
          {/* الجهة الطالبة */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              الجهة الطالبة <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="requester"
              value={formData.requester}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                errors.requester && touched.requester ? 'border-red-500' : 'border-gray-300'
              }`}
              required
              placeholder="اسم الجهة أو القسم"
            />
            {errors.requester && touched.requester && (
              <p className="text-red-500 text-xs mt-1">{errors.requester}</p>
            )}
          </div>
          
          {/* صاحب الفاتورة */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              🧾 صاحب الفاتورة
            </label>
            <input
              type="text"
              name="invoice_owner"
              value={formData.invoice_owner}
              onChange={handleChange}
              onBlur={handleBlur}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="اسم صاحب الفاتورة (اختياري)"
            />
            <p className="text-xs text-gray-400 mt-1">اختياري - يمكن تركه فارغاً</p>
          </div>
          
          {/* المستلم */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              المستلم <span className="text-gray-400">(اختياري)</span>
            </label>
            <input
              type="text"
              name="receiver"
              value={formData.receiver}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                errors.receiver && touched.receiver ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="اسم المستلم (سيتم تعيين قيمة افتراضية)"
            />
            {errors.receiver && touched.receiver && (
              <p className="text-red-500 text-xs mt-1">{errors.receiver}</p>
            )}
            {!errors.receiver && (
              <p className="text-xs text-gray-400 mt-1">💡 سيتم تعيين "غير محدد" تلقائياً إذا تركت فارغاً</p>
            )}
          </div>
          
          {/* وصف الطلب */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              وصف الطلب <span className="text-red-500">*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                errors.description && touched.description ? 'border-red-500' : 'border-gray-300'
              }`}
              rows={3}
              required
              placeholder="تفاصيل الطلب..."
            />
            {errors.description && touched.description && (
              <p className="text-red-500 text-xs mt-1">{errors.description}</p>
            )}
          </div>
          
          {/* تاريخ التسليم */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              تاريخ التسليم <span className="text-gray-400">(اختياري)</span>
            </label>
            <input
              type="date"
              name="delivery_date"
              value={formData.delivery_date}
              onChange={handleChange}
              onBlur={handleBlur}
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                errors.delivery_date && touched.delivery_date ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="اختياري"
            />
            {errors.delivery_date && touched.delivery_date && (
              <p className="text-red-500 text-xs mt-1">{errors.delivery_date}</p>
            )}
            {!errors.delivery_date && (
              <p className="text-xs text-gray-400 mt-1">💡 سيتم تعيين تاريخ اليوم تلقائياً إذا تركت فارغاً</p>
            )}
          </div>
          
          {/* موقف التنفيذ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              موقف التنفيذ
            </label>
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

          {/* الملحوظات */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              📝 ملحوظات
            </label>
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
        
        {/* ✅ الأزرار */}
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
            className={`px-6 py-2 rounded-lg transition-colors ${
              loading || !isFormValid
                ? 'bg-blue-300 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white`}
            disabled={loading || !isFormValid}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <i className="fas fa-spinner fa-spin"></i>
                جاري الحفظ...
              </span>
            ) : (
              isEditing ? 'تحديث' : 'إضافة'
            )}
          </button>
        </div>

        {/* ✅ عرض الأخطاء */}
        {Object.keys(errors).length > 0 && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i>
              يرجى تصحيح {Object.keys(errors).length} خطأ قبل الحفظ
            </p>
          </div>
        )}

        {/* ✅ منطقة اختبار */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 text-center">
          <p className="text-sm text-gray-600">
            🖱️ <span className="font-medium">حرك الماوس فوق هذه المنطقة</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">
            الحواف العلوية والسفلية (30%) ← تفعّل التمرير • المنتصف (40%) ← لا يتحرك
          </p>
          <div className="mt-2 flex justify-center gap-4 text-xs">
            <span className="text-green-600">⬆️ أعلى</span>
            <span className="text-gray-400">⬛ منتصف</span>
            <span className="text-blue-600">⬇️ أسفل</span>
          </div>
        </div>
      </div>
    </form>
  );
};

export default PurchaseForm;