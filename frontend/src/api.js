import axios from 'axios';

// Render 环境变量：必须使用你设置的 VITE_API_BASE_URL
let BASE =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  import.meta.env.VITE_API_BASE?.trim() ||
  '/api'; // fallback（本地代理时用）

// 确保 BASE 以 /api 结尾（如果是完整 URL）
if (BASE && !BASE.endsWith('/api') && !BASE.endsWith('/api/')) {
  // 如果是完整 URL（http:// 或 https://），添加 /api
  if (BASE.startsWith('http://') || BASE.startsWith('https://')) {
    BASE = BASE.replace(/\/$/, '') + '/api';
  }
}

console.log("当前使用后端 API:", BASE);

const api = axios.create({
  baseURL: BASE,
  timeout: 20000
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token.trim()}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器（处理 token 失效）
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      if (
        !url.includes('/auth/login') &&
        !url.includes('/auth/register') &&
        !url.includes('/auth/reset-password')
      ) {
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];

        if (!['/login', '/register', '/forgot-password'].includes(window.location.pathname)) {
          window.dispatchEvent(new CustomEvent('auth-failed'));
        }
      }
    }
    return Promise.reject(error);
  }
);

export function setToken(t) {
  if (t) {
    api.defaults.headers.common['Authorization'] = 'Bearer ' + t;
    localStorage.setItem('token', t);
  } else {
    delete api.defaults.headers.common['Authorization'];
    localStorage.removeItem('token');
  }
}

export default api;
