// backend/src/index.ts
import './config/env.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import purchaseRoutes from './routes/purchase.routes.js';
import authRoutes from './routes/auth.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { initDB, closeDB } from './config/database.js';
import { authenticate } from './middleware/auth.middleware.js';
import { setupSocketHandlers } from './sockets/index.js';
import logger from './config/logger.js';
import { authRateLimiter, registerRateLimiter } from './middleware/auth.middleware.js';
import { runMigrations } from './migrations/index.js';
import { scheduleBackup, createBackup } from './utils/backup.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '5000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

setupSocketHandlers(io);

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

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/register', registerRateLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/purchases', authenticate, purchaseRoutes);

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    memory: process.memoryUsage()
  });
});

app.get('/stats', authenticate, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  res.json({ message: 'Stats endpoint - under development' });
});

app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// 🚀 Start Server with Migrations and Backup
// ============================================

const startServer = async () => {
  try {
    // ✅ Initialize database
    await initDB();
    logger.info('✅ Database initialized successfully');
    
    // ✅ Run migrations
    await runMigrations();
    logger.info('✅ Migrations completed successfully');
    
    // ✅ Create initial backup
    await createBackup();
    logger.info('✅ Initial backup created');
    
    // ✅ Schedule automatic backups
    scheduleBackup();
    logger.info('✅ Backup scheduler started');
    
    // ✅ Start HTTP server
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
    // Close Socket.IO
    io.close(() => { 
      logger.info('Socket.IO closed'); 
    });
    
    // Close database connection
    await closeDB();
    logger.info('Database connection closed');
    
    // Create final backup before shutdown
    await createBackup();
    logger.info('✅ Final backup created');
    
    // Close HTTP server
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