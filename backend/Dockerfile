# نستخدم صورة Node.js الرسمية والمبسطة (Alpine)
FROM node:18-alpine

# نحدد مجلد العمل داخل الحاوية
WORKDIR /app

# ننسخ ملفات package.json و package-lock.json (إن وجد) لتثبيت الاعتماديات
COPY package*.json ./

# ✅ تثبيت جميع الاعتماديات (بما فيها devDependencies مثل typescript)
RUN npm install --include=dev

# ننسخ باقي ملفات المشروع
COPY . .

# نبني مشروع TypeScript (يولد مجلد dist)
RUN npm run build

# نحدد المنفذ الذي سيعمل عليه التطبيق داخل الحاوية
EXPOSE 5000

# الأمر الذي يشغل التطبيق
CMD ["npm", "start"]