import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import TemplateList from './pages/TemplateList';
import TemplateDesigner from './pages/TemplateDesigner';
import LaunchFlow from './pages/LaunchFlow';
import TaskTodo from './pages/TaskTodo';
import MyInstances from './pages/MyInstances';
import TaskMonitor from './pages/TaskMonitor';
import UserManagement from './pages/UserManagement';
import Profile from './pages/Profile';
import HrArchive from './pages/HrArchive';
import StandardDocs from './pages/StandardDocs';
import InstanceDetail from './pages/InstanceDetail';
import api, { setToken } from './api';

const AUTH_ROUTES = ['/login', '/register', '/forgot-password'];
const ROLE_TEXT = {
  admin: '系统管理员',
  company_admin: '公司管理员',
  dept_admin: '部门管理员',
  user: '普通用户',
};

const NAV_ITEMS = [
  { to: '/dashboard', label: '仪表盘', icon: '📊' },
  { to: '/launch', label: '发起任务', icon: '🚀' },
  { to: '/tasks/todo', label: '待办任务', icon: '✅' },
  { to: '/instances/mine', label: '我发起的流程', icon: '📁' },
  { to: '/standard-docs', label: '标准文档库', icon: '📚' },
  { to: '/templates', label: '模板管理', icon: '🧱', roles: ['admin', 'company_admin', 'dept_admin'] },
  { to: '/designer', label: '流程设计器', icon: '🎨', roles: ['admin', 'company_admin'] },
  { to: '/task-monitor', label: '流程监控', icon: '📈', roles: ['admin', 'company_admin'] },
  { to: '/user-management', label: '用户管理', icon: '👥', roles: ['admin', 'company_admin'] },
  { to: '/hr-archive', label: '人事档案', icon: '🗂', roles: ['admin', 'company_admin', 'dept_admin'] },
  { to: '/profile', label: '个人中心', icon: '👤' },
];

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const isAuthPage = AUTH_ROUTES.includes(location.pathname);

  const getAvatarUrl = useCallback(
    (avatar) => {
      const fallback = currentUser?.display_name || currentUser?.username || 'User';
      if (!avatar) {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(
          fallback,
        )}&background=3370ff&color=fff&size=200`;
      }
      if (avatar.startsWith('http')) {
        return `${avatar}?t=${Date.now()}`;
      }
      let path = avatar;
      if (!path.startsWith('/api')) {
        path = `/api${path.startsWith('/') ? '' : '/'}${path}`;
      }
      return `${path}?t=${Date.now()}`;
    },
    [currentUser],
  );

  const fetchCurrentUser = useCallback(
    async (silent = false) => {
      const token = localStorage.getItem('token');
      if (!token) {
        setToken(null);
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
        if (!silent) setLoadingUser(false);
        if (!isAuthPage && location.pathname !== '/login') {
          navigate('/login', { replace: true });
        }
        return;
      }
      setToken(token);
      if (!silent) setLoadingUser(true);
      try {
        const res = await api.get('/users/me');
        setCurrentUser(res.data);
        localStorage.setItem('currentUser', JSON.stringify(res.data));
      } catch (error) {
        console.error('加载用户失败', error);
        setCurrentUser(null);
        localStorage.removeItem('currentUser');
        setToken(null);
        localStorage.removeItem('token');
        if (!AUTH_ROUTES.includes(location.pathname)) {
          navigate('/login', { replace: true });
        }
      } finally {
        if (!silent) setLoadingUser(false);
      }
    },
    [isAuthPage, location.pathname, navigate],
  );

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  useEffect(() => {
    const handleAuthSuccess = () => {
      fetchCurrentUser();
      navigate('/dashboard', { replace: true });
    };
    const handleAuthFailed = () => {
      setCurrentUser(null);
      localStorage.removeItem('currentUser');
      navigate('/login', { replace: true });
    };
    const handleUserInfoUpdated = () => fetchCurrentUser(true);

    window.addEventListener('auth-success', handleAuthSuccess);
    window.addEventListener('auth-failed', handleAuthFailed);
    window.addEventListener('user-info-updated', handleUserInfoUpdated);
    return () => {
      window.removeEventListener('auth-success', handleAuthSuccess);
      window.removeEventListener('auth-failed', handleAuthFailed);
      window.removeEventListener('user-info-updated', handleUserInfoUpdated);
    };
  }, [fetchCurrentUser, navigate]);

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
    navigate('/login', { replace: true });
  };

  const navLinks = useMemo(() => {
    return NAV_ITEMS.filter(
      (item) => !item.roles || item.roles.includes(currentUser?.role || 'user'),
    );
  }, [currentUser]);

  const RequireAuth = ({ children }) => {
    if (loadingUser) {
      return <div className="loading">加载中...</div>;
    }
    if (!currentUser) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  if (isAuthPage) {
    return (
      <Routes>
        <Route
          path="/login"
          element={currentUser ? <Navigate to="/dashboard" replace /> : <Login />}
        />
        <Route
          path="/register"
          element={currentUser ? <Navigate to="/dashboard" replace /> : <Register />}
        />
        <Route
          path="/forgot-password"
          element={currentUser ? <Navigate to="/dashboard" replace /> : <ForgotPassword />}
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  if (loadingUser && !currentUser) {
    return <div className="loading">加载用户信息...</div>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img src="/logo192.png" alt="logo" className="sidebar-logo" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>嘉翎创联</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Workflow 平台</div>
            </div>
          </div>
        </div>

        <div style={{ padding: 16, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <img
              src={getAvatarUrl(currentUser?.avatar)}
              alt="avatar"
              style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }}
            />
            <div>
              <div style={{ fontWeight: 600 }}>{currentUser?.display_name || currentUser?.username}</div>
              <div className="hint" style={{ fontSize: 12 }}>
                {ROLE_TEXT[currentUser?.role] || '普通用户'}
              </div>
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navLinks.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              <span style={{ marginRight: 10 }}>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="btn secondary" style={{ width: '100%' }} onClick={handleLogout}>
            退出登录
          </button>
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route
            path="/dashboard"
            element={
              <RequireAuth>
                <Dashboard />
              </RequireAuth>
            }
          />
          <Route
            path="/templates"
            element={
              <RequireAuth>
                <TemplateList />
              </RequireAuth>
            }
          />
          <Route
            path="/designer"
            element={
              <RequireAuth>
                <TemplateDesigner />
              </RequireAuth>
            }
          />
          <Route
            path="/launch"
            element={
              <RequireAuth>
                <LaunchFlow />
              </RequireAuth>
            }
          />
          <Route
            path="/tasks/todo"
            element={
              <RequireAuth>
                <TaskTodo />
              </RequireAuth>
            }
          />
          <Route
            path="/instances/mine"
            element={
              <RequireAuth>
                <MyInstances />
              </RequireAuth>
            }
          />
          <Route
            path="/task-monitor"
            element={
              <RequireAuth>
                {['admin', 'company_admin'].includes(currentUser?.role) ? (
                  <TaskMonitor />
                ) : (
                  <Navigate to="/dashboard" replace />
                )}
              </RequireAuth>
            }
          />
          <Route
            path="/user-management"
            element={
              <RequireAuth>
                {['admin', 'company_admin'].includes(currentUser?.role) ? (
                  <UserManagement />
                ) : (
                  <Navigate to="/dashboard" replace />
                )}
              </RequireAuth>
            }
          />
          <Route
            path="/hr-archive"
            element={
              <RequireAuth>
                {['admin', 'company_admin', 'dept_admin'].includes(currentUser?.role) ? (
                  <HrArchive />
                ) : (
                  <Navigate to="/dashboard" replace />
                )}
              </RequireAuth>
            }
          />
          <Route
            path="/standard-docs"
            element={
              <RequireAuth>
                <StandardDocs />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <Profile />
              </RequireAuth>
            }
          />
          <Route
            path="/instances/:instanceId"
            element={
              <RequireAuth>
                <InstanceDetail />
              </RequireAuth>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
