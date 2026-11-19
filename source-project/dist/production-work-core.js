(function(root){
const materialUnits=root.MaterialCore||(typeof require==='function'?require('./material-core.js'):null);
  const WORKSHOPS=['ЧПУ цех','Металлоцех','Древообработка','Лакокрасочный','Сборочный','Подрядные'];
  const text=v=>String(v??'').toLocaleLowerCase('ru-RU').replaceAll('ё','е');
  const sourceText=r=>text([r?.name,r?.category,r?.note,r?.details?.['Тип работ'],r?.details?.['Материал']].filter(Boolean).join(' '));
  function classifyWorkshop(record){
    const t=sourceText(record),type=text(record?.details?.['Тип работ']);
    if(/подряд/.test(type)||/подряд/.test(t))return {workshop:'Подрядные',source:'Тип работ/источник',fallback:false};
    if(/чпу|лазер|плазм|гидроабраз|фрезер|листогиб|вальц|станоч/.test(t))return {workshop:'ЧПУ цех',source:'Признак станочной обработки',fallback:false};
    if(/металл|свар|слесар|дробестру|цинк|пассивац|зачист|шлифовк.*шв/.test(t))return {workshop:'Металлоцех',source:'Признак металлообработки',fallback:false};
    if(/дерев|доск|фанер|бревн|пиломат|браширов|торцов/.test(t))return {workshop:'Древообработка',source:'Признак деревообработки',fallback:false};
    if(/лак|краск|грунт|эмал|порошков|покрыт|антисепт/.test(t))return {workshop:'Лакокрасочный',source:'Признак покрытия',fallback:false};
    return {workshop:'Сборочный',source:'Fallback: нет более точного признака',fallback:true};
  }
  function orderValue(line,index){return Number.isFinite(line?.productionOrder)?line.productionOrder:index;}
  function groupedWorkLines(lines){
    const groups=Object.fromEntries(WORKSHOPS.map(name=>[name,[]]));
    (lines||[]).filter(l=>l?.kind==='work').forEach((line,index)=>{const workshop=WORKSHOPS.includes(line.workshop)?line.workshop:'Сборочный';groups[workshop].push({...line,workshop,productionOrder:orderValue(line,index),_sourceIndex:index});});
    return WORKSHOPS.flatMap(workshop=>groups[workshop].sort((a,b)=>a.productionOrder-b.productionOrder||a._sourceIndex-b._sourceIndex).map(({_sourceIndex,...line})=>line));
  }
  function moveWorkLine(lines,id,direction){
    const list=lines||[],line=list.find(x=>x.id===id);if(!line||line.kind!=='work')return false;
    const same=list.filter(x=>x.kind==='work'&&(x.workshop||'Сборочный')===(line.workshop||'Сборочный')).sort((a,b)=>orderValue(a,list.indexOf(a))-orderValue(b,list.indexOf(b)));
    const i=same.findIndex(x=>x.id===id),j=i+direction;if(i<0||j<0||j>=same.length)return false;
    const a=same[i],b=same[j],ao=orderValue(a,list.indexOf(a)),bo=orderValue(b,list.indexOf(b));a.productionOrder=bo;b.productionOrder=ao;return true;
  }
  function reorderWorkLine(lines,id,targetId){
    const list=lines||[],line=list.find(x=>x.id===id),target=list.find(x=>x.id===targetId);if(!line||!target||line.kind!=='work'||target.kind!=='work'||id===targetId)return false;
    const workshop=line.workshop||'Сборочный';if(workshop!==(target.workshop||'Сборочный'))return false;
    const same=list.filter(x=>x.kind==='work'&&(x.workshop||'Сборочный')===workshop).sort((a,b)=>orderValue(a,list.indexOf(a))-orderValue(b,list.indexOf(b)));
    const from=same.indexOf(line),to=same.indexOf(target);if(from<0||to<0)return false;same.splice(from,1);same.splice(same.indexOf(target),0,line);same.forEach((item,index)=>{item.productionOrder=index});return true;
  }
  function normHours(line){
    const q=Number(line?.physicalQuantity),p=Number(line?.productivity),unit=String(line?.physicalUnit||''),pUnit=String(line?.productivityUnit||'');
    if(line?.productivityStatus!=='approved')return {enabled:false,reason:line?.productivityStatus||'missing'};
    if(!Number.isFinite(q)||q<0)return {enabled:false,reason:'invalid_quantity'};
    if(!Number.isFinite(p)||p<=0)return {enabled:false,reason:'invalid_productivity'};
    if(!materialUnits.sameUnit(unit,pUnit))return {enabled:false,reason:'unit_mismatch'};
    return {enabled:true,value:q/p};
  }
  root.ProductionWorkCore={WORKSHOPS,classifyWorkshop,groupedWorkLines,moveWorkLine,reorderWorkLine,normHours};
  if(typeof module!=='undefined')module.exports=root.ProductionWorkCore;
})(typeof window!=='undefined'?window:globalThis);
