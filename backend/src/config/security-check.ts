// src/config/security-check.ts
import fs from 'fs';
import logger from './logger.js';

export const securityCheck = (): string[] => {
  const warnings: string[] = [];
  
  // Check JWT_SECRET
  if (!process.env.JWT_SECRET) {
    warnings.push('⚠️ JWT_SECRET is not set!');
  } else if (process.env.JWT_SECRET.length < 32) {
    warnings.push('⚠️ JWT_SECRET is too short (minimum 32 characters recommended)');
  }
  
  // Check for default/weak passwords in production
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.DEFAULT_ADMIN_PASSWORD || process.env.DEFAULT_ADMIN_PASSWORD === 'Admin@2024#Secure!') {
      warnings.push('⚠️ DEFAULT_ADMIN_PASSWORD is using a weak/default password in production!');
    }
    
    if (!process.env.DEFAULT_MUTASIM_PASSWORD || process.env.DEFAULT_MUTASIM_PASSWORD === 'Asmo@1985#Strong!') {
      warnings.push('⚠️ DEFAULT_MUTASIM_PASSWORD is using a weak/default password in production!');
    }
    
    // Check for .env file
    if (!fs.existsSync('.env')) {
      warnings.push('⚠️ .env file not found in production!');
    }
    
    // Check for HTTPS in production
    if (process.env.FRONTEND_URL && !process.env.FRONTEND_URL.startsWith('https://')) {
      warnings.push('⚠️ FRONTEND_URL should use HTTPS in production');
    }
    
    // Check for secure cookie settings
    if (!process.env.COOKIE_SECURE || process.env.COOKIE_SECURE !== 'true') {
      warnings.push('⚠️ COOKIE_SECURE should be "true" in production');
    }
  }
  
  // Check if running in development mode with production-like settings
  if (process.env.NODE_ENV === 'development') {
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length > 50) {
      logger.info('✅ JWT_SECRET looks strong');
    }
  }
  
  if (warnings.length > 0) {
    logger.warn('🔒 Security Check Results:');
    warnings.forEach(w => logger.warn(`   ${w}`));
    
    if (process.env.NODE_ENV === 'production') {
      logger.error('❌ Security check failed in production!');
      // Uncomment to exit in production
      // process.exit(1);
    }
  } else {
    logger.info('✅ Security check passed');
  }
  
  return warnings;
};

export default { securityCheck };