import React from 'react';

export default function NodePanel({ onAdd }) {
  return (
    <div>
      <h3 style={{fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: 'var(--text-primary)'}}>
        节点库
      </h3>
      <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
        <button 
          className="btn small secondary" 
          onClick={()=>onAdd('start')}
          style={{justifyContent: 'flex-start'}}
        >
          🟢 开始节点
        </button>
        <button 
          className="btn small secondary" 
          onClick={()=>onAdd('approve')}
          style={{justifyContent: 'flex-start'}}
        >
          ✅ 审批节点
        </button>
        <button 
          className="btn small secondary" 
          onClick={()=>onAdd('end')}
          style={{justifyContent: 'flex-start'}}
        >
          🔴 结束节点
        </button>
      </div>
    </div>
  );
}
