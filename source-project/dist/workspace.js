var workspaceOverviewOpen=false;
/* Read-only workspace overview; the calculation and archive own all amounts. */
(function(){
  function updateWorkspaceOverview(){
    const target=$('workspaceOverview');
    if(!target)return;
    const r=typeof CalculationArchive!=='undefined'?CalculationArchive.result(state):CostEngine.calculate(state);
    const hasLines=state.lines.length>0,known=r.partial?'Известная часть':r.preliminary===false?'Согласованный расчёт':'Предварительный расчёт';
    const arrow='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg>';
    const items=[
      {label:'Цена изделия с НДС',value:hasLines?money(r.unit):'—',caption:hasLines?known:'Добавьте материалы и работы',page:4,price:true},
      {label:'Себестоимость партии',value:hasLines?money(r.C):'—',caption:hasLines?(r.partial?'Известные затраты · ':'')+dec(state.qty)+' шт.':'Состав пока не заполнен',page:15},
      {label:'Материалы',value:hasLines?money(r.M):'—',caption:'Позиций в расчёте: '+state.lines.filter(l=>l.kind==='material').length,page:1},
      {label:'Работы и проектирование',value:hasLines?money(r.W):'—',caption:'Позиций в расчёте: '+state.lines.filter(l=>l.kind==='work').length,page:2}
    ];
    target.innerHTML='<button class="overview-toggle" onclick="workspaceToggleOverview()" aria-expanded="'+workspaceOverviewOpen+'" aria-controls="overviewGrid"><span>Цена с НДС: <b>'+esc(items[0].value)+'</b> · '+esc(dec(state.qty))+' шт. · '+esc(known)+'</span><span>'+(workspaceOverviewOpen?'Скрыть':'Подробнее')+'</span></button><div id="overviewGrid" class="overview-grid'+(workspaceOverviewOpen?' expanded':'')+'">'+items.map(x=>'<button class="overview-item'+(x.price?' overview-price':'')+'" onclick="go('+x.page+')" aria-label="'+esc(x.label+': '+x.value+'. '+x.caption)+'"><span class="overview-label">'+x.label+arrow+'</span><span class="overview-value">'+esc(x.value)+'</span><span class="overview-caption">'+esc(x.caption)+'</span></button>').join('')+'</div>';
  }
  const previousRender=render;
  render=function(){previousRender();updateWorkspaceOverview();};
  const previousSummary=refreshSummary;
  refreshSummary=function(){previousSummary();updateWorkspaceOverview();};
  updateWorkspaceOverview();
})();

/* Workflow controls keep navigation separate from calculation data. */
function workspaceToggleOverview(){
  workspaceOverviewOpen=!workspaceOverviewOpen;
  const grid=$('overviewGrid'),button=document.querySelector('.overview-toggle');
  grid?.classList.toggle('expanded',workspaceOverviewOpen);
  button?.setAttribute('aria-expanded',String(workspaceOverviewOpen));
  if(button)button.lastElementChild.textContent=workspaceOverviewOpen?'Скрыть':'Подробнее';
}
function workspaceToggleNav(force){
  const nav=$('nav'),toggle=document.querySelector('.nav-toggle');
  if(!toggle)return;
  const open=typeof force==='boolean'?force:toggle.getAttribute('aria-expanded')!=='true';
  nav.classList.toggle('nav-open',open);toggle.setAttribute('aria-expanded',String(open));
}
(function(){
  const groups=[
    ['Расчёт изделия',[[0,'1 · Заказ'],[1,'2 · Материалы и детали'],[2,'3 · Изготовление'],[19,'4 · Монтаж'],[4,'5 · Проверка и цена']]],
    ['Изделия и КП',[[7,'База изделий'],[8,'Коммерческое предложение'],[9,'Реестр КП'],[18,'Реестр проектов']]],
    ['Дополнительные инструменты',[[5,'Аналитика партии'],[12,'Сравнение вариантов'],[13,'Целевая цена'],[14,'План закупки'],[15,'Структура стоимости']]],
    ['Настройки и данные',[[6,'Справочники'],[11,'Закупочные цены'],[16,'Источники цен'],[17,'Сервер и копии']]]
  ];
  const groupOpen=new Map();
  function enhance(){
    if(!document.querySelector)return;
    const nav=$('nav');
    nav.innerHTML=groups.map(([name,items])=>'<details class="nav-group" '+(groupOpen.get(name)||items.some(([id])=>id===page)?'open':'')+'><summary>'+name+'</summary>'+items.map(([id,label])=>'<button '+(id===17?'id="cloudNav" ':'')+'class="'+(id===page?'active':'')+'" '+(id===page?'aria-current="page" ':'')+'onclick="go('+id+')">'+label+'</button>').join('')+'</details>').join('');
    nav.querySelectorAll('.nav-group').forEach((group,i)=>group.addEventListener('toggle',()=>groupOpen.set(groups[i][0],group.open)));
    document.querySelectorAll('#app h1').forEach(h=>h.setAttribute('tabindex','-1'));
    const status=$('saveState');if(window.draftSaveFailed)status.textContent='Не удалось сохранить черновик. Скачайте JSON.';
  }
  const previousRender=render;
  render=function(){previousRender();enhance();};
  function focusMain(){
    const heading=document.querySelector?.('#app h1');
    if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
  }
  const previousGo=go;
  go=function(n){
    previousGo(n);
    if(window.history?.pushState&&location.hash!=='#/section/'+n)history.pushState(null,'','#/section/'+n);
    if(document.querySelector){workspaceToggleNav(false);focusMain();}
  };
  function restoreRoute(){
    const match=String(location.hash||'').match(/^#\/section\/(\d+)$/),n=match?Number(match[1]):-1;
    if(([3,20].includes(n)||groups.some(([,items])=>items.some(([id])=>id===n)))&&n!==page){previousGo(n);if(document.querySelector){workspaceToggleNav(false);focusMain();}}
  }
  window.addEventListener('popstate',restoreRoute);
  window.addEventListener('hashchange',restoreRoute);
  const previousEdit=editLine;
  editLine=function(id){
    previousEdit(id);
    if(!document.querySelector)return;
    const form=$('lineForm');if(!form||form.querySelector('.line-advanced'))return;
    const essential=new Set();
    for(const key of ['l-name','l-qty','l-unit','l-price','l-scope','l-group','l-materialType','l-confirmed','reviewCategory','reviewPricing','lineError']){
      let node=$(key);if(!node||!form.contains(node))continue;
      while(node.parentElement!==form)node=node.parentElement;
      essential.add(node);
    }
    const recommendations=form.querySelector('.graph-recommendations');if(recommendations)essential.add(recommendations);
    const actions=form.querySelector('button[type="submit"]')?.closest('.mini-actions');
    const advanced=document.createElement('details');advanced.className='line-advanced';
    const heading=document.createElement('summary');heading.textContent='Дополнительные параметры и источник';advanced.append(heading);
    for(const child of [...form.children])if(!essential.has(child)&&child!==actions)advanced.append(child);
    form.insertBefore(advanced,actions||$('lineError'));
    $('l-qty')?.focus();
  };
  const previousGraphSelect=graphSelect;
  graphSelect=function(key){
    previousGraphSelect(key);
    if(!document.querySelector)return;
    const inspector=$('graph-inspector');inspector?.setAttribute('tabindex','-1');
    inspector?.focus({preventScroll:true});
    if(window.matchMedia('(max-width: 1099px)').matches)inspector?.scrollIntoView({block:'start',behavior:'auto'});
  };
  enhance();restoreRoute();
  if(window.history?.replaceState&&!/^#\/section\/\d+$/.test(location.hash||''))history.replaceState(null,'','#/section/'+page);
  document.querySelector?.('.brand')?.addEventListener('click',event=>{event.preventDefault();go(0);});
})();
