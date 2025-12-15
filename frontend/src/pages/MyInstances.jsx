import React, { useEffect, useMemo, useState } from 'react';
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
  const [viewMode, setViewMode] = useState('list'); // list | timeline
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

  // 计算时间轴渲染所需的数据
  const timelineData = useMemo(() => {
    if (!list || list.length === 0) return { items: [], min: null, max: null };

    const parsed = list
      .map((item) => {
        if (!item.started_at) return null;
        const start = new Date(item.started_at).getTime();
        const end = item.ended_at ? new Date(item.ended_at).getTime() : Date.now();
        if (!start) return null;
        return { item, start, end };
      })
      .filter(Boolean);

    if (parsed.length === 0) return { items: [], min: null, max: null };

    const min = parsed.reduce((m, cur) => (cur.start < m ? cur.start : m), parsed[0].start);
    const max = parsed.reduce((m, cur) => (cur.end > m ? cur.end : m), parsed[0].end);

    const span = max - min || 1;

    const items = parsed.map(({ item, start, end }, idx) => {
      const left = ((start - min) / span) * 100;
      const width = Math.max(2, ((end - start) / span) * 100);
      const statusInfo = statusMap[item.status] || { label: item.status, color: '#94a3b8' };
      return {
        id: item.id,
        title: item.title || item.template_name || '未命名流程',
        statusLabel: statusInfo.label,
        color: statusInfo.color,
        left,
        width,
        row: idx, // 简单按索引逐行排布
        started_at: item.started_at,
        ended_at: item.ended_at,
      };
    });

    return { items, min, max };
  }, [list]);

  return (
    <div>
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h1>流程</h1>
            <p>以列表或时间轴查看我发起的流程</p>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div
              style={{
                display: 'inline-flex',
                borderRadius: '999px',
                border: '1px solid var(--border)',
                padding: 2,
                background: 'var(--bg-secondary)',
              }}
            >
              <button
                type="button"
                className="btn small secondary"
                style={{
                  borderRadius: '999px',
                  padding: '6px 14px',
                  border: 'none',
                  background: viewMode === 'list' ? 'var(--primary-light)' : 'transparent',
                  color: viewMode === 'list' ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: 'none',
                }}
                onClick={() => setViewMode('list')}
              >
                列表视图
              </button>
              <button
                type="button"
                className="btn small secondary"
                style={{
                  borderRadius: '999px',
                  padding: '6px 14px',
                  border: 'none',
                  background: viewMode === 'timeline' ? 'var(--primary-light)' : 'transparent',
                  color: viewMode === 'timeline' ? 'var(--primary)' : 'var(--text-secondary)',
                  boxShadow: 'none',
                }}
                onClick={() => setViewMode('timeline')}
              >
                时间轴视图
              </button>
            </div>
            <select
              className="input"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              style={{ width: 160 }}
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
          <p className="hint">您还没有发起过任何流程，点击侧栏的“发起流程”试试</p>
        </div>
      ) : viewMode === 'list' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {list.map(item => (
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
      ) : (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>流程时间轴</h3>
          {timelineData.items.length === 0 ? (
            <div className="hint">当前筛选条件下暂无可以展示在时间轴上的流程。</div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="hint">
                  起始：{new Date(timelineData.min).toLocaleDateString('zh-CN')}
                </span>
                <span className="hint">
                  截止：{new Date(timelineData.max).toLocaleDateString('zh-CN')}
                </span>
              </div>
              <div
                style={{
                  position: 'relative',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  padding: '24px 12px 16px',
                  background: '#f9fafb',
                  overflow: 'hidden',
                  minHeight: Math.max(80, timelineData.items.length * 32),
                }}
              >
                {timelineData.items.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      position: 'absolute',
                      left: `${t.left}%`,
                      width: `${t.width}%`,
                      top: t.row * 32,
                      minWidth: 40,
                      maxWidth: '100%',
                      background: t.color,
                      borderRadius: 999,
                      padding: '4px 8px',
                      color: '#fff',
                      fontSize: 12,
                      cursor: 'pointer',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.08)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    title={`${t.title}（${t.statusLabel}）\n开始：${t.started_at ? new Date(t.started_at).toLocaleString('zh-CN') : '-'}\n结束：${t.ended_at ? new Date(t.ended_at).toLocaleString('zh-CN') : '进行中'}`}
                    onClick={() => navigate(`/instances/${t.id}`)}
                  >
                    {t.title}
                  </div>
                ))}
                {/* 中心轴线 */}
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: '50%',
                    height: 1,
                    background: 'rgba(148, 163, 184, 0.4)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

