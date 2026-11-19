(function(root){
const normal=s=>String(s||'').toLowerCase().replaceAll('ё','е').replace(/\s+/g,' ').trim();
function family(line,catalog=[]){
 if(line.kind!=='material')return '';
 const c=catalog.find(c=>c.id===line.catalogId),name=normal(line.name),text=normal(name+' '+(c?.category||'')+' '+(c?.details?.['Материал']||''));
 if(/антисептик|краска|пропитка|лак |герметик|саморез|болт|электрод|проволока/.test(name))return '';
 if(c?.sheet==='Пиломатериалы'||c?.sheet==='Фанера'||/^(?:доска|брус(?:ок)?(?:\s|$)|палубная доска|террасная доска|фанера|бревно)|деревян|пиломатериал|лиственниц|соснов/.test(name))return 'wood';
 if(/нержав|aisi|алюмин|оцинк|цинков|09г2с|дюрал|медн|латун|пвх|пластик/.test(text))return '';
 if(/г\s*\/\s*к|горячекатан/.test(text)&&/лист|сталь|стальн/.test(text)||/труба.*(?:профильн|квадратн|прямоугольн)/.test(text))return 'steel';
 return '';
}
const RULES={
 wood:[
  {key:'primer',label:'Грунт-антисептик Sikkens / SJ',ids:['Лакокрасочная_продукция:27','Лакокрасочная_продукция:28','Лакокрасочная_продукция:29','Лакокрасочная_продукция:30']},
  {key:'finish',label:'Финишное покрытие дерева',ids:['Лакокрасочная_продукция:34','Лакокрасочная_продукция:35','Лакокрасочная_продукция:36']},
  {key:'crosscut',label:'Распиловка на торцовке',custom:{id:'suggest-wood-crosscut',name:'Распиловка древесины на торцовочной пиле',kind:'work',unit:'н/ч',price:null}},
  {key:'chamfer',label:'Снятие фаски',ids:['Перечень_работ:185','Перечень_работ:186','Перечень_работ:158']},
  {key:'sanding',label:'Шлифовка поверхности',ids:['Перечень_работ:187','Перечень_работ:188']}
 ],
 steel:[
  {key:'blasting',label:'Дробеструйная обработка',ids:['Перечень_работ:18']},
  {key:'galvanizing',label:'Цинкование',ids:['Перечень_работ:190']},
  {key:'powder',label:'Порошковое окрашивание',ids:['Перечень_работ:93']}
 ]
};
function options(rule,catalog){return rule.custom?[rule.custom]:(rule.ids||[]).map(id=>catalog.find(c=>c.id===id)).filter(Boolean);}
function exists(lines,c,group,scope){return lines.some(l=>l.kind===c.kind&&l.group===group&&l.scope===scope&&(l.catalogId===c.id||normal(l.name)===normal(c.name)));}
function groups(lines,catalog){const result=[];for(const line of lines){const type=family(line,catalog);if(!type||result.some(g=>g.type===type&&g.group===line.group&&g.scope===line.scope))continue;result.push({type,group:line.group,scope:line.scope,rules:RULES[type]});}return result;}
function installationLines(s){return (s.lines||[]).filter(l=>l.installation===true||l.kind==='work'&&(l.costCategory==='installation'||!l.costCategory&&/монтаж|установк.*издел/i.test(l.name)));}
function installationRequired(s){return !!(s.requiredServices?s.requiredServices.installation:/монтаж|Комплексный/.test(s.scope));}
function installationNotice(s){if(!s.installationSpec?.reviewed)return 'Проверьте необходимость монтажа и заполните монтажную спецификацию либо отметьте, что монтаж не входит в заказ.';if(installationRequired(s)&&(!installationLines(s).some(l=>l.kind==='work')||!s.installationSpec.notes.trim()))return 'Монтаж входит в заказ: добавьте работы и заполните условия монтажной спецификации.';return '';}
root.MaterialSuggestionsCore={family,RULES,options,exists,groups,installationLines,installationRequired,installationNotice};
if(typeof module!=='undefined')module.exports=root.MaterialSuggestionsCore;
})(typeof window!=='undefined'?window:globalThis);
