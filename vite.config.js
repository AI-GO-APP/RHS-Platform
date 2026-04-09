import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

// 「示範包租代管」— Vite MPA 多頁面應用配置
export default defineConfig(({ mode }) => {
  // 載入 .env 檔案（供 server.proxy 使用）
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: './',
    publicDir: 'public',
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          landlordService: resolve(__dirname, 'landlord-service.html'),
          tenantListing: resolve(__dirname, 'tenant-listing.html'),
          tenantDetail: resolve(__dirname, 'tenant-detail.html'),
          tenantPortal: resolve(__dirname, 'tenant-portal.html'),
          login: resolve(__dirname, 'login.html'),
        },
      },
    },
    server: {
      port: 5181, // 避免與其他專案衝突
      open: true,
      proxy: {
        // ── 中轉 Open Proxy（API Key 由伺服器側注入，前端不可見）──
        '/api/open': {
          target: 'https://ai-go.app/api/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/open/, '/open'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('X-API-Key', env.AIGO_API_KEY);
            });
          },
        },
        // ── 中轉 Ext Proxy（前端自行帶 Bearer Token，直接透傳）──
        '/api/ext': {
          target: 'https://ai-go.app/api/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ext/, '/ext'),
        },
        // ── 中轉 Custom App Auth（公開端點，直接透傳）──
        '/api/custom-app-auth': {
          target: 'https://ai-go.app/api/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  };
});
