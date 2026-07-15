// src/config/env.ts
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تحميل .env من المجلد الرئيسي
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ============================================
// ✅ التحقق من المتغيرات المطلوبة
// ============================================

const requiredEnvVars = [
  'JWT_SECRET',
  'PORT',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const missingVars: string[] = [];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    missingVars.push(envVar);
  }
}

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.error(`  - ${varName}`));
  console.error('Please add them to your .env file');
  process.exit(1);
}

// ============================================
// ✅ التحقق من صحة المتغيرات
// ============================================

// Check Supabase URL format
const supabaseUrl = process.env.SUPABASE_URL;
if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
  console.warn('⚠️ SUPABASE_URL should use HTTPS');
}

// Check JWT Secret length
const jwtSecret = process.env.JWT_SECRET;
if (jwtSecret && jwtSecret.length < 32) {
  console.warn('⚠️ JWT_SECRET should be at least 32 characters long');
}

console.log('✅ Environment variables loaded successfully');

export default process.env;