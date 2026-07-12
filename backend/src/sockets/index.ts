// src/sockets/index.ts
import { Server, Socket } from 'socket.io';
import { verifyToken } from '../config/auth.js';
import { getDB } from '../config/database.js';
import logger from '../config/logger.js';

// ============================================
// Socket Authentication
// ============================================

export const socketAuth = (socket: Socket, next: (err?: Error) => void) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication required'));
    }

    const verification = verifyToken(token);
    if (!verification.valid) {
      return next(new Error(verification.error || 'Invalid token'));
    }

    socket.data.user = verification.data;
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Socket authentication error:', errorMessage);
    next(new Error('Authentication failed'));
  }
};

// ============================================
// Online Users Storage
// ============================================

interface OnlineUser {
  userId: number;
  username: string;
  socketId: string;
  joinedAt: string;
}

const onlineUsers = new Map<string, OnlineUser>();
const userSessions = new Map<number, Set<string>>();

// ============================================
// Setup Socket Handlers - ✅ EXPORTED
// ============================================

export const setupSocketHandlers = (io: Server) => {
  // Use authentication
  io.use(socketAuth);

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    const userId = user.id;
    const username = user.username;

    logger.info(`User connected: ${username} (${userId}) - Socket: ${socket.id}`);

    // Register online user
    onlineUsers.set(socket.id, {
      userId,
      username,
      socketId: socket.id,
      joinedAt: new Date().toISOString()
    });

    if (!userSessions.has(userId)) {
      userSessions.set(userId, new Set());
    }
    userSessions.get(userId)?.add(socket.id);

    io.emit('online-users', getOnlineUsersList());

    // Join room
    socket.on('join-room', async (room: string) => {
      try {
        if (!room || typeof room !== 'string' || room.length > 50) {
          return socket.emit('error', { message: 'Invalid room name' });
        }

        socket.join(room);
        logger.info(`${username} joined room: ${room}`);

        const db = await getDB();
        await db.run(
          `INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, changes, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [userId, username, 'JOIN_ROOM', 'chat', null, JSON.stringify({ room }), socket.handshake.address, socket.handshake.headers['user-agent']]
        );

        io.to(room).emit('message', {
          user: 'system',
          text: `👋 ${username} joined the chat`,
          time: new Date().toISOString(),
          isSystem: true
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Join room error:', errorMessage);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // Leave room
    socket.on('leave-room', (room: string) => {
      try {
        if (!room || typeof room !== 'string') {
          return socket.emit('error', { message: 'Invalid room name' });
        }
        socket.leave(room);
        logger.info(`${username} left room: ${room}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Leave room error:', errorMessage);
        socket.emit('error', { message: 'Failed to leave room' });
      }
    });

    // Receive message
    socket.on('send-message', async (data: { room: string; text: string }) => {
      try {
        if (!data.room || !data.text) {
          return socket.emit('error', { message: 'Room and text are required' });
        }

        if (data.text.length > 1000) {
          return socket.emit('error', { message: 'Message too long (max 1000 characters)' });
        }

        logger.info(`Message from ${username} in ${data.room}: ${data.text.substring(0, 50)}...`);

        io.to(data.room).emit('message', {
          user: username,
          text: data.text,
          time: new Date().toISOString(),
          userId: userId,
          isSystem: false
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Send message error:', errorMessage);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing Indicator
    socket.on('typing', (data: { room: string; isTyping: boolean }) => {
      try {
        if (!data.room) return;
        socket.to(data.room).emit('typing', {
          user: username,
          isTyping: data.isTyping
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Typing indicator error:', errorMessage);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      logger.info(`User disconnected: ${username} (${userId}) - Socket: ${socket.id}`);

      onlineUsers.delete(socket.id);
      userSessions.get(userId)?.delete(socket.id);
      
      if (userSessions.get(userId)?.size === 0) {
        userSessions.delete(userId);
      }

      io.emit('online-users', getOnlineUsersList());

      io.emit('message', {
        user: 'system',
        text: `👋 ${username} left the chat`,
        time: new Date().toISOString(),
        isSystem: true
      });

      try {
        const db = await getDB();
        await db.run(
          `INSERT INTO audit_log (user_id, username, action, entity_type, changes, ip_address, user_agent)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [userId, username, 'DISCONNECT', 'chat', JSON.stringify({ socketId: socket.id }), socket.handshake.address, socket.handshake.headers['user-agent']]
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Failed to log disconnect:', errorMessage);
      }
    });

    // Error handling
    socket.on('error', (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Socket error for ${username}:`, errorMessage);
      socket.emit('error', { message: 'An error occurred' });
    });
  });

  // Helper function to get online users list
  function getOnlineUsersList(): OnlineUser[] {
    return Array.from(onlineUsers.values());
  }
};

// ============================================
// Additional control functions
// ============================================

export const getOnlineUsers = (): OnlineUser[] => {
  return Array.from(onlineUsers.values());
};

export const getUserSessions = (userId: number): string[] => {
  return Array.from(userSessions.get(userId) || []);
};

export const isUserOnline = (userId: number): boolean => {
  return userSessions.has(userId) && (userSessions.get(userId)?.size || 0) > 0;
};

// ============================================
// Export default
// ============================================

export default {
  setupSocketHandlers,
  getOnlineUsers,
  getUserSessions,
  isUserOnline
};