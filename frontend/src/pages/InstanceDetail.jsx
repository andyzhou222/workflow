import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

const statusMap = {
  running: { label: '进行中', color: '#3370ff' },
  approved: { label: '已完成', color: '#22c55e' },
  rejected: { label: '已驳回', color: '#f97316' },
};

export default function InstanceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDetail();
  }, [id]);
  async function downloadAttachment(file){
    setError('');
    try{
      const res = await api.get(`/docs/${file.id}/download`, { responseType: 'blob' });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.title || 'attachment';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }catch(e){
      setError('下载附件失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  async function loadDetail() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get(`/instances/${id}`);
      setDetail(r.data);
    } catch (e) {
      setError('加载流程详情失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  const info = statusMap[detail?.status] || { label: detail?.status, color: '#94a3b8' };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 12, background: '#fff4f4', border: '1px solid #ffccc7', borderRadius: 8, color: '#d93026', marginBottom: 16 }}>
        {error}
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div>
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h1>{detail.title || detail.template_name || '流程详情'}</h1>
            <p>模板：{detail.template_name || detail.template_id}</p>
          </div>
          <button className="btn secondary" onClick={() => navigate(-1)}>返回</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>流程信息</h3>
          <div style={{ marginBottom: 12 }}>
            <strong>状态：</strong>
            <span style={{ color: info.color, fontWeight: 600 }}>{info.label}</span>
          </div>
          <div className="hint" style={{ marginBottom: 6 }}>当前节点：{detail.current_node_name || detail.current_node || '-'}</div>
          <div className="hint" style={{ marginBottom: 6 }}>当前处理人：{detail.current_assignee || '-'}</div>
          <div className="hint" style={{ marginBottom: 6 }}>发起人：{detail.started_by || '-'}</div>
          <div className="hint" style={{ marginBottom: 6 }}>发起时间：{detail.started_at ? new Date(detail.started_at).toLocaleString('zh-CN') : '-'}</div>
          {detail.ended_at && (
            <div className="hint" style={{ marginBottom: 6 }}>完成时间：{new Date(detail.ended_at).toLocaleString('zh-CN')}</div>
          )}
          {detail.data?.description && (
            <div style={{ marginTop: 12 }}>
              <strong>内容说明：</strong>
              <p className="hint">{detail.data.description}</p>
            </div>
          )}
              {detail.data?.attachments?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <strong>附件：</strong>
              <div>
                {detail.data.attachments.map(file => (
                      <button
                        key={file.id}
                        className="btn secondary"
                        type="button"
                        style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6 }}
                        onClick={()=>downloadAttachment(file)}
                      >
                        📎 {file.title}
                      </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 12 }}>审批历史</h3>
          {detail.history?.length ? (
            detail.history.map(item => (
              <div key={item.id} style={{ marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
                <div><strong>节点：</strong>{item.node_name || item.node_id}</div>
                <div className="hint">处理人：{item.assignee || '-'}</div>
                <div className="hint">状态：{item.status}</div>
                <div className="hint">时间：{item.finished_at ? new Date(item.finished_at).toLocaleString('zh-CN') : '-'}</div>
                {item.opinion && <div className="hint">意见：{item.opinion}</div>}
              </div>
            ))
          ) : (
            <div className="hint">暂无审批记录</div>
          )}
        </div>
      </div>
    </div>
  );
}

