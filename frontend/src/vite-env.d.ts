// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  // ✅ API
  readonly VITE_API_URL: string;
  
  // ✅ Application
  readonly VITE_APP_TITLE: string;
  readonly VITE_APP_VERSION: string;
  
  // ✅ Environment
  readonly VITE_NODE_ENV: 'development' | 'production' | 'test';
  
  // ✅ Features (اختياري)
  readonly VITE_ENABLE_CHAT: string;
  readonly VITE_ENABLE_AUDIT_LOG: string;
  
  // ✅ External Services (اختياري)
  readonly VITE_SOCKET_URL: string;
  readonly VITE_WEBSOCKET_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// ✅ إعلان للمتغيرات العامة (اختياري)
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }
}

// ✅ لمنع الأخطاء إذا لم يتم التعرف على المتغيرات
declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

export {};