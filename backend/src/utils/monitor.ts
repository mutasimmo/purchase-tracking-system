// backend/src/utils/monitor.ts
import { getDB } from '../config/database.js';
import { sendAlert } from './email.js';
import cron from 'node-cron';
import logger from '../config/logger.js';

export const checkHealth = async () => {
  try {
    // ✅ فحص قاعدة البيانات
    const db = await getDB();
    await db.get('SELECT 1');
    
    // ✅ فحص الذاكرة
    const memory = process.memoryUsage();
    const memoryUsagePercent = (memory.heapUsed / memory.heapTotal) * 100;
    
    if (memoryUsagePercent > 90) {
      await sendAlert(
        '⚠️ تحذير: الذاكرة ممتلئة',
        `الذاكرة المستخدمة: ${Math.round(memoryUsagePercent)}%\n` +
        `heapUsed: ${Math.round(memory.heapUsed / 1024 / 1024)} MB\n` +
        `heapTotal: ${Math.round(memory.heapTotal / 1024 / 1024)} MB`
      );
      logger.warn('⚠️ Memory usage high:', { memoryUsagePercent });
    }
    
    // ✅ فحص وقت الاستجابة
    const start = Date.now();
    await db.get('SELECT 1');
    const responseTime = Date.now() - start;
    
    if (responseTime > 1000) {
      logger.warn('⚠️ Slow response time:', { responseTime });
    }
    
    return {
      status: 'healthy',
      memory: memoryUsagePercent,
      responseTime,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    logger.error('❌ Health check failed:', error);
    await sendAlert('🚨 خطأ في فحص الصحة', error instanceof Error ? error.message : 'Unknown error');
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    };
  }
};

// ✅ جدولة فحص الصحة كل 5 دقائق
cron.schedule('*/5 * * * *', async () => {
  await checkHealth();
});

// ✅ فحص الصحة عند بدء التشغيل
checkHealth();

export default { checkHealth };