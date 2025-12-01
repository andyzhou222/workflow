import React, { useState, useEffect } from 'react';

export default function NodeEditor({ node, onChange }) {
  const [local, setLocal] = useState(node?.data?.meta || {});

  useEffect(()=> setLocal(node?.data?.meta || {}), [node]);

  if(!node) return (
    <div className="card">
      <div className="empty-state" style={{padding: '40px 20px'}}>
        <div className="empty-state-icon">👆</div>
        <p className="hint">选择一个节点来编辑属性</p>
      </div>
    </div>
  );

  function apply(){
    onChange({ ...node, data: { ...node.data, meta: local } });
  }

  return (
    <div className="card">
      <h3 style={{fontSize: '16px', fontWeight: 600, marginBottom: '20px', color: 'var(--text-primary)'}}>
        节点属性
      </h3>
      <div className="form-row">
        <label>节点ID</label>
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '13px',
          fontFamily: 'monospace',
          color: 'var(--text-secondary)'
        }}>
          {node.id}
        </div>
      </div>
      <div className="form-row">
        <label>节点类型</label>
        <div style={{
          padding: '10px 12px',
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '14px',
          color: 'var(--text-primary)'
        }}>
          {node.data?.label || '未知'}
        </div>
      </div>

      <div className="form-row">
        <label>节点名称</label>
        <input 
          className="input" 
          value={local.name || ''} 
          onChange={e=>setLocal({...local, name:e.target.value})}
          placeholder="输入节点显示名称（如：部门审批、财务审核等）"
        />
        <div className="hint">如果不填写，将使用节点ID作为显示名称</div>
      </div>

      {node.data?.label?.toLowerCase().includes('approve') && (
        <div className="form-row">
          <label>审批人</label>
          <input 
            className="input" 
            value={local.assignee || ''} 
            onChange={e=>setLocal({...local, assignee:e.target.value})}
            placeholder="输入审批人用户名"
          />
        </div>
      )}

      <button 
        className="btn small" 
        onClick={apply}
        style={{width: '100%', marginTop: '16px'}}
      >
        💾 保存属性
      </button>
    </div>
  );
}
