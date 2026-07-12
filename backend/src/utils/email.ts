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

// ✅ التحقق من الاتصال عند بدء التشغيل
transporter.verify((error, success) => {
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
    
    logger.info(`📧 Email sent to ${to}: ${info.messageId}`);
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
  
  const fullSubject = `🚨 [Alert] ${subject}`;
  const fullMessage = `📅 Time: ${new Date().toISOString()}\n\n${message}`;
  
  await sendEmail(adminEmail, fullSubject, fullMessage);
};

// ✅ إرسال إشعار للمستخدم
export const sendUserNotification = async (
  email: string,
  username: string,
  subject: string,
  message: string
) => {
  const fullSubject = `📋 ${subject}`;
  const fullMessage = `مرحباً ${username},\n\n${message}\n\n--\nنظام متابعة المشتريات`;
  
  await sendEmail(email, fullSubject, fullMessage);
};

// ✅ إرسال إشعار تغيير الحالة
export const sendStatusChangeNotification = async (
  email: string,
  username: string,
  requestNumber: string,
  oldStatus: string,
  newStatus: string
) => {
  const subject = `تغيير حالة الطلب #${requestNumber}`;
  const message = `مرحباً ${username},\n\nتم تغيير حالة الطلب رقم ${requestNumber}\nمن: ${oldStatus}\nإلى: ${newStatus}\n\n--\nنظام متابعة المشتريات`;
  
  await sendEmail(email, subject, message);
};

export default {
  sendEmail,
  sendAlert,
  sendUserNotification,
  sendStatusChangeNotification
};