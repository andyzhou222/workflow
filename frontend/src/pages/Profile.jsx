import React, { useEffect, useState } from 'react';
import api from '../api';

export default function Profile(){
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [department, setDepartment] = useState('');
  const [title, setTitle] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile(){
    setLoading(true);
    setError('');
    try{
      const r = await api.get('/users/me');
      setUser(r.data);
      setUsername(r.data.username || '');
      setDisplayName(r.data.display_name || '');
      setDepartment(r.data.department || '');
      setTitle(r.data.title || '');
      setAvatar(r.data.avatar || '');
    }catch(e){
      setError('加载个人信息失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(e){
    e && e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    
    try{
      const r = await api.put('/users/me', {
        username,
        display_name: displayName,
        department: department,
        title: title,
        avatar: avatar
      });
      setUser(r.data);
      setSuccess('个人信息更新成功！');
      setTimeout(() => setSuccess(''), 3000);
    }catch(e){
      setError('更新失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e){
    const file = e.target.files?.[0];
    if(!file) return;
    
    if(!file.type.startsWith('image/')) {
      setError('请选择图片文件');
      return;
    }
    
    if(file.size > 5 * 1024 * 1024) {
      setError('图片大小不能超过 5MB');
      return;
    }
    
    setAvatarFile(file);
    setError('');
    setSaving(true);
    
    try{
      const formData = new FormData();
      formData.append('file', file);
      const r = await api.post('/users/me/upload-avatar', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      const newAvatar = r.data.avatar;
      setAvatar(newAvatar);
      setUser({...user, avatar: newAvatar});
      setSuccess('头像上传成功！');
      // 触发用户信息更新事件，让侧边栏刷新
      window.dispatchEvent(new CustomEvent('user-info-updated'));
      setTimeout(() => setSuccess(''), 3000);
    }catch(e){
      setError('头像上传失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
      setAvatarFile(null);
    }
  }

  async function changePassword(e){
    e && e.preventDefault();
    setError('');
    setSuccess('');
    
    if(newPassword !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }
    
    if(newPassword.length < 6) {
      setError('密码长度至少为6位');
      return;
    }
    
    setChangingPassword(true);
    
    try{
      await api.post('/users/me/change-password', {
        old_password: oldPassword,
        new_password: newPassword
      });
      setSuccess('密码修改成功！');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(''), 3000);
    }catch(e){
      setError('密码修改失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setChangingPassword(false);
    }
  }

  // 生成头像URL或默认头像（注意前后端不同域名）
  const getAvatarUrl = () => {
    const apiBase = (import.meta.env.VITE_API_BASE || '').trim();
    const apiOrigin = apiBase.replace(/\/api\/?$/, '');

    if (avatar) {
      // 已经是完整 URL
      if (avatar.startsWith('http')) {
        return `${avatar}?t=${Date.now()}`;
      }

      // 兼容旧数据：可能是 /uploads/... 或 /api/uploads/...
      let path = avatar;
      if (path.startsWith('/api')) {
        path = path.replace(/^\/api/, '');
      }

      const full = apiOrigin ? `${apiOrigin}${path}` : path;
      return `${full}?t=${Date.now()}`;
    }

    // 使用默认头像（可以根据用户名生成）
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(
      username || 'User'
    )}&background=3370ff&color=fff&size=200`;
  };

  if(loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>个人信息</h1>
        <p>管理您的个人资料和账户设置</p>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '20px'}}>
        {/* 左侧：头像和基本信息 */}
        <div className="card">
          <div style={{textAlign: 'center', marginBottom: '24px'}}>
            <div style={{position: 'relative', display: 'inline-block'}}>
              <img 
                src={getAvatarUrl()} 
                alt="头像" 
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: '3px solid var(--border)',
                  marginBottom: '12px'
                }}
              />
              <label 
                style={{
                  position: 'absolute',
                  bottom: '0',
                  right: '0',
                  background: 'var(--primary)',
                  color: 'white',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-md)'
                }}
              >
                📷
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleAvatarUpload}
                  style={{display: 'none'}}
                  disabled={saving}
                />
              </label>
            </div>
            {title && (
              <div style={{fontSize: '16px', fontWeight: 500, color: 'var(--text-primary)', marginTop: '8px'}}>
                {title}
              </div>
            )}
            <div style={{fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px'}}>
              {user?.role === 'admin' ? '管理员' : '普通用户'}
            </div>
          </div>

          {error && (
            <div style={{
              padding: '12px',
              background: '#fff4f4',
              border: '1px solid #ffccc7',
              borderRadius: '6px',
              color: '#f53f3f',
              fontSize: '13px',
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}
          
          {success && (
            <div style={{
              padding: '12px',
              background: '#f6ffed',
              border: '1px solid #b7eb8f',
              borderRadius: '6px',
              color: '#52c41a',
              fontSize: '13px',
              marginBottom: '20px'
            }}>
              {success}
            </div>
          )}

          <form onSubmit={saveProfile}>
            <div className="form-row">
              <label>用户名</label>
              <input 
                className="input" 
                value={username} 
                onChange={e=>setUsername(e.target.value)}
                placeholder="请输入用户名"
                required
              />
            </div>

            <div className="form-row">
              <label>显示名称</label>
              <input 
                className="input" 
                value={displayName} 
                onChange={e=>setDisplayName(e.target.value)}
                placeholder="请输入显示名称"
              />
            </div>

            <div className="form-row">
              <label>部门</label>
              <input 
                className="input" 
                value={department} 
                onChange={e=>setDepartment(e.target.value)}
                placeholder="请输入部门名称"
              />
            </div>

            <div className="form-row">
              <label>职称</label>
              <input 
                className="input" 
                value={title} 
                onChange={e=>setTitle(e.target.value)}
                placeholder="请输入职称"
              />
            </div>

            {user?.created_at && (
              <div className="form-row">
                <label>注册时间</label>
                <div style={{
                  padding: '10px 12px',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '14px',
                  color: 'var(--text-secondary)'
                }}>
                  {new Date(user.created_at).toLocaleString('zh-CN')}
                </div>
              </div>
            )}

            <button 
              type="submit" 
              className="btn" 
              style={{width: '100%', marginTop: '16px'}}
              disabled={saving}
            >
              {saving ? '保存中...' : '💾 保存更改'}
            </button>
          </form>
        </div>

        {/* 右侧：修改密码 */}
        <div className="card">
          <h3 style={{fontSize: '18px', fontWeight: 600, marginBottom: '20px'}}>修改密码</h3>
          <form onSubmit={changePassword}>
            <div className="form-row">
              <label>当前密码</label>
              <input 
                type="password"
                className="input" 
                value={oldPassword} 
                onChange={e=>setOldPassword(e.target.value)}
                placeholder="请输入当前密码"
                required
              />
            </div>

            <div className="form-row">
              <label>新密码</label>
              <input 
                type="password"
                className="input" 
                value={newPassword} 
                onChange={e=>setNewPassword(e.target.value)}
                placeholder="请输入新密码（至少6位）"
                required
                minLength={6}
              />
            </div>

            <div className="form-row">
              <label>确认新密码</label>
              <input 
                type="password"
                className="input" 
                value={confirmPassword} 
                onChange={e=>setConfirmPassword(e.target.value)}
                placeholder="请再次输入新密码"
                required
                minLength={6}
              />
            </div>

            <button 
              type="submit" 
              className="btn" 
              style={{width: '100%', marginTop: '16px'}}
              disabled={changingPassword}
            >
              {changingPassword ? '修改中...' : '🔒 修改密码'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
