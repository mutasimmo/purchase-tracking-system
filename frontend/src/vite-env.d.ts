/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    // أضف أي متغيرات بيئة أخرى هنا
  }
  
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }