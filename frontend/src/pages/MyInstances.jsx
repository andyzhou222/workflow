import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const statusMap = {
  running: { label: '进行中', color: '#3370ff' },
  approved: { label: '已完成', color: '#22c55e' },
  rejected: { label: '已驳回', color: '#f97316' },
};

export default function MyInstances() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadInstances();
  }, [filter]);

  async function loadInstances() {
    setLoading(true);
    setError('');
    try {
      const params = filter ? { status: filter } : {};
      const r = await api.get('/instances/mine', { params });
      setList(r.data || []);
    } catch (e) {
      setError('加载流程失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  const renderStatus = (status) => {
    const info = statusMap[status] || { label: status, color: '#94a3b8' };
    return (
      <span style={{ color: info.color, fontWeight: 600 }}>
        {info.label}
      </span>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h1>我发起的流程</h1>
            <p>查看我发起的所有流程及当前进度</p>
          </div>
          <div>
            <select
              className="input"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="running">进行中</option>
              <option value="approved">已完成</option>
              <option value="rejected">已驳回</option>
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fff4f4', border: '1px solid #ffccc7', borderRadius: 8, color: '#d93026', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <h3 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>暂无流程</h3>
          <p className="hint">您还没有发起过任何流程，点击侧栏的“发起签审”试试</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {list.map(item => (
            <div key={item.id} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/instance-detail/${item.id}`)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <strong>{item.title || item.template_name || '未命名流程'}</strong>
                  <div className="hint">模板：{item.template_name || item.template_id}</div>
                </div>
                <div>
                  {renderStatus(item.status)}
                </div>
              </div>
              <div className="hint" style={{ marginBottom: 6 }}>
                当前节点：{item.current_node_name || item.current_node || '-'}
              </div>
              <div className="hint" style={{ marginBottom: 6 }}>
                当前处理人：{item.current_assignee || '-'}
              </div>
              <div className="hint">
                发起时间：{item.started_at ? new Date(item.started_at).toLocaleString('zh-CN') : '-'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

