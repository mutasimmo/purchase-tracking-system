// src/components/LoadingSpinner.tsx
const LoadingSpinner: React.FC = () => {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-purple-500 border-t-transparent"></div>
        <p className="mt-4 text-gray-600 font-semibold">جاري التحميل...</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;