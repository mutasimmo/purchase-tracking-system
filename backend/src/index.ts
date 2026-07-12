// backend/src/index.ts
import './config/env.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import helmet from 'helmet';
import purchaseRoutes from './routes/purchase.routes.js';
import authRoutes from './routes/auth.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initDB, closeDB } from './config/database.js';
import { authenticate } from './middleware/auth.middleware.js';
import { setupSocketHandlers } from './sockets/index.js';
import logger from './config/logger.js';
import { authRateLimiter, registerRateLimiter } from './middleware/auth.middleware.js';
import { globalLimiter, purchaseLimiter } from './middleware/rateLimiter.js';
import { sanitizeInput } from './middleware/sanitize.js';

// ============================================
// 🔧 Load environment variables
// ============================================

dotenv.config();

// ============================================
// 🚀 Server Configuration
// ============================================

const app = express(); // ✅ تعريف app أولاً
const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const httpServer = createServer(app);

// ============================================
// 🛡️ Security Middleware - ✅ بعد تعريف app
// ============================================

app.use(helmet());
app.use(globalLimiter);
app.use(sanitizeInput);

// ============================================
// 💬 Socket.IO Setup with Authentication
// ============================================

const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Setup Socket.IO with authentication
setupSocketHandlers(io);

// ============================================
// 🌐 CORS Configuration
// ============================================

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://purchase-tracking-system-fonf.vercel.app',
  'https://purchase-tracking-system-fonf-git-main-mutasimmos-projects.vercel.app',
  'https://purchase-tracking-system.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn('❌ CORS blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  maxAge: 86400
}));

// ============================================
// 📦 Basic Middleware
// ============================================

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// ============================================
// 🛡️ Rate Limiting
// ============================================

app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', registerRateLimiter);
app.use('/api/purchases', purchaseLimiter);

// ============================================
// 🗺️ Routes
// ============================================

app.use('/api/auth', authRoutes);
app.use('/api/purchases', authenticate, purchaseRoutes);

// ============================================
// 💚 Health Check
// ============================================

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    memory: process.memoryUsage()
  });
});

// ============================================
// 📊 Stats Endpoint (Admin Only)
// ============================================

app.get('/stats', authenticate, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  res.json({
    message: 'Stats endpoint - under development'
  });
});

// ============================================
// ❌ Error Handling
// ============================================

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// 🚀 Start Server
// ============================================

const startServer = async () => {
  try {
    await initDB();
    logger.info('✅ Database initialized successfully');
    
    httpServer.listen(PORT, HOST, () => {
      logger.info(`🚀 Server running on http://${HOST}:${PORT}`);
      logger.info(`📊 API endpoint: http://${HOST}:${PORT}/api/purchases`);
      logger.info(`🔐 Auth endpoint: http://${HOST}:${PORT}/api/auth`);
      logger.info(`💚 Health check: http://${HOST}:${PORT}/health`);
      logger.info(`💬 Socket.io running on ws://${HOST}:${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// ============================================
// 🛑 Graceful Shutdown
// ============================================

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);
  
  try {
    io.close(() => {
      logger.info('Socket.IO closed');
    });
    
    await closeDB();
    logger.info('Database connection closed');
    
    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ============================================
// ❌ Handle Unhandled Errors
// ============================================

process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
  logger.error('Unhandled Rejection at:', {
    promise,
    reason: reason.message,
    stack: reason.stack
  });
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

// ============================================
// 🚀 Start the Server
// ============================================

startServer();

export { app, io, httpServer };