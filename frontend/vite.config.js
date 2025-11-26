import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // 🌟 添加 Proxy 配置来解决 404 API 错误
    proxy: {
      '/api': {
        // 🚨 替换为您后端 API 的实际地址和端口！
        target: 'http://localhost:8000',
        changeOrigin: true, // 开启跨域
        // 如果您的后端路由不带 /api 前缀，则可能需要启用以下路径重写：
        // rewrite: (path) => path.replace(/^\/api/, '')
      },
    },
  },
});