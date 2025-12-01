import React, { useEffect, useState } from 'react';
import api from '../api';
import { useNavigate } from 'react-router-dom';

export default function TemplateList(){
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const nav = useNavigate();

  useEffect(()=>{
    load();
    loadCurrentUser();
  }, []);

  async function load(){
    setLoading(true);
    setError('');
    try{
      const r = await api.get('/templates');
      setList(r.data || []);
    }catch(e){
      setError('加载模板失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentUser(){
    try{
      const r = await api.get('/users/me');
      setCurrentUser(r.data);
    }catch(e){
      console.warn('加载用户信息失败', e);
    }
  }

  async function handleDelete(id){
    if(!window.confirm('确定要删除该模板吗？')) return;
    try{
      await api.delete(`/templates/${id}`);
      setList(prev => prev.filter(t => t.id !== id));
    }catch(e){
      setError('删除失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h1>流程模板</h1>
            <p>管理和配置您的工作流模板</p>
          </div>
          <button className="btn" onClick={()=>nav('/designer')}>
            ➕ 新建模板
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">加载中...</div>
      ) : list.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <h3 style={{marginBottom: '8px', color: 'var(--text-primary)'}}>暂无模板</h3>
          <p className="hint">创建您的第一个流程模板开始使用</p>
          <button className="btn" style={{marginTop: '20px'}} onClick={()=>nav('/designer')}>
            创建模板
          </button>
        </div>
      ) : (
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px'}}>
            {list.map(t => (
            <div key={t.id} className="card">
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px'}}>
                <div style={{flex: 1, cursor: 'pointer'}} onClick={()=>nav('/designer', { state: { templateId: t.id } })}>
                  <h3 style={{fontSize: '16px', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)'}}>
                    {t.name}
                  </h3>
                  <p className="hint" style={{fontSize: '12px'}}>ID: {t.id}</p>
                  </div>
                <div style={{display: 'flex', gap: 8}}>
                  <button 
                    className="btn small secondary"
                    onClick={()=>nav('/designer', { state: { templateId: t.id } })}
                  >
                    编辑
                  </button>
                  {currentUser?.role !== 'user' && (
                    <button
                      className="btn small danger"
                      onClick={()=>handleDelete(t.id)}
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
              {t.created_by && (
                <div style={{paddingTop: '12px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-tertiary)'}}>
                  创建者: {t.created_by}
          </div>
              )}
        </div>
          ))}
        </div>
      )}
    </div>
  );
}
