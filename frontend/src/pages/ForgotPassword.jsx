import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function ForgotPassword(){
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  async function doReset(e){
    e && e.preventDefault();
    setError('');
    
    if(!username) {
      setError('请输入用户名');
      return;
    }
    
    setLoading(true);
    
    try{
      const r = await api.post('/auth/reset-password', {
        username
      });
      setSuccess(true);
      setTimeout(() => {
        navigate('/login', { replace: true });
      }, 3000);
    }catch(err){
      setError(err?.response?.data?.detail || err.message || '重置密码失败');
    } finally {
      setLoading(false);
    }
  }
  
  if(success) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div style={{textAlign: 'center'}}>
            <div style={{fontSize: '48px', marginBottom: '16px'}}>✅</div>
            <h2>密码重置成功</h2>
            <p className="subtitle">正在跳转到登录页面...</p>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="login-container">
      <div className="login-card">
        <h2>重置密码</h2>
        <p className="subtitle">输入用户名，密码将重置为默认密码：jlcl2025</p>
        <form onSubmit={doReset}>
          <div className="form-row">
            <label>用户名 *</label>
            <input 
              className="input" 
              value={username} 
              onChange={e=>setUsername(e.target.value)}
              placeholder="请输入用户名"
              required
              disabled={loading}
            />
          </div>
          <div style={{
            padding: '12px',
            background: '#fff7e6',
            border: '1px solid #ffe58f',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#ad6800',
            marginBottom: '16px'
          }}>
            ⚠️ 密码将重置为：<strong>jlcl2025</strong>
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
            {loading ? '重置中...' : '重置密码'}
          </button>
          <div style={{textAlign: 'center', marginTop: '16px'}}>
            <Link to="/login" style={{color: 'var(--primary)', fontSize: '14px'}}>
              返回登录
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

