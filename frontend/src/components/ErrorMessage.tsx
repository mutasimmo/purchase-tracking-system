// src/components/ErrorMessage.tsx
interface Props {
  message: string;
  onRetry?: () => void;
}

const ErrorMessage: React.FC<Props> = ({ message, onRetry }) => {
  return (
    <div className="bg-red-50 border-r-4 border-red-500 text-red-700 px-6 py-4 rounded-2xl flex items-center gap-3">
      <i className="fas fa-exclamation-circle text-red-500 text-xl"></i>
      <span className="font-medium">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mr-auto px-4 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
        >
          إعادة المحاولة
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;