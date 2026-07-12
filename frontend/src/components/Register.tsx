// src/components/Register.tsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

interface Props {
  onClose?: () => void;
  onSwitchToLogin?: () => void;
}

const Register: React.FC<Props> = ({ onClose, onSwitchToLogin }) => {
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    email: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // ============================================
  // ✅ التحقق من قوة كلمة المرور
  // ============================================

  const validatePassword = (password: string): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    
    if (password.length < 6) {
      errors.push('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    }
    if (password.length > 0 && !/[A-Z]/.test(password)) {
      errors.push('يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل');
    }
    if (password.length > 0 && !/[a-z]/.test(password)) {
      errors.push('يجب أن تحتوي كلمة المرور على حرف صغير واحد على الأقل');
    }
    if (password.length > 0 && !/[0-9]/.test(password)) {
      errors.push('يجب أن تحتوي كلمة المرور على رقم واحد على الأقل');
    }
    if (password.length > 0 && !/[!@#$%^&*]/.test(password)) {
      errors.push('يجب أن تحتوي كلمة المرور على حرف خاص واحد على الأقل');
    }
    
    return { valid: errors.length === 0, errors };
  };

  // ============================================
  // ✅ حساب قوة كلمة المرور
  // ============================================

  const getPasswordStrength = (password: string): { score: number; label: string; color: string } => {
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[!@#$%^&*]/.test(password)) score++;
    
    const levels = [
      { label: 'ضعيفة', color: 'bg-red-500' },
      { label: 'ضعيفة', color: 'bg-red-400' },
      { label: 'متوسطة', color: 'bg-yellow-500' },
      { label: 'جيدة', color: 'bg-blue-500' },
      { label: 'قوية', color: 'bg-green-500' },
    ];
    
    return { score, label: levels[score]?.label || 'ضعيفة', color: levels[score]?.color || 'bg-red-500' };
  };

  // ============================================
  // ✅ معالج التغيير
  // ============================================

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // ✅ مسح أخطاء الحقل عند التغيير
    if (fieldErrors[e.target.name]) {
      setFieldErrors({ ...fieldErrors, [e.target.name]: '' });
    }
  };

  // ============================================
  // ✅ معالج الإرسال
  // ============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    // ✅ التحقق من تطابق كلمة المرور
    if (formData.password !== formData.confirmPassword) {
      setFieldErrors({ confirmPassword: 'كلمة المرور غير متطابقة' });
      setError('كلمة المرور غير متطابقة');
      return;
    }

    // ✅ التحقق من قوة كلمة المرور
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.errors[0]);
      return;
    }

    // ✅ التحقق من الموافقة على الشروط
    if (!agreedToTerms) {
      setError('يجب الموافقة على شروط الاستخدام');
      return;
    }

    setLoading(true);
    
    try {
      const { confirmPassword, ...data } = formData;
      const success = await register(data);
      
      if (success) {
        if (onSwitchToLogin) {
          onSwitchToLogin();
        }
        if (onClose) {
          onClose();
        }
      } else {
        setError('فشل إنشاء الحساب، يرجى المحاولة مرة أخرى');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'حدث خطأ في إنشاء الحساب';
      const errorDetails = err.response?.data?.details;
      
      if (errorDetails && Array.isArray(errorDetails)) {
        setError(errorDetails.map((e: any) => e.message).join(', '));
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // ✅ Render
  // ============================================

  return (
    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full">
      <div className="text-center mb-8">
        <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
          <i className="fas fa-user-plus text-white text-3xl"></i>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mt-4">إنشاء حساب جديد</h2>
        <p className="text-gray-500 text-sm">سجل بياناتك للانضمام إلى النظام</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* الاسم الكامل */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fas fa-user text-green-500 ml-1"></i>
              الاسم الكامل *
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="أدخل الاسم الكامل"
              required
              disabled={loading}
            />
          </div>

          {/* اسم المستخدم */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fas fa-user-tag text-green-500 ml-1"></i>
              اسم المستخدم *
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="أدخل اسم المستخدم"
              required
              disabled={loading}
              dir="ltr"
            />
          </div>

          {/* البريد الإلكتروني */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fas fa-envelope text-green-500 ml-1"></i>
              البريد الإلكتروني
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
              placeholder="أدخل البريد الإلكتروني"
              disabled={loading}
              dir="ltr"
            />
          </div>

          {/* كلمة المرور */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fas fa-key text-green-500 ml-1"></i>
              كلمة المرور *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="أدخل كلمة المرور (6 أحرف على الأقل)"
                required
                disabled={loading}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                <i className={`fas ${showPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
              </button>
            </div>
            
            {/* مؤشر قوة كلمة المرور */}
            {formData.password && (
              <div className="mt-2">
                <div className="flex gap-1 h-1.5">
                  {[...Array(5)].map((_, i) => {
                    const strength = getPasswordStrength(formData.password);
                    return (
                      <div
                        key={i}
                        className={`flex-1 rounded-full transition-all ${
                          i < strength.score ? strength.color : 'bg-gray-200'
                        }`}
                      />
                    );
                  })}
                </div>
                <p className={`text-xs mt-1 ${
                  getPasswordStrength(formData.password).score >= 4 ? 'text-green-600' :
                  getPasswordStrength(formData.password).score >= 3 ? 'text-blue-600' :
                  getPasswordStrength(formData.password).score >= 2 ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  قوة كلمة المرور: {getPasswordStrength(formData.password).label}
                </p>
              </div>
            )}
          </div>

          {/* تأكيد كلمة المرور */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fas fa-check-double text-green-500 ml-1"></i>
              تأكيد كلمة المرور *
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                placeholder="أعد كتابة كلمة المرور"
                required
                disabled={loading}
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                tabIndex={-1}
              >
                <i className={`fas ${showConfirmPassword ? 'fa-eye' : 'fa-eye-slash'}`}></i>
              </button>
            </div>
            {fieldErrors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          {/* شروط الاستخدام */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
              disabled={loading}
            />
            <label htmlFor="terms" className="text-sm text-gray-600">
              أوافق على{' '}
              <a href="#" className="text-green-600 hover:underline">
                شروط الاستخدام
              </a>
            </label>
          </div>

          {/* رسالة الخطأ */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-circle text-red-500"></i>
              {error}
            </div>
          )}

          {/* زر إنشاء الحساب */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-500 to-teal-600 text-white rounded-xl py-3 font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fas fa-spinner fa-spin"></i>
                جاري إنشاء الحساب...
              </span>
            ) : (
              'إنشاء حساب'
            )}
          </button>
        </div>
      </form>

      {/* رابط تسجيل الدخول */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-sm text-purple-600 hover:text-purple-800 font-medium transition-colors"
          disabled={loading}
        >
          لديك حساب بالفعل؟ <span className="underline">تسجيل الدخول</span>
        </button>
      </div>
    </div>
  );
};

export default Register;