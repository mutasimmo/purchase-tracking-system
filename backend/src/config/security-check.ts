// src/config/security-check.ts
import logger from './logger.js';
import dotenv from 'dotenv';

dotenv.config();

// ============================================
// 🔒 Security Check
// ============================================

export const checkSecurity = () => {
  const warnings: string[] = [];
  const errors: string[] = [];

  // ✅ Check JWT Secret
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }

  // ✅ Check Supabase credentials
  if (!process.env.SUPABASE_URL) {
    errors.push('SUPABASE_URL is required');
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    errors.push('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  // ✅ Check environment
  if (process.env.NODE_ENV === 'production') {
    // Production security checks
    if (process.env.COOKIE_SECURE !== 'true') {
      warnings.push('COOKIE_SECURE should be true in production');
    }

    if (!process.env.SUPABASE_URL?.startsWith('https://')) {
      warnings.push('SUPABASE_URL should use HTTPS in production');
    }
  }

  // ✅ Check default passwords
  if (process.env.DEFAULT_ADMIN_PASSWORD === 'Admin@2024#Secure!NEW') {
    warnings.push('DEFAULT_ADMIN_PASSWORD uses default value. Please change it!');
  }

  // ✅ Log results
  if (errors.length > 0) {
    logger.error('❌ Security check failed:');
    errors.forEach(err => logger.error(`  - ${err}`));
    process.exit(1);
  }

  if (warnings.length > 0) {
    logger.warn('⚠️ Security warnings:');
    warnings.forEach(warn => logger.warn(`  - ${warn}`));
  }

  logger.info('✅ Security check passed');
  return { errors, warnings };
};

// ============================================
// 🏃 Run security check
// ============================================

if (process.env.NODE_ENV !== 'test') {
  checkSecurity();
}

export default {
  checkSecurity
};