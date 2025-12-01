import React, { useEffect } from 'react';
import { Routes, Route, Link, useNavigate, Navigate, useLocation } from 'react-router-dom'; // 导入 useLocation
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TemplateList from './pages/TemplateList';
import TemplateDesigner from './pages/TemplateDesigner';
import { setToken } from './api';

export default function App(){
  const nav = useNavigate();
  const location = useLocation(); // 🌟 关键：使用 useLocation 钩子获取当前路径对象

  useEffect(()=>{
    const t = localStorage.getItem('token');
    if(t) setToken(t);

    // 检查 token。如果不存在 token 且当前路径不是 '/login'，则跳转到登录页。
    // 使用 location.pathname 代替全局 location.pathname，更符合 React Router 规范。
    if(!t && location.pathname !== '/login') {
      console.log('Token missing, redirecting to /login');
      nav('/login', { replace: true });
    }
  }, [location.pathname]); // 依赖中添加 location.pathname 确保路径变化时重新检查

  return (
    <div className="app-shell">
      <div className="sidebar card">
        <h3>Workflow</h3>
        <nav>
          <div><Link to="/dashboard">Dashboard</Link></div>
          <div><Link to="/templates">Templates</Link></div>
          <div><Link to="/designer">Designer</Link></div>
        </nav>
        <div style={{marginTop:'auto'}}>
          <button className="btn" onClick={()=>{
            localStorage.removeItem('token'); setToken(null); window.location.href='/login';
          }}>Logout</button>
        </div>
      </div>
      <div className="main card">
        <Routes>
          <Route path="/login" element={<Login/>} />
          <Route path="/dashboard" element={<Dashboard/>} />
          <Route path="/templates" element={<TemplateList/>} />
          <Route path="/designer" element={<TemplateDesigner/>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </div>
    </div>
  )
}