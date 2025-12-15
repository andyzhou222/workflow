import React, { useEffect, useState } from 'react';
import api from '../api';

export default function Cycles() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [goal, setGoal] = useState('');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [assignTaskId, setAssignTaskId] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [allTasks, setAllTasks] = useState([]);

  useEffect(() => {
    load();
    loadAllTasks();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/cycles');
      setList(r.data || []);
    } catch (e) {
      if (e?.response?.status === 403) {
        setError('仅管理员可查看迭代');
      } else {
        setError('加载迭代失败：' + (e?.response?.data?.detail || e.message));
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadAllTasks() {
    try{
      const r = await api.get('/tasks');
      setAllTasks(r.data || []);
    }catch(e){
      setAllTasks([]);
    }
  }

  async function create() {
    setError('');
    try {
      await api.post('/cycles', {
        name: name.trim(),
        start_date: startDate,
        end_date: endDate,
        goal: goal.trim() || undefined
      });
      setName(''); setStartDate(''); setEndDate(''); setGoal('');
      await load();
    } catch (e) {
      setError('创建迭代失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  async function loadDetail(id) {
    setSelected(id);
    setDetail(null);
    setError('');
    try {
      const r = await api.get(`/cycles/${id}`);
      setDetail(r.data);
    } catch (e) {
      setError('加载迭代详情失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  async function assignTask() {
    if (!selected || !assignTaskId.trim()) return;
    setAssigning(true);
    setError('');
    try {
      await api.post(`/cycles/${selected}/tasks`, { task_id: assignTaskId.trim() });
      await loadDetail(selected);
      setAssignTaskId('');
    } catch (e) {
      setError('分配任务失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setAssigning(false);
    }
  }

  async function removeTask(taskId) {
    if (!selected) return;
    try {
      await api.delete(`/cycles/${selected}/tasks/${taskId}`);
      await loadDetail(selected);
    } catch (e) {
      setError('移除任务失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>迭代（Cycles）</h1>
        <p>按起止日期组织任务，并查看燃尽进度（管理员可见）</p>
      </div>
      {error && (
        <div style={{ padding: 12, background: '#fff4f4', border: '1px solid #ffccc7', borderRadius: 8, color: '#d93026', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="form-row">
          <label>迭代名称</label>
          <input className="input" value={name} onChange={e=>setName(e.target.value)} />
        </div>
        <div className="form-row" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
          <div>
            <label>开始日期</label>
            <input className="input" type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} />
          </div>
          <div>
            <label>结束日期</label>
            <input className="input" type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <label>目标</label>
          <textarea className="input" value={goal} onChange={e=>setGoal(e.target.value)} placeholder="可选" />
        </div>
        <button className="btn" disabled={!name.trim() || !startDate || !endDate} onClick={create}>创建迭代</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>迭代列表</h3>
        {loading ? (
          <div className="loading">加载中...</div>
        ) : list.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📆</div>
            <p className="hint">暂无迭代</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16 }}>
            {list.map(c=>(
              <div key={c.id} className="card" style={{ border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)', cursor:'pointer' }} onClick={()=>loadDetail(c.id)}>
                <div style={{ fontWeight:600, marginBottom:6 }}>{c.name}</div>
                <div className="hint">时间：{c.start_date} ~ {c.end_date}</div>
                <div className="hint" style={{ minHeight:32 }}>目标：{c.goal || '—'}</div>
                <div className="hint">创建人：{c.created_by || '-'}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selected && (
        <div className="card">
          <h3 style={{ marginBottom: 12 }}>迭代详情</h3>
          {!detail ? (
            <div className="hint">加载中...</div>
          ) : (
            <>
              <div className="hint" style={{ marginBottom:8 }}>
                {detail.start_date} ~ {detail.end_date}，目标：{detail.goal || '—'}
              </div>
              <Burndown tasks={detail.tasks || []} start={detail.start_date} end={detail.end_date} />
              <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
                <select
                  className="input"
                  style={{ maxWidth:320 }}
                  value={assignTaskId}
                  onChange={e=>setAssignTaskId(e.target.value)}
                >
                  <option value="">选择待分配的任务</option>
                  {allTasks.map(t=>(
                    <option key={t.id} value={t.id}>
                      {t.instance_title || '未命名'} / {t.node_name || t.node_id} / {t.assignee || '未分配'}
                    </option>
                  ))}
                </select>
                <button className="btn small" disabled={assigning || !assignTaskId.trim()} onClick={assignTask}>
                  {assigning ? '处理中...' : '加入迭代'}
                </button>
              </div>
              {detail.tasks?.length === 0 ? (
                <div className="empty-state" style={{ padding:'20px 0' }}>
                  <div className="empty-state-icon">🗒️</div>
                  <p className="hint">该迭代暂无任务</p>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:12 }}>
                  {detail.tasks.map(t=>(
                    <div key={t.id} className="card" style={{ border:'1px solid var(--border)', boxShadow:'var(--shadow-sm)' }}>
                      <div style={{ fontWeight:600, marginBottom:6 }}>任务ID：{t.id}</div>
                      <div className="hint">优先级：{t.priority || '未设定'}</div>
                      <div className="hint">模块：{t.module_id || '—'}</div>
                      <div className="hint">截止：{t.due_date || '—'}</div>
                      <div className="hint">状态：{t.status}</div>
                      <button className="btn small secondary" style={{ marginTop:8 }} onClick={()=>removeTask(t.id)}>移出</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Burndown({ tasks, start, end }) {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  const days = Math.max(1, Math.round((endDate - startDate) / (1000*60*60*24)) + 1);
  const total = tasks.length || 0;
  if (total === 0) return null;

  // 计算每日剩余（简单用完成状态统计：status === 'pending' 算未完成）
  const remainingByDay = [];
  for (let i=0; i<days; i++) {
    const day = new Date(startDate);
    day.setDate(day.getDate() + i);
    // 这里简化：如果任务 finished_at 存在且该日之后则计为完成
    const remain = tasks.filter(t => t.status === 'pending').length; // 无完成时间字段，使用状态
    remainingByDay.push({ day, remain });
  }
  const ideal = [];
  for (let i=0; i<days; i++) {
    const remain = Math.max(0, total - Math.round((total / (days-1 || 1)) * i));
    ideal.push(remain);
  }

  const maxRemain = total;
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="hint" style={{ marginBottom: 6 }}>燃尽图（基于任务完成状态）</div>
      <div style={{ position:'relative', height:120, background:'#f9fafb', border:'1px solid var(--border)', borderRadius:8, padding:8 }}>
        {/* 轴线 */}
        <div style={{ position:'absolute', left:40, right:8, top:8, bottom:24 }}>
          {/* Y 轴标尺 */}
          <div style={{ position:'absolute', left:-32, top:0, fontSize:12 }} className="hint">{maxRemain}</div>
          <div style={{ position:'absolute', left:-32, bottom:0, fontSize:12 }} className="hint">0</div>
          {/* Ideal 线 */}
          <Polyline points={ideal} color="#94a3b8" max={maxRemain} />
          {/* 实际 */}
          <Polyline points={remainingByDay.map(r=>r.remain)} color="#3370ff" max={maxRemain} />
        </div>
        <div style={{ position:'absolute', left:40, right:8, bottom:0, display:'flex', justifyContent:'space-between', fontSize:11 }} className="hint">
          <span>{start}</span>
          <span>{end}</span>
        </div>
      </div>
    </div>
  );
}

function Polyline({ points, color, max }) {
  if (!points || points.length === 0) return null;
  const width = 100;
  const height = 80;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((p, idx) => {
    const x = idx * step;
    const y = height - (Math.min(p, max) / (max || 1)) * height;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ position:'absolute', inset:0, overflow:'visible' }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={coords}
      />
    </svg>
  );
}

