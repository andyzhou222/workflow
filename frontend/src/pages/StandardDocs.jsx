import React, { useEffect, useRef, useState } from 'react';
import api from '../api';

export default function StandardDocs() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editingTitle, setEditingTitle] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadDocs();
    loadCurrentUser();
  }, []);

  async function loadCurrentUser() {
    try {
      const r = await api.get('/users/me');
      setCurrentUser(r.data);
    } catch (e) {
      console.warn('加载当前用户失败：', e);
    }
  }

  async function loadDocs() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/standard-docs');
      setDocs(r.data || []);
    } catch (e) {
      setError('加载标准文档失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  const isAdmin =
    currentUser?.role === 'admin' ||
    currentUser?.role === 'company_admin';

  function openFileDialog() {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  }

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleUpload(file);
  }

  async function handleUpload(file) {
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      const title = (newTitle || file.name || '').trim() || file.name || '未命名文件';
      fd.append('title', title);
      fd.append('file', file);
      const r = await api.post('/standard-docs/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDocs(prev => [r.data, ...prev]);
      setNewTitle('');
    } catch (e) {
      setError('上传失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setUploading(false);
    }
  }

  function startEdit(doc) {
    setEditingId(doc.id);
    setEditingTitle(doc.title || '');
  }

  async function submitEdit(doc) {
    if (!editingTitle.trim()) {
      setError('标题不能为空');
      return;
    }
    setError('');
    try {
      const fd = new FormData();
      fd.append('title', editingTitle.trim());
      const r = await api.put(`/standard-docs/${doc.id}`, fd);
      setDocs(prev =>
        prev.map(d =>
          d.id === doc.id
            ? { ...d, title: r.data.title }
            : d
        ),
      );
      setEditingId(null);
      setEditingTitle('');
    } catch (e) {
      setError('重命名失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  async function handleDelete(doc) {
    if (!window.confirm('确定要删除该标准文档吗？删除后不可恢复。')) return;
    setError('');
    try {
      await api.delete(`/standard-docs/${doc.id}`);
      setDocs(prev => prev.filter(d => d.id !== doc.id));
    } catch (e) {
      setError('删除失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  async function downloadDoc(doc) {
    setError('');
    try {
      const res = await api.get(`/docs/${doc.id}/download`, {
        responseType: 'blob',
      });
      const blob = new Blob([res.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.title || 'standard-doc';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError('下载失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>标准文档</h1>
        <p>上传和管理全公司标准化文件，所有登录用户均可查看与下载。</p>
      </div>

      {error && (
        <div
          style={{
            padding: 12,
            background: '#fff4f4',
            border: '1px solid #ffccc7',
            borderRadius: 8,
            color: '#d93026',
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div
          className="form-row"
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <button
            type="button"
            className="btn"
            onClick={openFileDialog}
            disabled={uploading}
          >
            {uploading ? '正在上传...' : '上传文件'}
          </button>
          <input
            type="file"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleFileChange}
            disabled={uploading}
          />
          <div style={{ flex: 1 }}>
            <label>标准文档标题</label>
            <input
              className="input"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="不填写则默认使用文件名"
            />
          </div>
        </div>
        <div className="hint">
          支持所有登录用户上传，建议上传 PDF 或 Office 文档。上传成功后将出现在下方列表中。
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>已上传标准文档</h3>
        {loading ? (
          <div className="loading">加载中...</div>
        ) : docs.length === 0 ? (
          <div className="empty-state" style={{ padding: '20px 0' }}>
            <div className="empty-state-icon">📚</div>
            <h3 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>
              暂无标准文档
            </h3>
            <p className="hint">点击上方“上传文件”按钮新增标准文档。</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {docs.map(doc => (
              <div
                key={doc.id}
                className="card"
                style={{
                  margin: 0,
                  padding: 12,
                  boxShadow: 'none',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === doc.id ? (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        className="input"
                        value={editingTitle}
                        onChange={e => setEditingTitle(e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn small"
                        onClick={() => submitEdit(doc)}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="btn small secondary"
                        onClick={() => {
                          setEditingId(null);
                          setEditingTitle('');
                        }}
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          fontWeight: 500,
                          marginBottom: 4,
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {doc.title || '未命名标准文档'}
                      </div>
                      <div className="hint">
                        上传人：{doc.uploaded_by || '-'}，上传时间：
                        {doc.uploaded_at
                          ? new Date(doc.uploaded_at).toLocaleString('zh-CN')
                          : '-'}
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn small secondary"
                    onClick={() => downloadDoc(doc)}
                  >
                    下载
                  </button>
                  {isAdmin && editingId !== doc.id && (
                    <>
                      <button
                        type="button"
                        className="btn small secondary"
                        onClick={() => startEdit(doc)}
                      >
                        重命名
                      </button>
                      <button
                        type="button"
                        className="btn small danger"
                        onClick={() => handleDelete(doc)}
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


