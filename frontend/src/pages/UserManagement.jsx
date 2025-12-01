import React, { useEffect, useState } from 'react';
import api from '../api';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    department: '',
    title: '',
    role: 'user'
  });

  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, []);

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/users');
      setUsers(r.data || []);
    } catch (e) {
      setError('加载用户列表失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  async function loadDepartments() {
    try {
      const r = await api.get('/departments');
      setDepartments(r.data?.items || []);
    } catch (e) {
      console.warn('加载部门列表失败：', e);
    }
  }

  function startEdit(user) {
    setEditingUser(user.id);
    setFormData({
      username: user.username || '',
      display_name: user.display_name || '',
      department: user.department || '',
      title: user.title || '',
      role: user.role || 'user'
    });
  }

  function cancelEdit() {
    setEditingUser(null);
    setFormData({
      username: '',
      display_name: '',
      department: '',
      title: '',
      role: 'user'
    });
  }

  async function saveUser(userId) {
    setError('');
    try {
      await api.put(`/users/${userId}`, formData);
      await loadUsers();
      setEditingUser(null);
      alert('用户信息更新成功！');
    } catch (e) {
      setError('更新失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  const getRoleText = (role) => {
    switch (role) {
      case 'admin': return '系统管理员';
      case 'company_admin': return '公司管理员';
      case 'dept_admin': return '部门管理员';
      case 'user': return '普通用户';
      default: return role;
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return '#f53f3f';
      case 'company_admin': return '#f53f3f';
      case 'dept_admin': return '#3370ff';
      case 'user': return 'var(--text-secondary)';
      default: return 'var(--text-secondary)';
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>用户管理</h1>
        <p>管理系统用户、权限和部门信息</p>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fff4f4', border: '1px solid #ffccc7', borderRadius: 8, color: '#d93026', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card" style={{marginBottom: '16px'}}>
        <div className="hint">
          请为每位用户设置部门和权限。部门管理员只能查看其所属部门的成员待办；若成员未填写部门，将不会出现在部门视图里。
        </div>
      </div>

      <div className="card">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>用户名</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>显示名称</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>部门</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>职位</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>权限</th>
                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600 }}>注册时间</th>
                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 600 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  {editingUser === user.id ? (
                    <>
                      <td style={{ padding: '12px' }}>
                        <input
                          className="input"
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                          value={formData.username}
                          onChange={e => setFormData({ ...formData, username: e.target.value })}
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <input
                          className="input"
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                          value={formData.display_name}
                          onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <>
                          <input
                            className="input"
                            list="department-options"
                            style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                            value={formData.department}
                            onChange={e => setFormData({ ...formData, department: e.target.value })}
                            placeholder="选择或输入部门"
                          />
                          <datalist id="department-options">
                            {departments.map(dep => (
                              <option key={dep} value={dep} />
                            ))}
                          </datalist>
                        </>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <input
                          className="input"
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                          value={formData.title}
                          onChange={e => setFormData({ ...formData, title: e.target.value })}
                          placeholder="输入职位"
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <select
                          className="input"
                          style={{ width: '100%', padding: '6px 8px', fontSize: '13px' }}
                          value={formData.role}
                          onChange={e => setFormData({ ...formData, role: e.target.value })}
                        >
                          <option value="user">普通用户</option>
                          <option value="dept_admin">部门管理员</option>
                          <option value="admin">系统管理员</option>
                          <option value="company_admin">公司管理员</option>
                        </select>
                      </td>
                      <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '-'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            className="btn small"
                            onClick={() => saveUser(user.id)}
                          >
                            保存
                          </button>
                          <button
                            className="btn small secondary"
                            onClick={cancelEdit}
                          >
                            取消
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: '12px', fontWeight: 500 }}>{user.username}</td>
                      <td style={{ padding: '12px' }}>{user.display_name || '-'}</td>
                      <td style={{ padding: '12px' }}>{user.department || '-'}</td>
                      <td style={{ padding: '12px' }}>{user.title || '-'}</td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'white',
                          background: getRoleColor(user.role)
                        }}>
                          {getRoleText(user.role)}
                        </span>
                      </td>
                      <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {user.created_at ? new Date(user.created_at).toLocaleString('zh-CN') : '-'}
                      </td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <button
                          className="btn small secondary"
                          onClick={() => startEdit(user)}
                        >
                          编辑
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 && (
            <div className="empty-state" style={{ padding: '40px 20px' }}>
              <div className="empty-state-icon">👥</div>
              <p className="hint">暂无用户</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

