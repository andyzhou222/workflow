import React, { useEffect, useState } from 'react';
import api from '../api';

const roleText = (role) => {
  switch (role) {
    case 'admin':
      return '系统管理员';
    case 'company_admin':
      return '公司管理员';
    case 'dept_admin':
      return '部门管理员';
    case 'user':
    default:
      return '普通用户';
  }
};

export default function HrArchive() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/hr/profiles');
      setList(r.data || []);
    } catch (e) {
      setError('加载人事档案失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>人事档案</h1>
        <p>查看员工基本信息，仅公司管理员可查看全部，部门管理员仅查看本部门</p>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fff4f4', border: '1px solid #ffccc7', borderRadius: 8, color: '#d93026', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📇</div>
            <h3 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>暂无人事档案</h3>
            <p className="hint">请先在用户管理中添加用户信息</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: 12, textAlign: 'left' }}>用户名</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>显示名称</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>部门</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>职位</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>角色</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>注册时间</th>
                </tr>
              </thead>
              <tbody>
                {list.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 12 }}>{u.username}</td>
                    <td style={{ padding: 12 }}>{u.display_name || '-'}</td>
                    <td style={{ padding: 12 }}>{u.department || '-'}</td>
                    <td style={{ padding: 12 }}>{u.title || '-'}</td>
                    <td style={{ padding: 12 }}>{roleText(u.role)}</td>
                    <td style={{ padding: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {u.created_at ? new Date(u.created_at).toLocaleString('zh-CN') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


