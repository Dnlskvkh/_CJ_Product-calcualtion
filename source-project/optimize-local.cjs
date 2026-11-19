const fs=require('node:fs'),path=require('node:path');
const dir='optimization-2026-11-06';fs.mkdirSync(dir+'/before',{recursive:true});
function edit(file,fn){const s=fs.readFileSync(file,'utf8');const backup=dir+'/before/'+file;fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.writeFileSync(backup,s);fs.writeFileSync(file,fn(s.replaceAll("\r\n","\n")));}
function rep(s,a,b){if(!s.includes(a))throw Error('Missing: '+a.slice(0,100));return s.replace(a,b);}
edit('dist/app.js',s=>{
 s=rep(s,'function addCatalog(id)',"let pendingNewLine=null;\nfunction editableLine(id){return state.lines.find(x=>x.id===id)||(pendingNewLine?.id===id?pendingNewLine:null);}\nfunction addCatalog(id)");
 s=rep(s,"state.lines.push(l);persist();$('modal').close();editLine(l.id)","pendingNewLine=l;$('modal').close();editLine(l.id)");
 s=rep(s,'state.lines.push(l);persist();editLine(l.id)','pendingNewLine=l;editLine(l.id)');
 s=rep(s,'function editLine(id){const l=state.lines.find(x=>x.id===id);','function editLine(id){const l=editableLine(id);');
 s=rep(s,"typeof materialToolsHTML==='function'?materialToolsHTML(l):''","pendingNewLine!==l&&typeof materialToolsHTML==='function'?materialToolsHTML(l):''");
 s=rep(s,'<button type="button" class="textbutton" onclick="sourcePicker', '<button type="button" ${pendingNewLine===l?\'hidden\':\'\'} class="textbutton" onclick="sourcePicker');
 s=rep(s,'const l=state.lines.find(x=>x.id===id),copy={...l};','const l=editableLine(id);if(!l)return false;const copy={...l};');
 s=rep(s,"Object.assign(l,copy);persist();$('modal').close();render()","Object.assign(l,copy);if(pendingNewLine===l){state.lines.push(l);pendingNewLine=null;}persist();$('modal').close();render()");
 s=rep(s,'function removeLine(id){','function removeLine(id){if(pendingNewLine?.id===id){pendingNewLine=null;$(\'modal\').close();return;}');
 s=rep(s,"function set(k,v){state[k]=v;", "function set(k,v){state[k]=v;if(k==='scope')state.requiredServices={design:/Проектирование|Комплексный/.test(v),installation:/монтаж|Комплексный/.test(v),delivery:/Комплексный/.test(v)};");
 s=rep(s,"if(k==='qty'||page===3)","if(k==='qty'||k==='scope'||page===3)");
 s=rep(s,'<label for="f-scope">Состав заказа</label>','<label for="f-scope">Шаблон состава заказа</label>');
 s=rep(s,'<div class="layout"><section>${body}${nextbar()}</section><section>${summary()}</section></div>','<div class="calculation-form">${body}${nextbar()}</div>');
 s=rep(s,'В себестоимости партии','Затраты / цена услуги на партию');
 return s;
});
for(const file of ['dist/review-ui.js','dist/input-assistant.js','dist/material-suggestions.js'])edit(file,s=>s.replaceAll('state.lines.find(x=>x.id===id)','editableLine(id)').replaceAll('state.lines.find(l=>l.id===id)','editableLine(id)'));
edit('dist/review-ui.js',s=>{
 s=rep(s,"[0,6,11,16].includes(page)","[6,11,16].includes(page)");
 s=rep(s,"function serviceSetting(k,v){", "function serviceSetting(k,v){");
 s=rep(s,"[k]:v};persist();render();}","[k]:v};const r=state.requiredServices;state.scope=r.delivery?'Комплексный заказ':r.installation?'Изготовление и монтаж':r.design?'Проектирование и изготовление':state.type==='Сервисные работы'?'Сервис':'Изготовление';persist();render();}");
 s=rep(s,"$('app').append(card);}\nif(page===3)","const scope=$('f-scope');if(scope?.closest){scope.closest('.field').hidden=true;const host=document.querySelector('.calculation-form > .card');if(host)host.append(card);else $('app').append(card);}else $('app').append(card);}\nif(page===3)");
 // Status already appears in the compact overview and the result review queue.
 s=s.replace(/if\(\[0,1,2,3\]\.includes\(page\)\)\{const r=CostEngine\.calculate\(state\);const badge=[^\n]+\n/,'');
 return s;
});
edit('dist/pro-core.js',s=>{
 s=rep(s,'return {result:r,valid:true,unit,netUnit,profit,margin:',"return {result:r,valid:true,profitIncomplete:!!r.profitIncomplete,unit,netUnit,knownCostSurplus:profit,profit:r.profitIncomplete?null:profit,margin:r.profitIncomplete?null:");
 s=rep(s,'markup:r.costUnit?', 'markup:r.profitIncomplete?null:r.costUnit?');
 s=rep(s,'breakEven:r.costUnit*', 'breakEven:r.profitIncomplete?null:r.costUnit*');
 s=rep(s,'return {rows,issues,cash:', 'return {rows,issues,calculationCash:r.cash,cash:');
 return s;
});
edit('dist/pro.js',s=>{
 s=rep(s,"function refreshTarget(){const t=ProCore.target(state,analysisQty,priceTarget,CostEngine.calculate);", "function refreshTarget(){const t=ProCore.target(state,analysisQty,priceTarget,CostEngine.calculate);if(t.valid&&t.profitIncomplete){$('targetMetrics').innerHTML=`<div class=\"note\"><b>Прибыль и порог безубыточности неизвестны</b><p>В заказе есть услуги с готовой ценой заказчику без внутренних затрат. Заполните их затраты для анализа прибыли.</p><p>Предложение на ${analysisQty} шт. с НДС: ${money(t.total)}.</p></div>`;return;}");
 s=rep(s,'function renderTarget(){const r=', 'function renderTarget(){analysisQty=state.qty;priceTarget=null;const r=');
 s=rep(s,"${p.issues.map(x=>`<div class=\"issue\">${esc(x)}</div>`).join('')}","<p class=\"small\">Калькуляционная закупка по отдельным строкам: ${money(p.calculationCash)}. План объединяет одинаковые материалы и учитывает склад: ${money(p.cash)}${p.partial?' (известная часть)':''}. План не меняет себестоимость и сохранённую цену заказа.</p>${p.issues.map(x=>`<div class=\"issue\">${esc(x)}</div>`).join('')}");
 return s;
});
edit('dist/process-graph.js',s=>rep(s,"window.GraphReact?.unmount();graphEnsureKeys();", "window.GraphReact?.unmount();if(state.lines.some(l=>!l.processKey)){ $('app').innerHTML=title('Материал → процесс','Технологическая схема','Связи управляют объёмами работ.','Настройка')+`<div class=\"card\"><h2>Подготовить состав к связям</h2><p>Позиций: ${state.lines.length}. Включение схемы добавит идентификаторы и доступные характеристики материалов; потребуется повторная проверка и согласование.</p><button class=\"primary\" onclick=\"graphEnsureKeys();render()\">Включить связи для текущего состава</button><button onclick=\"go(2)\">К списку работ</button></div>`;return;}"));
edit('dist/workspace.js',s=>{
 s=rep(s,"+' шт.</span><span>'", "+' шт. · '+esc(known)+'</span><span>'");
 s=rep(s,"[20,'Технологическая схема'],",'');
 return s;
});
edit('dist/brand.css',s=>s+`\n/* One compact price summary; details stay available on demand. */\n@media screen{\n .workspace-overview .overview-toggle{display:flex;width:100%;align-items:center;justify-content:space-between;gap:12px;min-height:48px;text-align:left;background:#fff;color:#222;border:1px solid #ddd;padding:12px 16px}\n .workspace-overview .overview-toggle>span:last-child{color:#555}\n .workspace-overview .overview-grid{display:none;margin-top:12px}\n .workspace-overview .overview-grid.expanded{display:grid}\n .calculation-form{max-width:1100px}\n .calculation-form>.card>.card{box-shadow:none;border:0;border-top:1px solid #ddd;padding:20px 0 0;margin:20px 0 0}\n}\n`);
console.log('Local optimization applied; originals in '+dir+'/before');
