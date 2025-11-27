import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, useNavigate, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import TemplateList from './pages/TemplateList';
import TemplateDesigner from './pages/TemplateDesigner';
import LaunchFlow from './pages/LaunchFlow';
import TaskTodo from './pages/TaskTodo';
import MyInstances from './pages/MyInstances';
import InstanceDetail from './pages/InstanceDetail';
import Profile from './pages/Profile';
import UserManagement from './pages/UserManagement';
import api, { setToken } from './api';

const API_BASE = (import.meta.env.VITE_API_BASE || '').trim();
const API_ORIGIN = API_BASE.replace(/\/api\/?$/, '');

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [logoOk, setLogoOk] = useState(true);
  const nav = useNavigate();
  const location = useLocation();

  const authPages = ['/login', '/register', '/forgot-password'];
  const isAuthPage = authPages.includes(location.pathname);

  async function loadCurrentUser() {
    try {
      const r = await api.get('/users/me');
      setCurrentUser(r.data);
      setIsAuthenticated(true);
    } catch (e) {
      setCurrentUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsChecking(false);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setToken(token);
      loadCurrentUser();
    } else {
      setIsChecking(false);
      setIsAuthenticated(false);
      if (!isAuthPage) {
        nav('/login', { replace: true });
      }
    }
    // 监听登录成功/失败事件
    const onAuthSuccess = () => {
      setIsChecking(true);
      loadCurrentUser().then(() => {
        nav('/dashboard', { replace: true });
      });
    };
    const onAuthFailed = () => {
      setToken(null);
      setCurrentUser(null);
      setIsAuthenticated(false);
      nav('/login', { replace: true });
    };
    const onUserInfoUpdated = () => {
      if (localStorage.getItem('token')) {
        loadCurrentUser();
      }
    };
    window.addEventListener('auth-success', onAuthSuccess);
    window.addEventListener('auth-failed', onAuthFailed);
    window.addEventListener('user-info-updated', onUserInfoUpdated);
    return () => {
      window.removeEventListener('auth-success', onAuthSuccess);
      window.removeEventListener('auth-failed', onAuthFailed);
      window.removeEventListener('user-info-updated', onUserInfoUpdated);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isChecking && !isAuthenticated && !isAuthPage) {
      nav('/login', { replace: true });
    }
  }, [isChecking, isAuthenticated, isAuthPage, nav]);

  if (isChecking && !isAuthPage) {
    return <div className="loading">正在检查登录状态...</div>;
  }

  if (isAuthPage) {
    return (
      <Routes>
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/register"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Register />}
        />
        <Route
          path="/forgot-password"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPassword />}
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'dept_admin';

  const logoSrc = logoOk ? '/logo.png' : '';

  // 生成头像URL
  const getAvatarUrl = (avatar) => {
    if (!avatar) return null;
    // 如果已经是完整 URL，直接返回
    if (avatar.startsWith('http')) {
      return `${avatar}?t=${Date.now()}`;
    }
    // 后端返回的格式是 /api/uploads/avatars/xxx.jpg
    // 需要转换为完整后端 URL
    let path = avatar;
    // 如果路径以 /api 开头，去掉 /api，因为我们要拼接完整的后端域名
    if (path.startsWith('/api')) {
      path = path.replace(/^\/api/, '');
    }
    // 确保路径以 / 开头
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    // 如果有 API_ORIGIN，使用完整URL；否则使用 /api 前缀（通过前端代理）
    if (API_ORIGIN) {
      return `${API_ORIGIN}${path}?t=${Date.now()}`;
    } else {
      // 如果没有配置 API_ORIGIN，使用 /api 前缀（通过 Vercel/Render 代理）
      return `/api${path}?t=${Date.now()}`;
    }
  };

  return (
    <div className="app-shell">
      <div className="sidebar card">
        <div className="sidebar-header" style={{ justifyContent: 'center', padding: '24px 16px', marginBottom: '8px' }}>
          {logoSrc ? (
            <img
              src={logoSrc}
              alt="Logo"
              style={{ width: '100px', height: '100px', borderRadius: '12px', objectFit: 'contain' }}
              onError={() => setLogoOk(false)}
            />
          ) : (
            <div className="logo-fallback" style={{ width: '100px', height: '100px', fontSize: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', background: 'var(--primary)', color: 'white', fontWeight: 'bold' }}>WF</div>
          )}
        </div>

        <nav className="sidebar-nav" style={{ padding: '0 12px' }}>
          <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span>📊 仪表盘</span>
          </NavLink>
          <NavLink to="/launch" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span>📝 发起签审</span>
          </NavLink>
          <NavLink to="/tasks/todo" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span>✅ 待办任务</span>
          </NavLink>
          <NavLink to="/my-instances" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span>📂 我发起的流程</span>
          </NavLink>
          <div className="nav-section-title" style={{ marginTop: '12px', marginBottom: '8px' }}>流程配置</div>
          <NavLink to="/templates" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span>📄 模板管理</span>
          </NavLink>
          <NavLink to="/designer" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            <span>🧩 流程设计器</span>
          </NavLink>
          {isAdmin && (
            <>
              <div className="nav-section-title" style={{ marginTop: '12px', marginBottom: '8px' }}>系统管理</div>
              <NavLink to="/users" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                <span>👥 用户管理</span>
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer" style={{ padding: '12px', marginTop: 'auto' }}>
          <div
            style={{
              padding: '12px',
              marginBottom: '12px',
              background: 'var(--bg)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => nav('/profile')}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--primary-light)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bg)')}
          >
            <img
              src={
                currentUser?.avatar
                  ? getAvatarUrl(currentUser.avatar) || `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      currentUser?.username || 'User'
                    )}&background=3370ff&color=fff&size=64`
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      currentUser?.username || 'User'
                    )}&background=3370ff&color=fff&size=64`
              }
              alt="头像"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '2px solid var(--border)',
                flexShrink: 0
              }}
              onError={(e) => {
                e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  currentUser?.username || 'User'
                )}&background=3370ff&color=fff&size=64`;
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: '1.4'
                }}
              >
                {currentUser?.display_name || currentUser?.username || '用户'}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: '1.4'
                }}
              >
                @{currentUser?.username || ''}
              </div>
            </div>
            <button
              className="btn small secondary"
              style={{ flexShrink: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                nav('/profile');
              }}
            >
              ⚙️
            </button>
          </div>
          <button
            className="btn secondary"
            style={{ width: '100%' }}
            onClick={() => {
              localStorage.removeItem('token');
              setToken(null);
              setIsAuthenticated(false);
              setCurrentUser(null);
              nav('/login', { replace: true });
            }}
          >
            退出登录
          </button>
        </div>
      </div>
      <div className="main card">
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/launch" element={<LaunchFlow />} />
          <Route path="/tasks/todo" element={<TaskTodo />} />
          <Route path="/my-instances" element={<MyInstances />} />
          <Route path="/instances/:id" element={<InstanceDetail />} />
          <Route path="/templates" element={<TemplateList />} />
          <Route path="/designer" element={<TemplateDesigner />} />
          <Route path="/users" element={isAdmin ? <UserManagement /> : <Navigate to="/dashboard" replace />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  );
}
