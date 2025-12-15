import React, { useEffect, useState } from 'react';
import api from '../api';

export default function Modules() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/modules');
      setList(r.data || []);
    } catch (e) {
      if (e?.response?.status === 403) {
        setError('仅管理员可查看模块');
      } else {
        setError('加载模块失败：' + (e?.response?.data?.detail || e.message));
      }
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    setError('');
    try {
      await api.post('/modules', { name: name.trim(), description: desc.trim() });
      setName('');
      setDesc('');
      await load();
    } catch (e) {
      setError('创建模块失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  function startEdit(m){
    setEditingId(m.id);
    setEditName(m.name);
    setEditDesc(m.description || '');
  }

  async function saveEdit(){
    if(!editingId) return;
    setError('');
    try{
      await api.put(`/modules/${editingId}`, { name: editName.trim(), description: editDesc.trim() });
      setEditingId(null);
      setEditName('');
      setEditDesc('');
      await load();
    }catch(e){
      setError('编辑模块失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  async function remove(id){
    if(!window.confirm('确认删除该模块？')) return;
    setError('');
    try{
      await api.delete(`/modules/${id}`);
      await load();
    }catch(e){
      setError('删除模块失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>模块</h1>
        <p>用于按模块拆分任务/流程（仅管理员可见）</p>
      </div>
      {error && (
        <div style={{ padding: 12, background: '#fff4f4', border: '1px solid #ffccc7', borderRadius: 8, color: '#d93026', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <label>模块名称</label>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} placeholder="请输入模块名称" />
        </div>
        <div className="form-row">
          <label>描述</label>
          <textarea className="input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="可选" />
        </div>
        <button className="btn" disabled={!name.trim()} onClick={create}>创建模块</button>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 12 }}>模块列表</h3>
        {loading ? (
          <div className="loading">加载中...</div>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📦</div>
            <p className="hint">暂无模块</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16 }}>
            {list.map(m=>(
              <div key={m.id} className="card" style={{ border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)' }}>
                {editingId === m.id ? (
                  <>
                    <div className="form-row" style={{ marginBottom:8 }}>
                      <label>名称</label>
                      <input className="input" value={editName} onChange={e=>setEditName(e.target.value)} />
                    </div>
                    <div className="form-row" style={{ marginBottom:8 }}>
                      <label>描述</label>
                      <textarea className="input" value={editDesc} onChange={e=>setEditDesc(e.target.value)} />
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button className="btn small" onClick={saveEdit} disabled={!editName.trim()}>保存</button>
                      <button className="btn small secondary" type="button" onClick={()=>{
                        setEditingId(null); setEditName(''); setEditDesc('');
                      }}>取消</button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontWeight:600, marginBottom:6 }}>{m.name}</div>
                    <div className="hint" style={{ minHeight:40 }}>{m.description || '无描述'}</div>
                    <div className="hint" style={{ marginTop:8 }}>创建人：{m.created_by || '-'}</div>
                    <div className="hint">创建时间：{m.created_at ? new Date(m.created_at).toLocaleString('zh-CN') : '-'}</div>
                    <div style={{ display:'flex', gap:8, marginTop:10 }}>
                      <button className="btn small secondary" type="button" onClick={()=>startEdit(m)}>编辑</button>
                      <button className="btn small danger" type="button" onClick={()=>remove(m.id)}>删除</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

