import { useState, useEffect } from 'react';
import { purchaseApi } from '../api/purchaseApi';

interface Props {
  onClick: () => void;
}

const AlertBell: React.FC<Props> = ({ onClick }) => {
  const [alertCount, setAlertCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlertCount();
    // تحديث كل 30 ثانية
    const interval = setInterval(loadAlertCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadAlertCount = async () => {
    try {
      const stats = await purchaseApi.getAlertStats();
      const count = stats.overdue + stats.expiringToday;
      setAlertCount(count);
      setLoading(false);
    } catch (error) {
      console.error('Error loading alert count:', error);
    }
  };

  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
    >
      <i className="fas fa-bell text-xl text-gray-600"></i>
      {!loading && alertCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
          {alertCount > 9 ? '9+' : alertCount}
        </span>
      )}
    </button>
  );
};

export default AlertBell;