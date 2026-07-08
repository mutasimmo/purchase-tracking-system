import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

interface Message {
  user: string;
  text: string;
  time: string;
  isSystem?: boolean;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);

  const ROOM = 'general';

  useEffect(() => {
    // ✅ استخدام الرابط الصحيح
    const socketUrl = 'https://purchase-backend-lmsm.onrender.com';
    console.log('🔌 Connecting to socket:', socketUrl);
    
    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('✅ Connected to chat server');
      console.log('🆔 Socket ID:', newSocket.id);
      setIsConnected(true);
      
      // تسجيل المستخدم
      if (user) {
        newSocket.emit('register-user', user.full_name || user.username);
      }
      
      newSocket.emit('join-room', ROOM);
      
      setMessages(prev => [...prev, {
        user: 'system',
        text: '🔗 تم الاتصال بالدردشة',
        time: new Date().toISOString(),
        isSystem: true
      }]);
    });

    newSocket.on('message', (message: Message) => {
      console.log('📩 New message:', message);
      setMessages(prev => [...prev, message]);
    });

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

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from chat server');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setIsConnected(false);
    });

    return () => {
      newSocket.emit('leave-room', ROOM);
      newSocket.disconnect();
    };
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !socket || !user || !isConnected) return;

    const messageData = {
      room: ROOM,
      user: user.full_name || user.username,
      text: inputMessage.trim()
    };

    console.log('📤 Sending message:', messageData);
    socket.emit('send-message', messageData);
    setInputMessage('');
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    socket.emit('typing', { room: ROOM, user: user.full_name || user.username, isTyping: false });
  };

  const handleTyping = () => {
    if (!socket || !user || !isConnected) return;

    if (!typingTimeoutRef.current) {
      socket.emit('typing', { room: ROOM, user: user.full_name || user.username, isTyping: true });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
      socket.emit('typing', { room: ROOM, user: user.full_name || user.username, isTyping: false });
    }, 2000);
  };

  const formatTime = (time: string) => {
    return new Date(time).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
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

      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 min-h-[400px] max-h-[500px]">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 mt-20">
            <i className="fas fa-comments text-4xl mb-4 block"></i>
            <p>لا توجد رسائل بعد</p>
            <p className="text-sm">كن أول من يكتب!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`mb-3 ${msg.isSystem ? 'text-center' : ''}`}>
              {msg.isSystem ? (
                <div className="text-xs text-gray-400 bg-gray-200/50 rounded-full px-4 py-1 inline-block">
                  {msg.text}
                </div>
              ) : (
                <div className={`flex ${msg.user === (user?.full_name || user?.username) ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] ${msg.user === (user?.full_name || user?.username) ? 'bg-purple-500 text-white' : 'bg-white border border-gray-200'} rounded-2xl px-4 py-2 shadow-sm`}>
                    <div className={`text-xs font-semibold ${msg.user === (user?.full_name || user?.username) ? 'text-purple-200' : 'text-purple-600'} mb-0.5`}>
                      {msg.user}
                    </div>
                    <div className="text-sm break-words">{msg.text}</div>
                    <div className={`text-[10px] mt-1 ${msg.user === (user?.full_name || user?.username) ? 'text-purple-200/70' : 'text-gray-400'}`}>
                      {formatTime(msg.time)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {typingUsers.length > 0 && (
          <div className="text-xs text-gray-400 italic">
            {typingUsers.join(', ')} يكتب...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => {
              setInputMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && isConnected) {
                sendMessage();
              }
            }}
            placeholder="اكتب رسالتك..."
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
      </div>
    </div>
  );
};

export default Chat;