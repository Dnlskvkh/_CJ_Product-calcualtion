(function(root){
/* Present existing validation messages without changing readiness or prices. */
function tasks(state,result,graphErrors=[]){
 const errors=new Set(result.errors||[]),scope=new Set(result.scopeIssues||[]),graph=new Set(graphErrors);
 const messages=[...new Set([...(result.errors||[]),...(result.warnings||[]),...(result.approvalIssues||[]),...(result.scopeIssues||[])])];
 return messages.map(message=>{
  const matches=(state.lines||[]).map((line,index)=>({line,index})).filter(x=>x.line.name&&message.startsWith(x.line.name+':'));
  const longest=Math.max(0,...matches.map(x=>x.line.name.length)),best=matches.filter(x=>x.line.name.length===longest),match=best.length===1?best[0]:null;
  let page=scope.has(message)?(/^Монтаж:/.test(message)?19:/^Изготовление:/.test(message)?2:0):3,field='',action='section';
  if(match){page=match.line.kind==='material'?1:2;action=graph.has(message)?'graph':match.line.operation?'operation':'line';
   if(action==='line'){if(/дата цены/.test(message))field='date';else if(/требуют согласования|требует подтверждения/.test(message))field='confirmed';else if(!match.line.processBinding){if(/объём/.test(message)&&match.line.qty===null)field='qty';else if(/цена|цену/.test(message))field='price';else if(/кратность/.test(message))field='pack';}}
  }else if(message==='Добавьте материалы или работы')page=1;else if(/^Партия /.test(message)){page=0;field='qty';}else if(best.length)page=best.every(x=>x.line.kind==='material')?1:2;
  return {message,severity:errors.has(message)?'error':'review',index:match?.index??-1,page,field,action};
 });
}
const api={tasks};if(typeof module==='object'&&module.exports)module.exports=api;root.ReadinessCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
