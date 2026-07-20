// src/components/ParentsDedication.tsx
import { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
}

const ParentsDedication: React.FC<Props> = ({ onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  // ✅ التحقق من ظهور الدعاء اليوم
  useEffect(() => {
    const checkAndShowDedication = () => {
      const today = new Date().toDateString();
      const lastShown = localStorage.getItem('parentsDedicationLastShown');

      // ✅ إذا لم يظهر اليوم، أظهره
      if (lastShown !== today) {
        setIsVisible(true);
        // ✅ حفظ تاريخ اليوم
        localStorage.setItem('parentsDedicationLastShown', today);
      }
    };

    // ✅ تأخير بسيط للتأكد من تحميل الصفحة
    const timer = setTimeout(checkAndShowDedication, 500);
    return () => clearTimeout(timer);
  }, []);

  // ✅ منع التمرير خلف المودال
  useEffect(() => {
    if (isVisible) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isVisible]);

  const handleClose = () => {
    setIsVisible(false);
    onClose();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[9999] p-4 animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-lg w-full p-8 shadow-2xl relative overflow-hidden">
        {/* خلفية زخرفية */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-amber-100/30 rounded-full -translate-y-1/2 translate-x-1/2"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-orange-100/30 rounded-full translate-y-1/2 -translate-x-1/2"></div>

        <div className="relative z-10 text-center">
          {/* أيقونة */}
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg mb-4">
            <i className="fas fa-hands-praying text-white text-3xl"></i>
          </div>

          {/* العنوان */}
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            🙏 دعوة خاصة
          </h2>

          {/* النص */}
          <div className="bg-amber-50 rounded-2xl p-6 mb-6 border border-amber-200">
            <p className="text-lg text-amber-900 font-medium leading-relaxed">
              إلى <span className="text-amber-700 font-bold">روح والدتي</span> 🤍
            </p>
            <p className="text-md text-amber-800 mt-2">
              التي كانت ولا تزال نوراً في حياتي،
              <br />
              رحمها الله وغفر لها وأسكنها فسيح جناته.
            </p>
            
            <div className="my-4 border-t border-amber-200 pt-4">
              <p className="text-lg text-amber-900 font-medium leading-relaxed">
                وإلى <span className="text-amber-700 font-bold">والدي</span> 💚
              </p>
              <p className="text-md text-amber-800 mt-2">
                أسأل الله أن يطيل في عمره،
                <br />
                ويمنحه الصحة والعافية،
                <br />
                ويبارك في أيامه.
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-amber-200">
              <p className="text-sm text-amber-700">
                <i className="fas fa-quote-right ml-1"></i>
                اللهم ارحمها كما ربتني صغيراً، واحفظه وبارك في عمره
              </p>
            </div>
          </div>

          {/* أزرار */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleClose}
              className="px-8 py-3 bg-gradient-to-r from-amber-400 to-orange-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all duration-300 hover:scale-105"
            >
              <i className="fas fa-heart ml-2"></i>
              اللهم آمين
            </button>
          </div>

          <p className="text-xs text-gray-400 mt-4">
            🤍 في ذمة الله
          </p>
        </div>
      </div>
    </div>
  );
};

export default ParentsDedication;