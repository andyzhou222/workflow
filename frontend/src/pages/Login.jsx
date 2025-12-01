import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api, { setToken } from '../api';

export default function Login(){
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function doLogin(e){
    e && e.preventDefault();
    setError('');
    setLoading(true);

    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    try{
      const r = await api.post('/auth/login', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
      const token = r.data.access_token || r.data.token;
      if(!token) throw new Error('no token');
      setToken(token);
      window.dispatchEvent(new CustomEvent('auth-success'));
      navigate('/dashboard', { replace: true });
    }catch(err){
      setError(err?.response?.data?.detail || err.message || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>欢迎回来</h2>
        <p className="subtitle">登录以继续使用工作流平台</p>
        <form onSubmit={doLogin}>
      <div className="form-row">
            <label>用户名</label>
            <input
              className="input"
              value={username}
              onChange={e=>setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
              disabled={loading}
            />
      </div>
      <div className="form-row">
            <label>密码</label>
            <input
              type="password"
              className="input"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="请输入密码"
              required
              disabled={loading}
            />
          </div>
          {error && (
            <div style={{
              padding: '12px',
              background: '#fff4f4',
              border: '1px solid #ffccc7',
              borderRadius: '6px',
              color: '#f53f3f',
              fontSize: '13px',
              marginBottom: '16px'
            }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            className="btn"
            style={{width: '100%', marginTop: '8px'}}
            disabled={loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>
          <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '16px', fontSize: '14px'}}>
            <Link to="/forgot-password" style={{color: 'var(--primary)'}}>
              忘记密码？
            </Link>
            <Link to="/register" style={{color: 'var(--primary)'}}>
              注册新账户
            </Link>
      </div>
        </form>
      </div>
    </div>
  );
}
