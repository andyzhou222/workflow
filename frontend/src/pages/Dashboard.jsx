import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';

const initialStats = {
  instances: { running: 0, approved: 0, rejected: 0 },
  instances_total: 0,
  pending_tasks: 0,
  today_tasks: 0,
  overdue_tasks: 0,
  view_scope: 'self',
  view_department: '',
  user_summary: [],
};

export default function Dashboard(){ 
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(()=>{
    let timer;
    const fetchStats = async () => {
      try{
        const r = await api.get('/dashboard/stats');
        setStats(r.data || initialStats);
        setError('');
      }catch(e){
        setError('加载统计数据失败：' + (e?.response?.data?.detail || e.message));
      }finally{
        setLoading(false);
      }
    };
    fetchStats();
    timer = setInterval(fetchStats, 15000);
    return () => clearInterval(timer);
  }, []);

  const barData = useMemo(()=>[
    { label: '进行中', value: stats.instances.running || 0, color: '#3370ff' },
    { label: '已完成', value: stats.instances.approved || 0, color: '#22c55e' },
    { label: '已驳回', value: stats.instances.rejected || 0, color: '#f97316' },
  ], [stats]);

  const pieData = useMemo(()=>[
    { label: '我发起的流程', value: stats.instances_total || 0, color: '#3370ff' },
    { label: '待办任务', value: stats.pending_tasks || 0, color: '#f97316' },
  ], [stats]);

  const totalPie = pieData.reduce((sum, item)=>sum + item.value, 0);
  const pieSegments = [];
  if(totalPie === 0){
    pieSegments.push(
      <div key="empty" style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', borderRadius:'50%', background:'#e5e6eb'}}></div>
    );
  }else{
    let startAngle = 0;
    pieData.forEach(item => {
      const angle = (item.value / totalPie) * 360;
      const gradient = `conic-gradient(${item.color} ${startAngle}deg ${startAngle+angle}deg, transparent ${startAngle+angle}deg 360deg)`;
      pieSegments.push(
        <div key={item.label} style={{position:'absolute', top:0, left:0, width:'100%', height:'100%', borderRadius:'50%', backgroundImage:gradient}}></div>
      );
      startAngle += angle;
    });
  }

  const renderRoleTag = (role) => {
    switch (role) {
      case 'admin':
        return { text: '系统管理员', color: '#f53f3f' };
      case 'company_admin':
        return { text: '公司管理员', color: '#f53f3f' };
      case 'dept_admin':
        return { text: '部门管理员', color: '#3370ff' };
      default:
        return { text: '普通用户', color: 'var(--text-secondary)' };
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>仪表盘</h1>
        <p>查看流程运行情况与待办统计</p>
      </div>
      {error && (
        <div style={{ padding: 12, background: '#fff4f4', border: '1px solid #ffccc7', borderRadius: 8, color: '#d93026', marginBottom: 16 }}>
          {error}
        </div>
      )}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px'}}>
        <div className="card">
          <h3 style={{fontSize: '18px', fontWeight: 600, marginBottom: '12px'}}>流程统计</h3>
          <div style={{display: 'flex', alignItems: 'flex-end', gap: 12, height: 180}}>
            {barData.map(item => (
              <div key={item.label} style={{flex:1, textAlign:'center'}}>
                <div style={{height: item.value * 8, background:item.color, borderRadius: 6}}></div>
                <div className="hint" style={{marginTop:8}}>{item.label}</div>
                <div style={{fontWeight:600}}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <h3 style={{fontSize: '18px', fontWeight: 600, marginBottom: '12px'}}>待办任务</h3>
          <div style={{display:'flex', alignItems:'center', gap:20}}>
            <div style={{width:140, height:140, position:'relative'}}>
              {pieSegments}
              <div style={{position:'absolute', top:'25%', left:'25%', width:'50%', height:'50%', background:'#fff', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600}}>{totalPie}</div>
            </div>
            <div>
              {pieData.map(item => (
                <div key={item.label} style={{display:'flex', alignItems:'center', marginBottom:8}}>
                  <span style={{width:10, height:10, borderRadius:'50%', background:item.color, marginRight:8}}></span>
                  <span style={{flex:1}} className="hint">{item.label}</span>
                  <span style={{fontWeight:600}}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="hint" style={{marginTop:12}}>
            {stats.view_scope === 'all' ? '系统统计：查看所有用户的数据' : 
              stats.view_scope === 'department' ? `部门统计：查看 ${stats.view_department || '当前部门'} 的数据` :
              '实时统计：仅查看我的流程与任务'}
            ，我发起 {stats.instances_total} 个流程，待办 {stats.pending_tasks} 个任务。
          </div>
        </div>
        <div className="card">
          <h3 style={{fontSize: '18px', fontWeight: 600, marginBottom: '12px'}}>任务提醒</h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: '16px'}}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              background: 'var(--primary-light)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--primary)'
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <span style={{fontSize: '24px'}}>📅</span>
                <div>
                  <div style={{fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)'}}>今日待办</div>
                  <div className="hint" style={{fontSize: '12px'}}>截止日期为今天的任务</div>
                </div>
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 600,
                color: 'var(--primary)',
                minWidth: '40px',
                textAlign: 'center'
              }}>
                {stats.today_tasks || 0}
              </div>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              background: '#fff4f4',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid #ffccc7'
            }}>
              <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                <span style={{fontSize: '24px'}}>⚠️</span>
                <div>
                  <div style={{fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)'}}>已超时任务</div>
                  <div className="hint" style={{fontSize: '12px'}}>已超过截止日期的任务</div>
                </div>
              </div>
              <div style={{
                fontSize: '24px',
                fontWeight: 600,
                color: '#f53f3f',
                minWidth: '40px',
                textAlign: 'center'
              }}>
                {stats.overdue_tasks || 0}
              </div>
            </div>
          </div>
        </div>
        {(stats.view_scope === 'all' || stats.view_scope === 'department') && (
          <div className="card">
            <h3 style={{fontSize: '18px', fontWeight: 600, marginBottom: '12px'}}>
              {stats.view_scope === 'all' ? '全部用户任务情况' : `部门任务情况（${stats.view_department || '未设置部门'}）`}
            </h3>
            {(!stats.user_summary || stats.user_summary.length === 0) ? (
              <div className="empty-state" style={{padding: '40px 0'}}>
                <div className="empty-state-icon">👥</div>
                <p className="hint">暂无用户待办数据</p>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '16px',
                width: '100%'
              }}>
                {(stats.user_summary || []).map(user => {
                  const roleInfo = renderRoleTag(user.role);
                  return (
                    <div key={user.username} className="card" style={{border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)'}}>
                      <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px'}}>
                        <div>
                          <div style={{fontWeight:600, fontSize:'15px', color:'var(--text-primary)'}}>{user.display_name || user.username}</div>
                          <div style={{fontSize:'13px', color:'var(--text-secondary)'}}>{user.department || '未设置部门'}</div>
                        </div>
                        <span style={{
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          color: '#fff',
                          background: roleInfo.color,
                          whiteSpace: 'nowrap'
                        }}>{roleInfo.text}</span>
                      </div>
                      <div style={{display:'flex', gap:'12px', justifyContent:'space-between'}}>
                        <div style={{
                          flex:1,
                          background:'var(--primary-light)',
                          borderRadius:'var(--radius-sm)',
                          padding:'8px',
                          textAlign:'center'
                        }}>
                          <div className="hint" style={{fontSize:'12px'}}>待办总数</div>
                          <div style={{fontWeight:600, color:'var(--primary)', fontSize:'18px'}}>{user.total_pending || 0}</div>
                        </div>
                        <div style={{
                          flex:1,
                          background:'var(--bg)',
                          borderRadius:'var(--radius-sm)',
                          padding:'8px',
                          textAlign:'center'
                        }}>
                          <div className="hint" style={{fontSize:'12px'}}>今日截止</div>
                          <div style={{fontWeight:600, fontSize:'18px'}}>{user.today_tasks || 0}</div>
                        </div>
                        <div style={{
                          flex:1,
                          background:'#fff4f4',
                          borderRadius:'var(--radius-sm)',
                          padding:'8px',
                          textAlign:'center'
                        }}>
                          <div className="hint" style={{fontSize:'12px'}}>已超时</div>
                          <div style={{fontWeight:600, fontSize:'18px', color: user.overdue_tasks ? '#f53f3f' : 'var(--text-secondary)'}}>{user.overdue_tasks || 0}</div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  ) 
}
