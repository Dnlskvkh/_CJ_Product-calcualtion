(function(root){
const num=x=>typeof x==='number'&&Number.isFinite(x);
const MARKUP_BASES={cost:'Вся себестоимость',work:'Только работы',direct:'Работы и материалы'};
function calculate(s,q=s.qty){
 if(s.engineVersion==='production-v1'){const core=root.ProductionModelCore||(typeof require==='function'?require('./production-model-core.js'):null);return core.calculate(s,q);}
 let errors=[],warnings=[],M=0,W=0,D=0,transportBase=0,cash=0,mass=0,massMissing=false;
 const engineVersion=s.engineVersion||'cost-v1';if(engineVersion!=='cost-v1')return {q,rows:[],M:0,W:0,D:0,C:0,cash:0,overhead:0,transport:0,markupBase:0,markupMode:'cost',P:0,net:0,tax:0,total:0,unit:0,costUnit:0,margin:0,mass:0,massMissing:true,errors:['Версия методики '+engineVersion+' не поддерживается. Сохранённый результат доступен в архиве.'],warnings:[],partial:true,preliminary:true};
 const graphCore=root.ProcessGraphCore||(typeof require==='function'?require('./process-graph-core.js'):null);if(graphCore){const graph=graphCore.resolve(s,q);s=graph.state;errors.push(...graph.errors);}
 const markupMode=s.markupBase??'cost';if(!Object.hasOwn(MARKUP_BASES,markupMode))errors.push('Выберите корректную базу наценки');
 if(!Number.isInteger(q)||q<1)errors.push('Партия должна быть целым числом от 1');
 for(const [k,label] of [['overhead','Накладные'],['transport','Транспорт'],['markup','Наценка'],['vat','НДС']])if(!num(s[k])||s[k]<0)errors.push(label+': укажите неотрицательный процент');
 const seen=new Set();
 const rows=s.lines.map((original,i)=>{
 const operationCost=original.operation?OperationsCore.calculate(original.operation,q):null;
  let l=operationCost?{...original,qty:1,price:operationCost.unit,reserve:0,pack:1,scope:'unit',kind:'work'}:original;
  const norm=root.ProductionWorkCore?.normHours(l);if(l.kind==='work'&&norm?.enabled)l={...l,qty:norm.value,normHours:norm.value};
  if(operationCost)operationCost.errors.forEach(e=>errors.push(l.name+': '+e));
  const key=[l.catalogId||l.name,l.kind,l.group,l.scope,l.operation?l.id:(l.processSourceKey||'')].join('|');if(seen.has(key))errors.push(l.name+': повтор позиции в одной группе — объедините объёмы или уточните группу');seen.add(key);
  let valid=!operationCost||!operationCost.errors.length, amount=null,purchase=null,need=null;
  if(!l.name.trim()){errors.push('Строка '+(i+1)+': нет наименования');valid=false;}
  for(const [k,label] of [['qty','объём'],['reserve','запас'],['price','цена']])if(!num(l[k])||l[k]<0){errors.push(l.name+': отсутствует или некорректен '+label);valid=false;}
  if(!num(l.pack)||l.pack<=0){errors.push(l.name+': кратность должна быть больше нуля');valid=false;}
  if(/Историческая цена заказа/.test(l.source||''))warnings.push(l.name+': историческая цена заказа; актуальное предложение и доставка требуют проверки');
  if(/Оценка по массе/.test(l.source||''))warnings.push(l.name+': предварительная цена по массе; проверьте марку, массу и ставку по предложению поставщика');
  if(l.price===0)warnings.push(l.name+': проверьте нулевую цену');
  if(!l.confirmed)warnings.push(l.name+': объём, запас и закупочная кратность требуют согласования');
  if(l.kind==='material'&&!l.date)warnings.push(l.name+': дата цены не указана');
  if(num(l.qty)&&l.qty>=0&&num(l.reserve)&&l.reserve>=0&&num(l.pack)&&l.pack>0&&Number.isInteger(q)&&q>0){need=l.qty*(l.scope==='batch'?1:q)*(1+l.reserve/100);purchase=l.kind==='work'?need:Math.ceil((need/l.pack)-1e-10)*l.pack;if(valid){amount=(l.allocation==='share'&&l.kind==='material'?need:purchase)*l.price;if(operationCost)amount=operationCost.total;if(l.kind==='work'){W+=amount;if(l.costCategory==='design')D+=amount;}else {M+=amount;cash+=purchase*l.price;if(!l.deliveryIncluded)transportBase+=amount;}}}
  if(l.kind==='material'){if(num(l.mass))mass+=l.mass*l.qty*(l.scope==='batch'?1/q:1);else massMissing=true;}
  return {...l,need,purchase,amount,operationCost};
 });
 if(!s.lines.length)errors.push('Добавьте материалы или работы');
 const overhead=W*(s.overhead||0)/100,transport=transportBase*(s.transport||0)/100,C=M+W+overhead+transport,markupBase=markupMode==='work'?W:markupMode==='direct'?M+W:C,P=markupBase*(s.markup||0)/100,net=C+P,tax=net*(s.vat||0)/100,total=net+tax;
 const productionRows=rows.filter(l=>{if(l.kind!=='work'||l.pricingMode==='client')return false;const category=root.ReviewCore?.category?.(l);return category?category==='production':(l.costCategory==='production'||(!l.costCategory&&!/монтаж|установк.*издел|доставк|перевоз|проектирован/i.test(l.name)));});
 const manufacturing=productionRows.reduce((sum,l)=>sum+(num(l.amount)?l.amount:0),0),profitTax=num(s.profitTax)?s.profitTax:25,partial=errors.length>0,profitBeforeTax=partial?null:P,profitAfterTax=profitBeforeTax===null?null:profitBeforeTax*(1-profitTax/100);
 return {q,rows,M,W,D,cash,overhead,transport,C,markupBase,markupMode,P,net,tax,total,unit:total/q,costUnit:C/q,margin:net?P/net*100:0,mass,massMissing,manufacturing,manufacturingUnit:manufacturing/q,profitTax,priceWithProfit:partial?null:total,profitBeforeTax,profitAfterTax,errors:[...new Set(errors)],warnings:[...new Set(warnings)],partial,preliminary:true};
}
root.CostEngine={calculate,MARKUP_BASES,VERSION:'cost-v1'};if(typeof module!=='undefined')module.exports=root.CostEngine;
})(typeof window!=='undefined'?window:globalThis);
