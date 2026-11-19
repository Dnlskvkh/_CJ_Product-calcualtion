function readinessTasks(){const result=CostEngine.calculate(state);return ReadinessCore.tasks(state,result,ProcessGraphCore.resolve(state).errors);}
function readinessOpen(index){
 const task=readinessTasks()[index];if(!task)return;const line=state.lines[task.index];
 if(task.action==='graph'&&line?.processKey){go(20);graphSelect(line.processKey);graphBindingDialog(line.processKey);return;}
 go(task.page);
 if(task.action==='operation'&&line){operationDialog(line.id);return;}
 if(task.action==='line'&&line){editLine(line.id);if(task.field){const input=$('l-'+task.field);input?.closest('details')?.setAttribute('open','');input?.focus();}return;}
 if(task.field)$('f-'+task.field)?.focus();
}
function readinessHTML(){const tasks=readinessTasks(),errors=tasks.filter(x=>x.severity==='error'),review=tasks.filter(x=>x.severity!=='error');return '<div id="readiness-tasks" tabindex="-1"><h3>Что осталось проверить</h3><p class="small">Ошибки расчёта: '+errors.length+' · Проверка и согласование: '+review.length+'</p>'+[['Заполнить для расчёта',errors],['Проверить перед согласованием',review]].filter(([,items])=>items.length).map(([label,items])=>'<details open><summary>'+label+' · '+items.length+'</summary>'+items.map(task=>'<div class="issue"><div>'+esc(task.message)+'</div><button type="button" onclick="readinessOpen('+tasks.indexOf(task)+')">'+(task.action==='section'?'Открыть раздел':'Исправить позицию')+' →</button></div>').join('')+'</details>').join('')+(!tasks.length?'<p>Замечаний по данным нет. Проверьте комплектность изделия и согласуйте версию.</p>':'')+'</div>';}
/* Single full queue on the result. Keep the existing approval action and amounts. */
(function(){const previousPanel=reviewPanel;reviewPanel=function(){const html=previousPanel();return html.replace(/<div class="issue">[\s\S]*?<\/div>/g,'').replace('</p>','</p>'+readinessHTML());};})();
interactiveIssuesHTML=function(){return '<p>Все замечания собраны в списке «Что осталось проверить».</p><button onclick="document.getElementById(\'readiness-tasks\')?.scrollIntoView({block:\'start\'});document.getElementById(\'readiness-tasks\')?.focus()">К списку проверки ↑</button>';};
function materialRouteRecommendationsHTML(){
 const sources=state.lines.map((line,index)=>({line,index,rules:ProcessRecommendationsCore.rules(line,state.lines,CATALOG)})).filter(x=>x.line.kind==='material'&&!x.line.processBinding&&x.rules.length);
 if(!sources.length)return '';
 return '<section class="card" id="material-suggestions"><h2>Процессы для материалов</h2><p class="small">Выберите материал. Рекомендации откроются в его карточке; добавленный процесс будет связан с этим материалом. Нужные операции выбираются по проекту.</p>'+sources.map(({line,index})=>'<div class="metricline"><div><b>'+esc(line.name)+'</b><span class="source">'+esc(line.group)+' · '+(line.scope==='batch'?'Вся партия':'На изделие')+'</span></div><button onclick="materialRouteOpen('+index+')">Выбрать процессы</button></div>').join('')+'</section>';
}
function materialRouteOpen(index){const line=state.lines[index];if(!line)return;editLine(line.id);const details=document.querySelector('#lineForm .graph-recommendations');if(details){details.open=true;details.querySelector('summary')?.focus();details.scrollIntoView({block:'nearest'});}}
