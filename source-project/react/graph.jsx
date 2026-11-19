import React,{useCallback,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ReactFlow,Background,Controls,MiniMap,Handle,Position,applyNodeChanges} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './graph.css';

let root;
const measure=value=>value===null||value===undefined||!Number.isFinite(value)?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(value);

function CalculatorNode({data,selected}){
 const line=data.line,kind=line.kind==='material'&&!line.processBinding?'МАТЕРИАЛ':line.kind==='material'?'РАСХОДНИК':'ПРОЦЕСС';
 return <article className={'flow-node '+(line.kind==='material'?'flow-node-material':'flow-node-process')+' '+(selected?'flow-node-selected':'')}>
  <Handle type="target" position={Position.Left} id="input" aria-label={'Вход узла '+line.name}/>
  <button className="flow-node-head" type="button" onClick={()=>window.graphSelect(line.processKey)} aria-label={'Настроить узел '+line.name}>
   <small>{kind}</small><strong>{line.name||'Без названия'}</strong>
  </button>
  <div className="flow-node-body">
   <span className="small">{line.group} · {line.scope==='batch'&&!line.operation?'партия':'на изделие'}</span>
   <div className="flow-node-ports">
    <button type="button" className="nodrag" onClick={event=>{event.stopPropagation();window.graphInput(line.processKey)}} aria-label={'Вход узла '+line.name}>● Вход</button>
    <button type="button" className="nodrag" onClick={event=>{event.stopPropagation();window.graphOutput(line.processKey)}} aria-label={'Выход узла '+line.name}>Выход ●</button>
   </div>
   <div className="small">{line.operation?'Объём обработки: '+measure(data.effective?.operation?.[line.operation.mode==='machine'?'minutes':'measure']):'Объём: '+measure(data.effective?.qty)} {line.operation?data.targetUnit:line.unit}</div>
   <div className="flow-node-metric small">{data.physical?.error||'Площадь: '+measure(data.physical?.values?.area)+' м² · Масса: '+measure(data.physical?.values?.mass)+' кг'}</div>
   <div className="small">{data.binding}</div>
  </div>
  <Handle type="source" position={Position.Right} id="output" aria-label={'Выход узла '+line.name}/>
 </article>;
}
const nodeTypes={calculator:CalculatorNode};

function Graph({model}){
 const [nodes,setNodes]=useState(model.nodes);
 const onNodesChange=useCallback(changes=>setNodes(current=>applyNodeChanges(changes,current)),[]);
 const onNodeDragStop=useCallback((_,node)=>{
  const line=window.graphLine(node.id);if(!line)return;
  line.processPosition={x:Math.max(0,Math.min(20000,node.position.x)),y:Math.max(0,Math.min(20000,node.position.y))};
  window.persist();
 },[]);
 const onConnect=useCallback(connection=>{
  if(connection.source&&connection.target)window.graphBindingDialog(connection.target,connection.source);
 },[]);
 const onNodeClick=useCallback((_,node)=>window.graphSelect(node.id),[]);
 return <ReactFlow nodes={nodes} edges={model.edges} nodeTypes={nodeTypes} onNodesChange={onNodesChange} onNodeDragStop={onNodeDragStop} onNodeClick={onNodeClick} onConnect={onConnect} nodesConnectable={true} deleteKeyCode={null} minZoom={0.4} maxZoom={1.6} defaultViewport={{x:20,y:20,zoom:model.zoom}} aria-label="Схема материалов и процессов">
  <Background gap={20} size={1}/><Controls showInteractive={false}/><MiniMap pannable zoomable style={{width:130,height:100}} nodeColor={node=>node.data.line.kind==='material'?'#92b6a2':'#c8bb9d'}/>
 </ReactFlow>;
}

window.GraphReact={
 mount(host,model){if(!host||host.nodeType!==1)return false;this.unmount();host.innerHTML='';root=createRoot(host);root.render(<Graph model={model}/>);return true;},
 unmount(){if(root){root.unmount();root=null;}}
};
