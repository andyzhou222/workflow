import React, { useEffect, useState } from 'react';
import api from '../api';

export default function StandardDocs() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [fileInputRef, setFileInputRef] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/standard-docs');
      setList(r.data || []);
    } catch (e) {
      setError('加载标准文档失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!title.trim()) {
      setError('请先填写文档标题');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('title', title.trim() || file.name);
      fd.append('file', file);
      await api.post('/standard-docs/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setTitle('');
      e.target.value = '';
      await load();
    } catch (e2) {
      setError('上传失败：' + (e2?.response?.data?.detail || e2.message));
    } finally {
      setUploading(false);
    }
  }

  async function handleRename(id) {
    if (!editingTitle.trim()) {
      setEditingId(null);
      return;
    }
    try {
      const fd = new FormData();
      fd.append('title', editingTitle.trim());
      await api.put(`/standard-docs/${id}`, fd);
      setEditingId(null);
      setEditingTitle('');
      await load();
    } catch (e) {
      setError('重命名失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('确定要删除该标准文档吗？')) return;
    try {
      await api.delete(`/standard-docs/${id}`);
      await load();
    } catch (e) {
      setError('删除失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  const apiBase = (import.meta.env.VITE_API_BASE || '').trim();
  const apiOrigin = apiBase.replace(/\/api\/?$/, '');

  const getDownloadUrl = (doc) => {
    const path = `/api/docs/${doc.id}/download`;
    if (apiOrigin) return `${apiOrigin}${path}`;
    return path;
  };

  const currentRole = JSON.parse(localStorage.getItem('currentUser') || '{}')?.role;
  const isAdmin = currentRole === 'admin' || currentRole === 'company_admin';

  return (
    <div>
      <div className="page-header">
        <h1>标准文档库</h1>
        <p>集中存放公司标准化制度、流程说明等文件，所有人可查看和上传，管理员可编辑和删除</p>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fff4f4', border: '1px solid #ffccc7', borderRadius: 8, color: '#d93026', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (fileInputRef) {
                fileInputRef.click();
              }
            }}
            disabled={uploading}
          >
            {uploading ? '正在上传...' : '上传文件'}
          </button>
          <input
            type="file"
            style={{ display: 'none' }}
            ref={el => setFileInputRef(el)}
            onChange={handleUpload}
            disabled={uploading}
          />
        </div>
        <div className="form-row" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <label>文档标题</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="请输入标准文档标题（如：品牌视觉规范、报销制度等）"
            />
          </div>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>支持所有登录用户上传，建议上传 PDF 或 Office 文档。</div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading">加载中...</div>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <h3 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>暂无标准文档</h3>
            <p className="hint">可以在上方输入标题并上传文件，创建第一条标准文档</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ padding: 12, textAlign: 'left' }}>标题</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>上传人</th>
                  <th style={{ padding: 12, textAlign: 'left' }}>上传时间</th>
                  <th style={{ padding: 12, textAlign: 'center' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((doc) => (
                  <tr key={doc.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 12 }}>
                      {editingId === doc.id ? (
                        <input
                          className="input"
                          style={{ width: '100%', padding: '4px 8px', fontSize: 13 }}
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                        />
                      ) : (
                        doc.title
                      )}
                    </td>
                    <td style={{ padding: 12 }}>{doc.uploaded_by || '-'}</td>
                    <td style={{ padding: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString('zh-CN') : '-'}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <a
                          href={getDownloadUrl(doc)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn small secondary"
                        >
                          下载
                        </a>
                        {isAdmin && (
                          <>
                            {editingId === doc.id ? (
                              <button
                                className="btn small"
                                onClick={() => handleRename(doc.id)}
                              >
                                保存
                              </button>
                            ) : (
                              <button
                                className="btn small secondary"
                                onClick={() => {
                                  setEditingId(doc.id);
                                  setEditingTitle(doc.title);
                                }}
                              >
                                重命名
                              </button>
                            )}
                            <button
                              className="btn small danger"
                              onClick={() => handleDelete(doc.id)}
                            >
                              删除
                            </button>
                          </>
                        )}
                      </div>
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


