import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';

const initialForm = {
  template_id: '',
  title: '',
  content_type: '视频',
  description: '',
  due_date: '',
  attachments: [],
  approvers: [],
};

const contentTypes = ['视频', '文本', '图片', '文档', '其他'];

export default function LaunchFlow() {
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [oldInstanceId, setOldInstanceId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [userOptions, setUserOptions] = useState([]);
  const [approverDropdownOpen, setApproverDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadTemplates();
    loadUserOptions();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if(dropdownRef.current && !dropdownRef.current.contains(event.target)){
        setApproverDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const prefill = location.state?.prefill;
    const oldId = location.state?.oldInstanceId;
    if(prefill){
      setForm(prev => ({
        ...prev,
        template_id: prefill.template_id || prev.template_id,
        title: prefill.data?.title || '',
        content_type: prefill.data?.content_type || '视频',
        description: prefill.data?.description || '',
        due_date: prefill.data?.due_date || '',
        approvers: prefill.data?.approvers || [],
      }));
      setFiles(prefill.data?.attachments || []);
    }
    if(oldId){
      setOldInstanceId(oldId);
    }
  }, [location.state]);

  async function loadTemplates() {
    setLoading(true);
    setError('');
    try {
      const r = await api.get('/templates');
      setTemplates(r.data || []);
      if (!form.template_id && r.data?.length) {
        setForm(prev => ({ ...prev, template_id: r.data[0].id }));
      }
    } catch (e) {
      setError('加载模板失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setLoading(false);
    }
  }

  async function loadUserOptions(){
    try{
      const r = await api.get('/users/options');
      setUserOptions(r.data || []);
    }catch(e){
      console.warn('加载签审人列表失败：', e);
    }
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function toggleApprover(username){
    setForm(prev => {
      const current = prev.approvers || [];
      if(current.includes(username)){
        return { ...prev, approvers: current.filter(item => item !== username) };
      }
      return { ...prev, approvers: [...current, username] };
    });
  }

  function clearApprovers(){
    setForm(prev => ({ ...prev, approvers: [] }));
  }

  async function handleFileUpload(e) {
    const fileList = Array.from(e.target.files || []);
    if (!fileList.length) return;
    setError('');
    try {
      const uploaded = [];
      for (const file of fileList) {
        const fd = new FormData();
        fd.append('title', file.name);
        fd.append('file', file);
        const r = await api.post('/docs/upload', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploaded.push({
          id: r.data.id,
          title: r.data.title,
          filename: r.data.filename,
        });
      }
      setFiles(prev => [...prev, ...uploaded]);
      setSuccess('附件上传成功');
      setTimeout(() => setSuccess(''), 2000);
    } catch (e) {
      setError('上传附件失败：' + (e?.response?.data?.detail || e.message));
    }
  }

  async function handleSubmit(e) {
    e && e.preventDefault();
    setError('');
    setSuccess('');

    if (!form.template_id) {
      setError('请选择流程模板');
      return;
    }
    if (!form.title.trim()) {
      setError('请填写内容标题');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        template_id: form.template_id,
        data: {
          title: form.title,
          content_type: form.content_type,
          description: form.description,
          due_date: form.due_date,
          attachments: files,
          approvers: form.approvers,
        },
      };
      // 如果是重新提交，传递旧实例ID
      if(oldInstanceId){
        payload.old_instance_id = oldInstanceId;
      }
      const r = await api.post('/instances/start', payload);
      setSuccess('任务发起成功！');
      setForm(initialForm);
      setFiles([]);
      setOldInstanceId(null);
      setTimeout(() => {
        navigate('/my-instances', { replace: true });
      }, 1500);
    } catch (e) {
      setError('发起失败：' + (e?.response?.data?.detail || e.message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>发起任务</h1>
        <p>选择流程模板并提交内容进行处理</p>
      </div>

      {error && (
        <div style={{ padding: 12, background: '#fff4f4', border: '1px solid #ffccc7', borderRadius: 8, color: '#d93026', marginBottom: 16 }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ padding: 12, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, color: '#0f8a00', marginBottom: 16 }}>
          {success}
        </div>
      )}

      <div className="card" style={{ maxWidth: 720 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>流程模板 *</label>
            <select
              className="input"
              value={form.template_id}
              onChange={e => handleChange('template_id', e.target.value)}
              disabled={loading || submitting}
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
              {!templates.length && <option value="">暂无模板</option>}
            </select>
          </div>

          <div className="form-row">
            <label>内容标题 *</label>
            <input
              className="input"
              value={form.title}
              onChange={e => handleChange('title', e.target.value)}
              placeholder="例如：XX项目成片审核"
              required
            />
          </div>

          <div className="form-row">
            <label>内容类型</label>
            <select
              className="input"
              value={form.content_type}
              onChange={e => handleChange('content_type', e.target.value)}
            >
              {contentTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>期望完成时间</label>
            <input
              type="date"
              className="input"
              value={form.due_date}
              onChange={e => handleChange('due_date', e.target.value)}
            />
          </div>

          <div className="form-row">
            <label>内容说明</label>
            <textarea
              className="input"
              style={{ minHeight: 120 }}
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              placeholder="补充说明、重点提示等"
            />
          </div>

          <div className="form-row">
            <label>签审人</label>
            <div
              ref={dropdownRef}
              style={{
                position: 'relative',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '8px 12px',
                cursor: 'pointer'
              }}
              onClick={()=>setApproverDropdownOpen(prev => !prev)}
            >
              <div style={{display:'flex', flexWrap:'wrap', gap:'6px'}}>
                {form.approvers?.length ? form.approvers.map(username => {
                  const found = userOptions.find(u => u.username === username);
                  return (
                    <span key={username} style={{
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '12px'
                    }}>
                      {found?.display_name || username}
                    </span>
                  )
                }) : (
                  <span className="hint">请选择签审人（不选则使用模板默认审批人）</span>
                )}
              </div>
              <span style={{position:'absolute', right:10, top:10}}>▾</span>
              {approverDropdownOpen && (
                <div style={{
                  position:'absolute',
                  top:'calc(100% + 4px)',
                  left:0,
                  width:'100%',
                  maxHeight:'220px',
                  overflowY:'auto',
                  background:'#fff',
                  border:'1px solid var(--border)',
                  borderRadius:'8px',
                  boxShadow:'var(--shadow-md)',
                  zIndex:20,
                  padding:'8px'
                }}>
                  <div className="hint" style={{marginBottom:'8px'}}>点击复选框选择签审人</div>
                  {userOptions.map(user => (
                    <label key={user.username} style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px'}}>
                      <input
                        type="checkbox"
                        checked={form.approvers?.includes(user.username)}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleApprover(user.username);
                        }}
                      />
                      <span>{user.display_name}（{user.department || '未分配'}）</span>
                    </label>
                  ))}
                  <div style={{display:'flex', justifyContent:'flex-end', gap:'8px', marginTop:'8px'}}>
                    <button
                      type="button"
                      className="btn small secondary"
                      onClick={(e)=>{
                        e.stopPropagation();
                        clearApprovers();
                      }}
                    >清空</button>
                    <button
                      type="button"
                      className="btn small"
                      onClick={(e)=>{
                        e.stopPropagation();
                        setApproverDropdownOpen(false);
                      }}
                    >确定</button>
                  </div>
                </div>
              )}
            </div>
            <div className="hint">支持多选，可指定多个签审人；不选择时沿用模板中的默认审批人配置。</div>
          </div>

          <div className="form-row">
            <label>附件</label>
            <input
              type="file"
              className="input"
              multiple
              onChange={handleFileUpload}
              disabled={submitting}
            />
            {files.length > 0 && (
              <div style={{ marginTop: 8 }}>
                {files.map(f => (
                  <div key={f.id} className="hint" style={{ marginBottom: 4 }}>
                    📎 {f.title}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button
              type="submit"
              className="btn"
              disabled={submitting || loading || !templates.length}
            >
              {submitting ? '提交中...' : '提交任务'}
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={submitting}
              onClick={() => {
                setForm(initialForm);
                setFiles([]);
                setOldInstanceId(null);
                setApproverDropdownOpen(false);
                setError('');
                setSuccess('');
              }}
            >
              重置
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

