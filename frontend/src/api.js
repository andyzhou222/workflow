import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE || '/api';
const api = axios.create({ baseURL: BASE, timeout: 20000 });

// 添加请求拦截器
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      // 确保 token 格式正确
      const cleanToken = token.trim();
      config.headers.Authorization = `Bearer ${cleanToken}`;
    }
    // 调试：打印请求信息
    if (process.env.NODE_ENV === 'development') {
      console.log('API Request:', config.method?.toUpperCase(), config.url, {
        hasToken: !!token,
        headers: config.headers
      });
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 添加响应拦截器处理 token 过期
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 排除登录、注册、重置密码接口的 401 错误
      const url = error.config?.url || '';
      if (!url.includes('/auth/login') && 
          !url.includes('/auth/register') && 
          !url.includes('/auth/reset-password')) {
        // Token 无效或过期，清除并跳转到登录页
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        // 使用 React Router 的导航而不是 window.location，避免页面刷新
        if (!['/login', '/register', '/forgot-password'].includes(window.location.pathname)) {
          // 触发自定义事件，让 App 组件处理跳转
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
