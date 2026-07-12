// backend/src/utils/email.ts
import nodemailer from 'nodemailer';
import logger from '../config/logger.js';

// ✅ إنشاء transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// ✅ التحقق من الاتصال
transporter.verify((error: Error | null, success: boolean) => {
  if (error) {
    logger.error('❌ Email transporter error:', error);
  } else {
    logger.info('✅ Email transporter ready');
  }
});

// ✅ إرسال بريد إلكتروني
export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html?: string
) => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to,
      subject,
      text,
      html: html || text.replace(/\n/g, '<br>')
    });
    
    logger.info(`📧 Email sent to ${to}`);
    return info;
  } catch (error) {
    logger.error('❌ Email send error:', error);
    throw error;
  }
};

// ✅ إرسال تنبيه للمسؤول
export const sendAlert = async (subject: string, message: string) => {
  const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
  
  if (!adminEmail) {
    logger.warn('⚠️ No admin email configured');
    return;
  }
  
  await sendEmail(adminEmail, `🚨 ${subject}`, message);
};

export default {
  sendEmail,
  sendAlert
};