import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Register(){
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function doRegister(e){
    e && e.preventDefault();
    setError('');
    
    if(!username || username.length < 3) {
      setError('用户名至少需要3个字符');
      return;
    }
    
    if(!password || password.length < 6) {
      setError('密码至少需要6个字符');
      return;
    }
    
    setLoading(true);
    
    try{
      await api.post('/auth/register', {
        username,
        password
      });
      alert('注册成功！请登录');
      navigate('/login', { replace: true });
    }catch(err){
      setError(err?.response?.data?.detail || err.message || '注册失败');
    } finally {
      setLoading(false);
    }
  }
  
  return (
    <div className="login-container">
      <div className="login-card">
        <h2>创建账户</h2>
        <p className="subtitle">注册新账户以使用工作流平台</p>
        <form onSubmit={doRegister}>
          <div className="form-row">
            <label>用户名 *</label>
            <input 
              className="input" 
              value={username} 
              onChange={e=>setUsername(e.target.value)}
              placeholder="请输入用户名（至少3个字符）"
              required
              disabled={loading}
              minLength={3}
            />
          </div>
          <div className="form-row">
            <label>密码 *</label>
            <input 
              type="password" 
              className="input" 
              value={password} 
              onChange={e=>setPassword(e.target.value)}
              placeholder="请输入密码（至少6个字符）"
              required
              disabled={loading}
              minLength={6}
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
            {loading ? '注册中...' : '注册'}
          </button>
          <div style={{textAlign: 'center', marginTop: '16px'}}>
            <Link to="/login" style={{color: 'var(--primary)', fontSize: '14px'}}>
              已有账户？立即登录
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

