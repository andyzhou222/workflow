import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  getConnectedEdges,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import NodePanel from '../components/NodePanel';
import NodeEditor from '../components/NodeEditor';
import api from '../api';
import { useLocation, useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

const nodeTypes = {}; // default nodes

export default function TemplateDesigner(){
  // 解决了 Uncaught SyntaxError: The requested module '...' does not provide an export named 'default' 的错误

  const nav = useNavigate();
  const location = useLocation();
  const presetTemplateId = location.state?.templateId;
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const rfRef = useRef(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    // if a templateId passed, load from backend
    if(presetTemplateId){
      loadTemplate(presetTemplateId);
    } else {
      // start with blank canvas
      const nid = 'start-' + uuidv4().slice(0,6);
      setNodes([{ id: nid, position: { x: 50, y: 50 }, data: { label: 'Start' }, type: 'default', draggable: true, sourcePosition: 'right', targetPosition: 'left', nodeType: 'start' }]);
    }
  }, []);

  // IMPORTANT: Since alert() is forbidden in this environment, replace it with console.error or a proper UI feedback mechanism.
  // Replacing `alert()` with a simple log/error for now. In a real app, this should be a notification component.
  function showFeedback(message, isError = false) {
    if (isError) {
      console.error('ERROR:', message);
    } else {
      console.log('SUCCESS:', message);
    }
    // You should add code here to display this message in a modal or notification.
    // window.alert(message); // <- DO NOT USE THIS
  }


  async function loadTemplate(tid){
    setLoading(true);
    try{
      const r = await api.get(`/templates`);
      const tpl = (r.data || []).find(t=>t.id === tid);
      if(!tpl) { showFeedback('模板未找到', true); setLoading(false); return; }
      setName(tpl.name);
      const def = tpl.definition;
      // convert definition to nodes/edges for reactflow
      const mapNodes = def.nodes.map((n, idx)=>({
        id: n.id,
        position: {x: 50 + idx*180, y: 60},
        data: { label: `${n.type.toUpperCase()}${n.meta && n.meta.assignee ? ` (${n.meta.assignee})` : ''}`, meta: n.meta || {} },
        type: 'default',
      }));
      const mapEdges = def.edges.map((e, idx)=>({
        id: `e-${e.from}-${e.to}-${idx}`,
        source: e.from,
        target: e.to,
        markerEnd: { type: MarkerType.ArrowClosed },
      }));
      setNodes(mapNodes);
      setEdges(mapEdges);
    }catch(e){
      showFeedback('加载模板失败：' + (e?.response?.data?.detail || e.message), true);
    }finally{ setLoading(false); }
  }

  const onNodesChange = useCallback((changes) => setNodes((nds)=>applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges((eds)=>applyEdgeChanges(changes, eds)), []);
  const onConnect = useCallback((params) => setEdges((eds)=>addEdge({...params, markerEnd:{ type: MarkerType.ArrowClosed }}, eds)), []);

  function addNode(type){
    const id = type + '-' + uuidv4().slice(0,6);
    const node = {
      id,
      position: { x: Math.random()*400, y: Math.random()*200 },
      data: { label: type === 'approve' ? 'Approve' : type === 'start' ? 'Start' : 'End', meta: {} },
      type: 'default',
    };
    setNodes(nds => nds.concat(node));
  }

  function onSelectionChange(sel){
    if(sel && sel.nodes && sel.nodes.length > 0){
      const n = sel.nodes[0];
      setSelectedNode(n);
    } else setSelectedNode(null);
  }

  function updateNode(updated){
    setNodes(nds => nds.map(n => {
      if (n.id === updated.id) {
        // 确保 meta 被正确合并
        const newData = { ...n.data, ...updated.data };
        if (updated.data?.meta) {
          newData.meta = { ...(n.data?.meta || {}), ...updated.data.meta };
        }
        return { ...n, data: newData };
      }
      return n;
    }));
  }

  function exportDefinition(){
    // convert nodes/edges back to template definition
    const defNodes = nodes.map(n=>{
      const meta = n.data?.meta || {};
      let t = 'approve';
      if(n.data.label && n.data.label.toLowerCase().includes('start')) t = 'start';
      if(n.data.label && n.data.label.toLowerCase().includes('end')) t = 'end';
      return { id: n.id, type: t, meta };
    });
    const defEdges = edges.map(e=>({ from: e.source, to: e.target }));
    return { nodes: defNodes, edges: defEdges };
  }

  async function saveTemplate(){
    if(!name) return showFeedback('请填写模板名称', true);
    const def = exportDefinition();
    setLoading(true);
    try{
      await api.post('/templates', { name, definition: def });
      showFeedback('保存成功');
      nav('/templates');
    }catch(e){
      showFeedback('保存失败: ' + (e?.response?.data?.detail || e.message), true);
    }finally{ setLoading(false); }
  }

  async function startProcessFromTemplate(){
    // if a template id exists it will be loaded from presetTemplateId; else create a temp template on backend first
    const def = exportDefinition();
    if(!name) return showFeedback('请先填写模板名称', true);
    setLoading(true);
    try{
      // create template
      const r = await api.post('/templates', { name: name + ' (transient)', definition: def });
      const tid = r.data.id;
      const s = await api.post('/instances/start', { template_id: tid, data: { demo: true }});
      showFeedback('流程已发起，实例id: ' + s.data.instance.id);
    }catch(e){
      showFeedback('发起失败: ' + (e?.response?.data?.detail || e.message), true);
    }finally{ setLoading(false); }
  }

  // Helper function to safely copy text (replacing alert with console.log)
  function copyJsonToClipboard(){
    const json = JSON.stringify(exportDefinition(), null, 2);
    // Use the safer document.execCommand('copy') fallback for clipboard operations
    const dummyElement = document.createElement("textarea");
    document.body.appendChild(dummyElement);
    dummyElement.value = json;
    dummyElement.select();
    document.execCommand('copy');
    document.body.removeChild(dummyElement);

    showFeedback('JSON copied to clipboard');
  }

  return (
    <div>
      <div className="page-header">
        <h1>流程设计器</h1>
        <p>拖拽节点创建您的工作流程</p>
      </div>
      <div style={{display:'flex', gap: '20px', height: 'calc(100vh - 200px)'}}>
        <div style={{width: 240}} className="card">
        <NodePanel onAdd={addNode}/>
          <div style={{marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)'}}>
          <div className="form-row">
              <label>模板名称</label>
              <input 
                className="input" 
                value={name} 
                onChange={e=>setName(e.target.value)}
                placeholder="输入模板名称"
              />
          </div>
            <div style={{display:'flex', flexDirection: 'column', gap: 8}}>
              <button 
                className="btn small" 
                onClick={saveTemplate}
                disabled={loading || !name}
              >
                {loading ? '保存中...' : '💾 保存模板'}
              </button>
              <button 
                className="btn small secondary" 
                onClick={startProcessFromTemplate}
                disabled={loading || !name}
              >
                ▶️ 启动流程
              </button>
              <button 
                className="btn small secondary" 
                onClick={copyJsonToClipboard}
              >
                📋 导出 JSON
              </button>
          </div>
        </div>
      </div>

        <div style={{flex:1, padding: 0, overflow: 'hidden'}} className="card">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange}
          fitView
          style={{width:'100%', height:'100%'}}
        >
          <MiniMap />
          <Controls />
          <Background />
        </ReactFlow>
      </div>

        <div style={{width: 320}}>
        <NodeEditor node={selectedNode} onChange={(n)=>updateNode(n)} />
        </div>
      </div>
    </div>
  );
}