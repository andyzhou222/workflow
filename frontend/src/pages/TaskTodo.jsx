import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function TaskTodo() {
  const [tasks, setTasks] = useState([]);
  const [rejectedList, setRejectedList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingRejected, setLoadingRejected] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [instanceDetail, setInstanceDetail] = useState(null);
  const [opinion, setOpinion] = useState('');
  const [keyword, setKeyword] = useState('');
  const [priority, setPriority] = useState('');
  const [labelsInput, setLabelsInput] = useState('');
  const [moduleId, setModuleId] = useState('');
  const [modules, setModules] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [labelFilter, setLabelFilter] = useState('');
  const [views, setViews] = useState([]);
  const [viewName, setViewName] = useState('');
  const [savingView, setSavingView] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadTasks();
    loadRejected();
    loadModules();
    loadViews();
  }, []);

  async function loadTasks() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/tasks/todo');
      setTasks(r.data || []);
    } catch (e) {
      setError('加载待办失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  async function loadRejected(){
    setLoadingRejected(true);
    try{
      const r = await api.get('/instances/mine', { params: { status: 'rejected' } });
      setRejectedList(r.data || []);
    }catch(e){
      setError('加载驳回流程失败：' + (e?.response?.data?.detail || e.message));
    }finally{
      setLoadingRejected(false);
    }
  }

  async function openTask(task) {
    setSelectedTask(task);
    setOpinion('');
    setInstanceDetail(null);
    setPriority(task.priority || '');
    setModuleId(task.module_id || '');
    setLabelsInput((task.labels || []).join(','));
    if (!task?.instance_id) return;
    setDetailLoading(true);
    try{
      const r = await api.get(`/instances/${task.instance_id}`);
      setInstanceDetail(r.data);
    }catch(e){
      setError('加载流程详情失败：' + (e?.response?.data?.detail || e.message));
    }finally{
      setDetailLoading(false);
    }
  }

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

  async function completeTask(task, decision) {
    setActionLoading(prev => ({ ...prev, [task.id]: true }));
    setError('');
    try {
      await api.post(`/tasks/${task.id}/complete`, {
        decision,
        opinion: opinion || undefined,
      });
      setSelectedTask(null);
      setOpinion('');
      await loadTasks();
      await loadRejected();
    } catch (e) {
      setError('操作失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setActionLoading(prev => ({ ...prev, [task.id]: false }));
    }
  }

  async function loadModules(){
    try{
      const r = await api.get('/modules');
      setModules(r.data || []);
    }catch(e){
      // 非管理员会 403，忽略
      setModules([]);
    }
  }

  async function loadViews(){
    try{
      const r = await api.get('/views');
      setViews(r.data || []);
    }catch(e){
      setViews([]);
    }
  }

  const getModuleName = (id) => {
    if (!id) return '';
    const m = modules.find(m=>m.id === id);
    return m ? m.name : id;
  };

  const filteredTasks = tasks.filter(task => {
    const kw = keyword.trim().toLowerCase();
    const labelKw = labelFilter.trim().toLowerCase();
    if (kw) {
      const title = (task.data?.title || '').toLowerCase();
      const startedBy = (task.instance?.started_by || '').toLowerCase();
      if (!title.includes(kw) && !startedBy.includes(kw)) return false;
    }
    if (priorityFilter && task.priority !== priorityFilter) return false;
    if (moduleFilter && task.module_id !== moduleFilter) return false;
    if (labelKw) {
      const labels = (task.labels || []).map(l=>l.toLowerCase());
      if (!labels.some(l=>l.includes(labelKw))) return false;
    }
    return true;
  });

  const renderTaskCard = (task) => (
    <div
      key={task.id}
      className="card kanban-card"
      style={{ cursor: 'pointer', boxShadow: 'none', border: '1px solid var(--border)', marginBottom: 8 }}
      onClick={() => openTask(task)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {task.data?.title || '未命名流程'}
          </div>
          <div className="hint" style={{ fontSize: 12 }}>
            节点：{task.node_name || task.node_id || '-'}
          </div>
        </div>
        <span className="hint" style={{ fontSize: 12, marginLeft: 8 }}>
          提交人：{task.instance?.started_by || '-'}
        </span>
      </div>
      <div className="hint" style={{ fontSize: 12 }}>
        当前处理人：{task.assignee || '-'}
      </div>
      <div className="hint" style={{ fontSize: 12, marginTop: 4, display:'flex', gap:8, flexWrap:'wrap' }}>
        {task.priority && <span style={{ color:'#f97316' }}>优先级：{task.priority}</span>}
        {task.labels?.length > 0 && (
          <span>标签：{task.labels.join('、')}</span>
        )}
        {task.module_id && <span>模块：{getModuleName(task.module_id)}</span>}
      </div>
    </div>
  );

  return (
    <div>
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h1>任务</h1>
            <p>以看板方式处理分配给您的流程任务</p>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              className="input"
              style={{ width: 220 }}
              placeholder="搜索标题或提交人"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <button
              className="btn secondary small"
              type="button"
              onClick={() => {
                setKeyword('');
                setPriorityFilter('');
                setModuleFilter('');
                setLabelFilter('');
                loadTasks();
                loadRejected();
              }}
            >
              重置
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
          <div>
            <label className="hint">优先级筛选</label>
            <select className="input" value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)}>
              <option value="">全部</option>
              <option value="低">低</option>
              <option value="中">中</option>
              <option value="高">高</option>
              <option value="紧急">紧急</option>
            </select>
          </div>
          <div>
            <label className="hint">模块筛选</label>
            <select className="input" value={moduleFilter} onChange={e=>setModuleFilter(e.target.value)}>
              <option value="">全部</option>
              {modules.map(m=>(
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="hint">标签包含</label>
            <input
              className="input"
              placeholder="输入标签关键字"
              value={labelFilter}
              onChange={e=>setLabelFilter(e.target.value)}
            />
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
            <input
              className="input"
              placeholder="保存为视图名称"
              value={viewName}
              onChange={e=>setViewName(e.target.value)}
            />
            <button
              className="btn small"
              disabled={savingView || !viewName.trim()}
              onClick={async ()=>{
                setSavingView(true);
                setError('');
                try{
                  await api.post('/views', {
                    name: viewName.trim(),
                    filters: {
                      keyword,
                      priority: priorityFilter,
                      module_id: moduleFilter,
                      label: labelFilter,
                    }
                  });
                  setViewName('');
                  await loadViews();
                }catch(e){
                  setError('保存视图失败：' + (e?.response?.data?.detail || e.message));
                }finally{
                  setSavingView(false);
                }
              }}
            >
              {savingView ? '保存中...' : '保存视图'}
            </button>
          </div>
        </div>
        {views.length > 0 && (
          <div style={{ marginTop: 12, display:'flex', gap:8, flexWrap:'wrap' }}>
            <span className="hint">我的视图：</span>
            {views.map(v=>(
              <div key={v.id} style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 10px', border:'1px solid var(--border)', borderRadius:8 }}>
                <button
                  className="btn small secondary"
                  style={{ padding:'4px 8px' }}
                  onClick={()=>{
                    const f = v.filters || {};
                    setKeyword(f.keyword || '');
                    setPriorityFilter(f.priority || '');
                    setModuleFilter(f.module_id || '');
                    setLabelFilter(f.label || '');
                  }}
                >
                  {v.name}
                </button>
                <button
                  className="btn small secondary"
                  style={{ padding:'4px 6px' }}
                  onClick={async ()=>{
                    await api.delete(`/views/${v.id}`);
                    await loadViews();
                  }}
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fff4f4', border: '1px solid #ffccc7', borderRadius: 8, color: '#d93026', marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>任务看板</h3>
          {loading ? (
            <div className="loading">加载中...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="empty-state-icon">🎉</div>
              <h3 style={{ marginBottom: 8, color: 'var(--text-primary)' }}>暂无待办任务</h3>
              <p className="hint">当前没有需要您处理的流程</p>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 12,
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span className="hint">待处理</span>
                  <span className="hint">{filteredTasks.length} 个任务</span>
                </div>
                <div
                  style={{
                    borderRadius: 8,
                    background: '#f9fafb',
                    padding: 8,
                    minHeight: 80,
                    border: '1px dashed var(--border)',
                  }}
                >
                  {filteredTasks.map(renderTaskCard)}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginBottom: 12 }}>驳回通知</h3>
          {loadingRejected ? (
            <div className="hint">加载中...</div>
          ) : rejectedList.length === 0 ? (
            <div className="empty-state" style={{ padding: '20px 0' }}>
              <div className="empty-state-icon">📬</div>
              <p className="hint">暂无驳回流程</p>
            </div>
          ) : (
            rejectedList.map(item => (
              <div key={item.id} className="card" style={{ marginBottom: 8, boxShadow: 'none', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong>{item.title || item.template_name || '未命名流程'}</strong>
                  <span style={{ color: '#f97316', fontWeight: 600 }}>已驳回</span>
                </div>
                <div className="hint" style={{ marginBottom: 6 }}>驳回时间：{item.ended_at ? new Date(item.ended_at).toLocaleString('zh-CN') : '-'}</div>
                <div className="hint" style={{ marginBottom: 6 }}>当前节点：{item.current_node || '-'}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => navigate(`/instances/${item.id}`)}
                  >
                    查看详情
                  </button>
                  <button
                    className="btn"
                    type="button"
                    onClick={() => navigate('/launch', { state: { prefill: { template_id: item.template_id, data: item.data }, oldInstanceId: item.id } })}
                  >
                    重新编辑
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        {selectedTask ? (
            <div className="card">
              <h3>{instanceDetail?.title || selectedTask.data?.title || '未命名流程'}</h3>
              <p className="hint" style={{ marginBottom: 12 }}>当前节点：{selectedTask.node_name || selectedTask.node_id || '-'}</p>
              <p className="hint" style={{ marginBottom: 12 }}>当前处理人：{selectedTask.assignee || '-'}</p>
              <div className="form-row" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:12 }}>
                <div>
                  <label>优先级</label>
                  <select className="input" value={priority} onChange={e=>setPriority(e.target.value)}>
                    <option value="">未设置</option>
                    <option value="低">低</option>
                    <option value="中">中</option>
                    <option value="高">高</option>
                    <option value="紧急">紧急</option>
                  </select>
                </div>
                <div>
                  <label>模块（管理员可见）</label>
                  <select className="input" value={moduleId} onChange={e=>setModuleId(e.target.value)}>
                    <option value="">未设置</option>
                    {modules.map(m=>(
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <label>标签（逗号分隔，可自由输入）</label>
                <input
                  className="input"
                  value={labelsInput}
                  onChange={e=>setLabelsInput(e.target.value)}
                  placeholder="例如：UI, 紧急, 客户A"
                />
              </div>

              {detailLoading && <div className="hint" style={{ marginBottom: 12 }}>详情加载中...</div>}

              {(instanceDetail?.data?.description || selectedTask.data?.description) && (
                <div style={{ marginBottom: 12 }}>
                  <strong>内容说明：</strong>
                  <p className="hint">{instanceDetail?.data?.description || selectedTask.data?.description}</p>
                </div>
              )}

              {instanceDetail?.data?.approvers?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <strong>指定签审人：</strong>
                  <p className="hint">{instanceDetail.data.approvers.join('、')}</p>
                </div>
              )}

              {instanceDetail?.data?.attachments?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <strong>附件：</strong>
                  <div>
                    {instanceDetail.data.attachments.map(file => (
                      <button
                        key={file.id}
                        type="button"
                        className="btn secondary"
                        style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 6 }}
                        onClick={()=>downloadAttachment(file)}
                      >
                        📎 {file.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {instanceDetail?.history?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <strong>历史记录：</strong>
                  <div className="hint">
                    {instanceDetail.history.map(item => (
                      <div key={item.id} style={{ marginBottom: 4 }}>
                        {item.node_name || item.node_id} - {item.assignee || '-'} - {item.status}{item.opinion ? `（${item.opinion}）` : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-row">
                <label>审批意见</label>
                <textarea
                  className="input"
                  style={{ minHeight: 120 }}
                  value={opinion}
                  onChange={e => setOpinion(e.target.value)}
                  placeholder="可选：填写备注或审批意见"
                />
              </div>

              {instanceDetail?.status === 'rejected' ? (
                <div>
                  <div className="hint" style={{ marginBottom: 12 }}>该流程已被驳回，请根据意见修改后重新发起。</div>
                  <button
                    className="btn"
                    onClick={()=>navigate('/launch', { state: { prefill: { template_id: instanceDetail.template_id, data: instanceDetail.data }, oldInstanceId: instanceDetail.id } })}
                  >
                    重新编辑并提交
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 12, flexWrap:'wrap' }}>
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={async ()=>{
                      setActionLoading(prev=>({...prev, [selectedTask.id]: true}));
                      try{
                        await api.put(`/tasks/${selectedTask.id}/meta`, {
                          priority: priority || null,
                          labels: labelsInput
                            ? labelsInput.split(',').map(t=>t.trim()).filter(Boolean)
                            : [],
                          module_id: moduleId || null,
                        });
                        await loadTasks();
                        if (selectedTask) {
                          const refreshed = (await api.get(`/tasks/todo`)).data || [];
                          const found = refreshed.find(t=>t.id === selectedTask.id);
                          if (found) setSelectedTask(found);
                        }
                      }catch(e){
                        setError('更新任务属性失败：' + (e?.response?.data?.detail || e.message));
                      }finally{
                        setActionLoading(prev=>({...prev, [selectedTask.id]: false}));
                      }
                    }}
                    disabled={actionLoading[selectedTask.id]}
                  >
                    {actionLoading[selectedTask.id] ? '更新中...' : '保存任务属性'}
                  </button>
                  <button
                    className="btn"
                    onClick={() => completeTask(selectedTask, 'approve')}
                    disabled={actionLoading[selectedTask.id]}
                  >
                    {actionLoading[selectedTask.id] ? '处理中...' : '✅ 通过'}
                  </button>
                  <button
                    className="btn danger"
                    onClick={() => completeTask(selectedTask, 'reject')}
                    disabled={actionLoading[selectedTask.id]}
                  >
                    {actionLoading[selectedTask.id] ? '处理中...' : '❌ 驳回'}
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => setSelectedTask(null)}
                    disabled={actionLoading[selectedTask.id]}
                  >
                    关闭
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="hint">点击“待办任务”中的流程以查看详情并处理</div>
            </div>
          )}
      </div>
    </div>
  );
}

