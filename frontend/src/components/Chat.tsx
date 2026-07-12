// src/components/Chat.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

interface Message {
  user: string;
  text: string;
  time: string;
  isSystem?: boolean;
  userId?: number;
}

interface Props {
  onClose: () => void;
}

const Chat: React.FC<Props> = ({ onClose }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  

  const ROOM = 'general';
  const MAX_RETRY_ATTEMPTS = 5;

  // ✅ استخدام الرابط الصحيح من البيئة
  const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://purchase-backend-lmsm.onrender.com';

  // ============================================
  // ✅ اتصال Socket.IO مع المصادقة
  // ============================================

  useEffect(() => {
    // ✅ الحصول على التوكن من localStorage
    const token = localStorage.getItem('token');
    
    if (!token) {
      toast.error('❌ يرجى تسجيل الدخول للدردشة');
      return;
    }

    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: MAX_RETRY_ATTEMPTS,
      reconnectionDelay: 1000,
      auth: {
        token: token
      }
    });

    setSocket(newSocket);

    // ✅ معالج الاتصال
    newSocket.on('connect', () => {
      setIsConnected(true);
      setReconnectAttempts(0);
      
      // تسجيل المستخدم
      if (user) {
        const displayName = user.full_name || user.username;
        newSocket.emit('register-user', displayName);
      }
      
      // الانضمام إلى الغرفة
      newSocket.emit('join-room', ROOM);
      
      // رسالة ترحيب
      const welcomeMessage: Message = {
        user: 'system',
        text: '🔗 تم الاتصال بالدردشة',
        time: new Date().toISOString(),
        isSystem: true
      };
      setMessages(prev => [...prev, welcomeMessage]);
    });

    // ✅ استقبال الرسائل
    newSocket.on('message', (message: Message) => {
      setMessages(prev => [...prev, message]);
    });

    // ✅ مؤشر الكتابة
    newSocket.on('typing', (data: { user: string; isTyping: boolean }) => {
      setTypingUsers(prev => {
        if (data.isTyping) {
          if (!prev.includes(data.user)) {
            return [...prev, data.user];
          }
          return prev;
        } else {
          return prev.filter(u => u !== data.user);
        }
      });
    });

    // ✅ قائمة المستخدمين المتصلين
    newSocket.on('online-users', (users: string[]) => {
      // يمكن استخدامها لعرض المستخدمين المتصلين
    });

    // ✅ معالج قطع الاتصال
    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // ✅ معالج أخطاء الاتصال
    newSocket.on('connect_error', (error) => {
      setIsConnected(false);
      setReconnectAttempts(prev => prev + 1);
      
      if (error.message === 'Authentication required') {
        toast.error('❌ يرجى تسجيل الدخول للدردشة');
      } else if (reconnectAttempts >= MAX_RETRY_ATTEMPTS) {
        toast.error('❌ فشل الاتصال بالدردشة، يرجى المحاولة لاحقاً');
      }
    });

    // ✅ معالج الأخطاء العامة
    newSocket.on('error', (error) => {
      toast.error('❌ حدث خطأ في الدردشة');
    });

    // ✅ تنظيف عند الخروج
    return () => {
      if (newSocket.connected) {
        newSocket.emit('leave-room', ROOM);
      }
      newSocket.disconnect();
    };
  }, [user, SOCKET_URL, reconnectAttempts]);

  // ============================================
  // ✅ التمرير إلى آخر رسالة
  // ============================================

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============================================
  // ✅ دوال الإرسال
  // ============================================

  const sendMessage = useCallback(() => {
    if (!inputMessage.trim() || !socket || !user || !isConnected) return;

    const displayName = user.full_name || user.username;
    const messageData = {
      room: ROOM,
      user: displayName,
      text: inputMessage.trim()
    };

    socket.emit('send-message', messageData);
    setInputMessage('');
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    socket.emit('typing', { room: ROOM, user: displayName, isTyping: false });
  }, [inputMessage, socket, user, isConnected]);

  // ============================================
  // ✅ معالج الكتابة
  // ============================================

  const handleTyping = useCallback(() => {
    if (!socket || !user || !isConnected) return;

    const displayName = user.full_name || user.username;

    if (!typingTimeoutRef.current) {
      socket.emit('typing', { room: ROOM, user: displayName, isTyping: true });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
      socket.emit('typing', { room: ROOM, user: displayName, isTyping: false });
    }, 2000);
  }, [socket, user, isConnected]);

  // ============================================
  // ✅ معالج مفتاح Enter
  // ============================================

  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && isConnected && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage, isConnected]);

  // ============================================
  // ✅ تنسيق الوقت
  // ============================================

  const formatTime = (time: string) => {
    return new Date(time).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // ============================================
  // ✅ التحقق من أن الرسالة للمستخدم الحالي
  // ============================================

  const isOwnMessage = (msg: Message) => {
    const displayName = user?.full_name || user?.username;
    return msg.user === displayName;
  };

  // ============================================
  // ✅ Render
  // ============================================

  return (
    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
            <i className="fas fa-comment-dots text-white text-xl"></i>
          </div>
          <div>
            <h3 className="text-white font-bold">الدردشة</h3>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
              <span className="text-white/70 text-xs">
                {isConnected ? 'متصل' : 'غير متصل'}
              </span>
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
        >
          <i className="fas fa-times"></i>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-[400px] max-h-[500px]">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <i className="fas fa-comments text-4xl mb-4 block"></i>
            <p>لا توجد رسائل بعد</p>
            <p className="text-sm">كن أول من يكتب!</p>
          </div>
        ) : (
          <>
            {messages.map((msg, index) => (
              <div key={index} className={`mb-3 ${msg.isSystem ? 'text-center' : ''}`}>
                {msg.isSystem ? (
                  <div className="text-xs text-gray-400 bg-gray-200/50 rounded-full px-4 py-1 inline-block">
                    {msg.text}
                  </div>
                ) : (
                  <div className={`flex ${isOwnMessage(msg) ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] ${isOwnMessage(msg) ? 'bg-purple-500 text-white' : 'bg-white border border-gray-200'} rounded-2xl px-4 py-2 shadow-sm`}>
                      <div className={`text-xs font-semibold ${isOwnMessage(msg) ? 'text-purple-200' : 'text-purple-600'} mb-0.5`}>
                        {msg.user}
                      </div>
                      <div className="text-sm break-words">{msg.text}</div>
                      <div className={`text-[10px] mt-1 ${isOwnMessage(msg) ? 'text-purple-200/70' : 'text-gray-400'}`}>
                        {formatTime(msg.time)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {typingUsers.length > 0 && (
              <div className="text-xs text-gray-400 italic">
                {typingUsers.join(', ')} يكتب...
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={handleKeyPress}
            placeholder={isConnected ? "اكتب رسالتك..." : "جارٍ الاتصال..."}
            className="flex-1 border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100"
            disabled={!isConnected || !user}
          />
          <button
            onClick={sendMessage}
            disabled={!isConnected || !user || !inputMessage.trim()}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl px-6 py-2 hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <i className="fas fa-paper-plane"></i>
          </button>
        </div>
        {!isConnected && (
          <p className="text-xs text-red-500 mt-2 text-center">
            <i className="fas fa-exclamation-circle"></i>
            {' '}غير متصل بالدردشة. جاري إعادة المحاولة...
          </p>
        )}
      </div>
    </div>
  );
};

export default Chat;