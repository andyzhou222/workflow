import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function TaskMonitor() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadInstances();
    // 每30秒自动刷新
    const interval = setInterval(loadInstances, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadInstances() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/instances/monitor');
      setInstances(r.data || []);
    } catch (e) {
      setError('加载监控数据失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '-';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}天${hours}小时`;
    } else if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    } else {
      return `${minutes}分钟`;
    }
  }

  function getStuckColor(duration) {
    if (!duration || duration < 0) return 'var(--text-secondary)';
    const hours = duration / 3600;
    if (hours >= 24) return '#f53f3f'; // 红色：超过1天
    if (hours >= 8) return '#f97316'; // 橙色：超过8小时
    if (hours >= 4) return '#fbbf24'; // 黄色：超过4小时
    return 'var(--text-secondary)'; // 正常
  }

  if (loading && instances.length === 0) {
    return <div className="loading">加载中...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>任务监控</h1>
        <p>实时监控所有运行中任务的进程状态、负责人和停留时长</p>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fff4f4', border: '1px solid #ffccc7', borderRadius: 8, color: '#d93026', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="hint">
          共 {instances.length} 个运行中的任务。停留时长超过4小时将显示为黄色，超过8小时为橙色，超过1天为红色。
        </div>
      </div>

      {instances.length === 0 ? (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            暂无运行中的任务
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 20 }}>
          {instances.map(item => (
            <div
              key={item.id}
              className="card"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/instances/${item.id}`)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <strong>{item.title || item.template_name || '未命名流程'}</strong>
                  <div className="hint">模板：{item.template_name || item.template_id}</div>
                </div>
                <div style={{ color: '#3370ff', fontWeight: 600 }}>
                  进行中
                </div>
              </div>
              
              <div style={{ marginBottom: 8 }}>
                <div className="hint" style={{ marginBottom: 4 }}>
                  当前节点：<strong style={{ color: 'var(--text-primary)' }}>{item.current_node_name || item.current_node || '-'}</strong>
                </div>
                <div className="hint" style={{ marginBottom: 4 }}>
                  当前负责人：<strong style={{ color: 'var(--text-primary)' }}>{item.current_assignee || '-'}</strong>
                </div>
                <div className="hint" style={{ marginBottom: 4 }}>
                  停留时长：<strong style={{ color: getStuckColor(item.stuck_duration) }}>
                    {formatDuration(item.stuck_duration)}
                  </strong>
                </div>
                <div className="hint" style={{ marginBottom: 8 }}>
                  进度：<strong style={{ color: 'var(--text-primary)' }}>{item.progress_percent ?? 0}%</strong>
                </div>
                <div style={{ height: 8, background: '#f0f0f0', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                  <div
                    style={{
                      width: `${Math.min(100, Math.max(0, item.progress_percent ?? 0))}%`,
                      background: '#3370ff',
                      height: '100%',
                      transition: 'width 0.3s ease',
                    }}
                  ></div>
                </div>
                <div className="hint" style={{ marginBottom: 4 }}>
                  发起人：{item.started_by_name || item.started_by || '-'}
                </div>
                <div className="hint">
                  发起时间：{item.started_at ? new Date(item.started_at).toLocaleString('zh-CN') : '-'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

