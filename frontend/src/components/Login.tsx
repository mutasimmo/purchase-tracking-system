// src/components/Login.tsx - ✅ تم حذف رابط إنشاء حساب
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

interface Props {
  onClose?: () => void;
  onRegister?: () => void;
}

const Login: React.FC<Props> = ({ onClose, onRegister }) => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // ============================================
  // ✅ استعادة اسم المستخدم المحفوظ
  // ============================================

  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
  }, []);

  // ============================================
  // ✅ التحقق من صحة الإدخال
  // ============================================

  const validateForm = (): boolean => {
    if (!username.trim()) {
      setError('يرجى إدخال اسم المستخدم');
      return false;
    }
    if (!password.trim()) {
      setError('يرجى إدخال كلمة المرور');
      return false;
    }
    if (password.length < 3) {
      setError('كلمة المرور يجب أن تكون 3 أحرف على الأقل');
      return false;
    }
    return true;
  };

  // ============================================
  // ✅ معالج الإرسال
  // ============================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      const success = await login(username, password);
      
      if (success) {
        // ✅ حفظ اسم المستخدم إذا تم اختيار "تذكرني"
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', username);
        } else {
          localStorage.removeItem('rememberedUsername');
        }
        
        if (onClose) {
          onClose();
        }
      } else {
        setError('اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'حدث خطأ في تسجيل الدخول';
      setError(errorMessage);
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
        <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
          <i className="fas fa-lock text-white text-3xl"></i>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mt-4">تسجيل الدخول</h2>
        <p className="text-gray-500 text-sm">أدخل بياناتك للوصول إلى النظام</p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {/* اسم المستخدم */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fas fa-user text-purple-500 ml-1"></i>
              اسم المستخدم
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              placeholder="أدخل اسم المستخدم"
              required
              disabled={loading}
              dir="ltr"
            />
          </div>

          {/* كلمة المرور */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <i className="fas fa-key text-purple-500 ml-1"></i>
              كلمة المرور
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-12 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                placeholder="أدخل كلمة المرور"
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
          </div>

          {/* تذكرني */}
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
              />
              <span className="text-sm text-gray-600">تذكرني</span>
            </label>
            
            <a
              href="#"
              className="text-sm text-purple-600 hover:text-purple-800 hover:underline"
              onClick={(e) => {
                e.preventDefault();
                // ✅ يمكن إضافة منطق "نسيت كلمة المرور" هنا
              }}
            >
              نسيت كلمة المرور؟
            </a>
          </div>

          {/* رسالة الخطأ */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
              <i className="fas fa-exclamation-circle text-red-500"></i>
              {error}
            </div>
          )}

          {/* زر تسجيل الدخول */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl py-3 font-semibold hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <i className="fas fa-spinner fa-spin"></i>
                جاري تسجيل الدخول...
              </span>
            ) : (
              'تسجيل الدخول'
            )}
          </button>

          {/* ✅ تم حذف رابط "إنشاء حساب جديد" */}
          {/* <div className="text-center mt-2">
            <span className="text-sm text-gray-500">ليس لديك حساب؟ </span>
            <button
              type="button"
              onClick={onRegister}
              className="text-sm text-purple-600 hover:text-purple-800 hover:underline font-semibold"
            >
              إنشاء حساب جديد
            </button>
          </div> */}
        </div>
      </form>
    </div>
  );
};

export default Login;