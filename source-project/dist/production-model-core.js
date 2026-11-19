(function(root){
const materialUnits=root.MaterialCore||(typeof require==='function'?require('./material-core.js'):null);
'use strict';
const VERSION='production-v1',ORIGIN_COLORS={dialogue:'green',model:'amber',catalog:'gray',input:'input'};
const SCOPES=['product_design','product_manufacturing','inhouse_assembly_and_finishing','packaging','site_installation','construction','external_subcontract','procurement_materials'];
const METHODS=['direct_unit_rate','output_per_hour','crew_cycle','person_hours','machine_hours','operator_support','setup_per_batch','unique_program_prep','composite','external_quote','manual','panel_saw'];
const STATUSES=['confirmed','preliminary','missing','needs_review','inactive','out_of_scope'];
const OPERATOR_MINUTES={P01:15,P02:15,P03:15,P04:15,P05:15,P06:15,P07:30,P08_flat:30,P08_3d:40,P09:60,P10:60,P41:15};
const finite=x=>typeof x==='number'&&Number.isFinite(x),object=x=>!!x&&typeof x==='object'&&!Array.isArray(x),copy=x=>structuredClone(x);
function price(x){return finite(x)&&x>0?x:null;}
function nonnegative(x,label){if(!finite(x)||x<0)throw Error(label+': укажите число не меньше нуля');return x;}
function positive(x,label){if(!finite(x)||x<=0)throw Error(label+': укажите число больше нуля');return x;}
function quantity(x){if(!finite(x)||x<0)throw Error('Объём: укажите число не меньше нуля');return x;}
function operatorSource(d){return !d.operator_included&&d.scope!=='external_subcontract'&&d.calculation_method!=='panel_saw'&&(d.resource_type==='machine'||d.post_id==='P43'&&/^ФРС\.(?:[123]|ПЗ)$/.test(d.code));}
function operatorMinutes(d,i){const key=d.post_id==='P08'?'P08_'+(i.mode==='3d'?'3d':'flat'):d.post_id;return d.post_id==='P43'&&d.code==='ФРС.ОП'?60:OPERATOR_MINUTES[key];}
function resourceBreakdown(d){
 const p=d.parameters||{},value=k=>p[k]?.value;
 if(!['person_hours_per_unit','machine_hours_per_unit','supplies_or_purchased_cost_per_unit'].some(k=>Object.hasOwn(p,k)))return [{name:'Затраты на единицу по исходному основанию',quantity:1,unit:d.unit,rate:d.cost_model.unit_cost,amount:d.cost_model.unit_cost}];
 const rows=[['Труд','person_hours_per_unit','cost_per_person_hour','чел·ч'],['Оборудование','machine_hours_per_unit','cost_per_machine_hour','маш·ч']].map(([name,h,r,unit])=>{const q=value(h),rate=value(r);if(q===0)return null;return {name,quantity:q??null,unit,rate:rate??null,amount:finite(q)&&finite(rate)?nonnegative(q,name)*nonnegative(rate,name):null};}).filter(Boolean);
 const supplies=value('supplies_or_purchased_cost_per_unit');if(supplies!==0)rows.push({name:'Расходники и покупные ресурсы',quantity:1,unit:d.unit,rate:supplies??null,amount:finite(supplies)?nonnegative(supplies,'Расходники'):null});return rows;
}
function resourceUnitCost(d){const rows=resourceBreakdown(d);return rows.some(r=>!finite(r.amount))?null:rows.reduce((s,r)=>s+r.amount,0);}
function definition(d){
 if(!object(d))throw Error('Некорректная производственная операция');
 for(const k of ['id','code','name','stage','shop_id','unit','quantity_basis','financial_basis'])if(typeof d[k]!=='string'||!d[k].trim()||d[k].length>20000)throw Error('Производственная операция: заполните '+k);
 if(!SCOPES.includes(d.scope)||!METHODS.includes(d.calculation_method)||!Object.hasOwn(ORIGIN_COLORS,d.origin)||!STATUSES.includes(d.status))throw Error('Некорректная область, методика или происхождение производственной операции');
 if(d.source_work_id!==null&&d.source_work_id!==undefined&&(!Number.isInteger(d.source_work_id)||d.source_work_id<1))throw Error('Некорректный номер исходной работы');
 if(d.post_id!==null&&d.post_id!==undefined&&(typeof d.post_id!=='string'||d.post_id.length>200))throw Error('Некорректный пост');
 if(d.origin==='model'&&d.status==='confirmed')throw Error('Назначенная моделью норма остаётся предварительной');
 if(!object(d.pricing)||!object(d.cost_model))throw Error('Нет цены или модели затрат операции');
 if(d.resource_costing!==undefined&&typeof d.resource_costing!=='boolean')throw Error('Некорректный признак ресурсной калькуляции');
 for(const k of ['base_unit_price','current_unit_price','hourly_rate','consumables_per_unit'])if(d.pricing[k]!==undefined&&d.pricing[k]!==null)nonnegative(d.pricing[k],'Цена '+k);
 for(const [k,v] of Object.entries(d.cost_model))if(v!==null)nonnegative(v,'Затраты '+k);
 if(d.cycle){positive(d.cycle.workers,'Число работников');nonnegative(d.cycle.minutes_per_unit,'Минут на единицу')}
 if(d.productivity){positive(d.productivity.value,'Выработка');if(typeof d.productivity.unit!=='string'||!['person','crew','machine'].includes(d.productivity.basis))throw Error('Укажите единицу и базу выработки')}
 if(d.incompatible_in_same_work_package!==undefined&&(!Array.isArray(d.incompatible_in_same_work_package)||d.incompatible_in_same_work_package.some(x=>typeof x!=='string')))throw Error('Некорректные несовместимые операции');
 return d;
}
function catalogDefinitions(values){if(!object(values)||Object.keys(values).length>2000)throw Error('Некорректный справочник производственных операций');for(const [id,d]of Object.entries(values)){if(id!==d?.id||['__proto__','constructor','prototype'].includes(id)||id.length>100)throw Error('Некорректный код производственной операции');definition(d);}return values;}
function mergeDefinitions(local,remote,uid){catalogDefinitions(local);catalogDefinitions(remote);const out=copy(remote);for(const [id,d]of Object.entries(local)){if(!Object.hasOwn(out,id)||JSON.stringify(out[id])===JSON.stringify(d))out[id]=copy(d);else{const clone=copy(d);clone.id=uid();clone.status='needs_review';clone.name+=' (местная конфликтующая версия)';out[clone.id]=clone;}}return out;}
function inputValidation(i){
 if(!object(i))throw Error('Некорректный ввод производственной операции');
 for(const k of ['quantity','machine_hours','person_hours','setup_hours','supplier_quote','profiles_per_package','workers','labor_factor'])if(i[k]!==undefined&&i[k]!==null)nonnegative(i[k],k==='quantity'?'Объём':k);
 if(i.intervals!==undefined)intervalHours(i.intervals);
 if(i.machine_line_ids!==undefined&&(!Array.isArray(i.machine_line_ids)||i.machine_line_ids.some(x=>typeof x!=='string')))throw Error('Некорректные связи станочных строк');
 return i;
}
function metadata(s){
 if(s.engineVersion===VERSION)for(const [key,value]of Object.entries({markup:40,vat:0,overhead:0,transport:0})){if(s[key]!==value)throw Error('Производственная методика: наценка 40% один раз, остальные затраты задаются отдельными строками; проверьте '+key);}
 for(const l of s.lines||[]){if(l.production===undefined)continue;const p=l.production;
  if(!object(p)||!object(p.inputs)||!object(p.definition)||l.kind!=='work')throw Error('Некорректная производственная операция строки');definition(p.definition);inputValidation(p.inputs);
  for(const k of ['productId','segment','workPackage'])if(typeof p[k]!=='string'||!p[k].trim()||p[k].length>500)throw Error('Производственная операция: заполните '+k);
  if(p.parentLineId!==undefined&&typeof p.parentLineId!=='string')throw Error('Некорректный комплекс');
  if(p.selected!==undefined&&typeof p.selected!=='boolean')throw Error('Некорректный выбор операции');
  if(p.autoSupport!==undefined&&typeof p.autoSupport!=='boolean')throw Error('Некорректный признак автоматического сопровождения');
  if(p.definition.calculation_method==='panel_saw'&&p.inputs.card)panelSaw(p.inputs.card,p.inputs.panel_parameters);
 }
 return s;
}
function makeLine(d,id,inputs={quantity:null},extra={}){
 definition(d);return {id,kind:'work',name:d.name,unit:d.unit,group:d.shop_id,scope:'batch',allocation:'whole',qty:inputs.quantity??null,price:price(d.pricing.current_unit_price),basePrice:price(d.pricing.base_unit_price),baseUnit:d.unit,reserve:0,pack:1,confirmed:d.status==='confirmed',date:'',source:d.financial_basis,workshop:['ЧПУ цех','Металлоцех','Древообработка','Лакокрасочный','Сборочный','Подрядные'].includes(d.shop_id)?d.shop_id:'Сборочный',costCategory:d.scope==='site_installation'?'installation':d.scope==='product_design'?'design':'production',production:{definition:copy(d),inputs:copy(inputs),productId:'Изделие',segment:'Основной',workPackage:'Основной',selected:true,...extra}};
}
function synchronize(d,source){const out=copy(d);if(!materialUnits.sameUnit(source.unit,out.unit)){out.unit=source.unit;out.unit_change_notice=true;}out.source_unit=source.unit;out.pricing.source_formula=source.formula??out.pricing.source_formula;out.pricing.source_parameters=copy(source.parameters??out.pricing.source_parameters??{});return out;}
function synchronizeCatalog(operations,records,excludedIds=[]){
 if(!Array.isArray(records)||records.length>5000)throw Error('Некорректный источник работ');const ids=new Set();
 for(const r of records){if(!object(r)||!Number.isInteger(r.row)||r.row<1||ids.has(r.row)||typeof r.name!=='string'||!r.name.trim()||typeof r.unit!=='string'||!r.unit.trim())throw Error('Некорректная исходная работа');ids.add(r.row);}
 const report={unitChanges:[],added:[],preservedAppOnly:[]},out=operations.map(d=>{definition(d);const source=records.find(r=>r.row===d.source_work_id);if(!source){if(!d.source_work_id)report.preservedAppOnly.push(d.id);return copy(d);}let updated=copy(d);if(!materialUnits.sameUnit(d.source_unit,source.unit)){updated=synchronize(d,{unit:source.unit,formula:source.priceFormula||'',parameters:{...d.pricing.source_parameters,source_record:copy(source)}});report.unitChanges.push({id:d.id,from:d.unit,to:source.unit});}if(d.name===d.source_name)updated.name=source.name;updated.source_name=source.name;updated.source_unit=source.unit;return updated;});
 for(const r of records){if(excludedIds.includes(r.row)||operations.some(d=>d.source_work_id===r.row))continue;const n=typeof r.price==='number'?r.price:typeof r.price==='string'&&/^\d+(?:[.,]\d+)?$/.test(r.price.trim())?Number(r.price.replace(',','.')):null;const d={id:'source-work-'+r.row,code:'Р'+r.row,source_work_id:r.row,source_record:'Перечень_работ:'+r.row,source_name:r.name,source_unit:r.unit,name:r.name,scope:'product_manufacturing',stage:'machining',shop_id:r.workshop||r.category||'Сборочный',post_id:r.post||null,unit:r.unit,quantity_basis:r.note||'Объём в исходной единице',financial_basis:'Данные.xlsx / Перечень_работ!F'+r.row,calculation_method:'direct_unit_rate',origin:'catalog',status:'needs_review',pricing:{base_unit_price:price(n),current_unit_price:price(n),source_formula:r.priceFormula||'',source_parameters:copy(r),formula_note:r.note||'',note:r.note||''},cost_model:{unit_cost:null}};definition(d);out.push(d);report.added.push(d.id);}
 return {operations:out,report};
}
function overridePrice(d,value){const out=copy(d);out.pricing.current_unit_price=price(value);out.pricing.manual_override=true;out.pricing.note='Стоимость за ед. указана индивидуально';return out;}
function resetPrice(d){const out=copy(d);out.pricing.current_unit_price=out.pricing.base_unit_price;if(out.pricing.base_hourly_rate!==undefined)out.pricing.hourly_rate=out.pricing.base_hourly_rate;out.pricing.manual_override=false;out.pricing.note=out.pricing.formula_note||'';return out;}
function saveConfiguration(d){const out=copy(d);out.unit_change_notice=false;definition(out);return out;}
function intervalsList(intervals){
 if(!Array.isArray(intervals)||intervals.length>5000)throw Error('Некорректные интервалы сотрудников');
 return intervals.map(i=>{if(!object(i)||typeof i.employee!=='string'||!i.employee.trim()||i.employee.length>200)throw Error('Укажите сотрудника интервала');nonnegative(i.start,'Начало интервала');nonnegative(i.end,'Конец интервала');if(i.end<i.start)throw Error('Конец интервала раньше начала');return i;});
}
function intervalHours(intervals){const groups=new Map();for(const i of intervalsList(intervals)){if(!groups.has(i.employee))groups.set(i.employee,[]);groups.get(i.employee).push([i.start,i.end]);}let total=0;for(const list of groups.values()){list.sort((a,b)=>a[0]-b[0]);let end=-Infinity;for(const [a,b]of list){total+=Math.max(0,b-Math.max(end,a));end=Math.max(end,b)}}return total/60;}
function panelSaw(card,params){
 if(!object(card)||!Array.isArray(card.rows)||card.rows.length>12)throw Error('Форматник: не больше 12 строк карты');
 if(!params||!Array.isArray(params.bands)||params.bands.length!==3)throw Error('Нет параметров форматника');
 for(const k of ['setup_minutes','sheet_minutes','machine_rate','setup_machine_rate','blade_per_m','operator_rate','helper_rate','map_rate'])nonnegative(params[k],'Форматник '+k);
 const rows=card.rows.map(row=>{const band=params.bands.find(b=>(b.min_inclusive?row.thickness_mm>=b.min_thickness_mm:row.thickness_mm>b.min_thickness_mm)&&row.thickness_mm<=b.max_thickness_mm);if(!band)throw Error('Форматник: толщина от 3 до 30 мм');const length=nonnegative(row.length_m,'Длина пропила');const strokes=row.strokes??Math.ceil(length/positive(band.stroke_m,'Длина хода')),sheets=row.sheets??Math.ceil(length/positive(params.meters_per_sheet,'Метры на лист'));for(const [k,v]of [['Ходы',strokes],['Листы',sheets]]){nonnegative(v,k);if(!Number.isInteger(v))throw Error(k+': целое число');}const cycle=row.measured_cycle_hours!==undefined&&row.measured_cycle_hours!==null?nonnegative(row.measured_cycle_hours,'Чистый цикл'):length/(60*positive(band.forward,'Подача'))+length/(60*positive(band.backward,'Возврат'))+strokes*nonnegative(band.position_seconds,'Позиционирование')/3600;return {...row,band:band.id,strokes,sheets,cycleHours:cycle};});
 const totalLength=rows.reduce((s,r)=>s+r.length_m,0),setups=card.setups??(totalLength>0?1:0);nonnegative(setups,'Наладки');if(!Number.isInteger(setups))throw Error('Число наладок должно быть целым');
 const setupHours=(setups*params.setup_minutes+rows.reduce((s,r)=>s+r.sheets,0)*params.sheet_minutes)/60,cycleHours=rows.reduce((s,r)=>s+r.cycleHours,0),operatorHours=setupHours+cycleHours,helperHours=card.helper_hours??0,mapHours=card.map_hours??0;nonnegative(helperHours,'Помощник');nonnegative(mapHours,'Разработка карты');
 const components=params.bands.map(b=>{const matching=rows.filter(r=>r.band===b.id);return {code:b.id,name:'Станок и пилы: '+b.min_thickness_mm+'–'+b.max_thickness_mm+' мм',amount:matching.reduce((s,r)=>s+r.cycleHours*params.machine_rate+r.length_m*params.blade_per_m,0),plannedCost:matching.reduce((s,r)=>s+r.cycleHours*params.machine_rate+r.length_m*params.blade_per_m,0)}});
 components.push({code:'ФРС.ПЗ',name:'Наладка и подача',amount:setupHours*params.setup_machine_rate,plannedCost:setupHours*params.setup_machine_rate},{code:'ФРС.ОП',name:'Полный цикл станочника',amount:operatorHours*params.operator_rate,plannedCost:finite(params.operator_cost)?operatorHours*params.operator_cost:null},{code:'ФРС.ПОМ',name:'Помощник',amount:helperHours*params.helper_rate,plannedCost:finite(params.helper_cost)?helperHours*params.helper_cost:null},{code:'ФРС.КАРТА',name:'Новая карта',amount:mapHours*params.map_rate,plannedCost:finite(params.operator_cost)?mapHours*params.operator_cost:null});
 return {rows,components,cycleHours,setupHours,operatorHours,amount:components.reduce((s,c)=>s+c.amount,0),plannedCost:components.some(c=>c.plannedCost===null)?null:components.reduce((s,c)=>s+c.plannedCost,0)};
}
function calculateLine(d,i){
 definition(d);inputValidation(i);if(['inactive','out_of_scope'].includes(d.status)||[37,139,175].includes(d.source_work_id))throw Error('Операция вне активной сметы');
 if(d.calculation_method==='panel_saw'){const p=panelSaw(i.card,i.panel_parameters);return {...p,personHours:p.operatorHours,machineHours:p.cycleHours+p.setupHours};}
 const method=d.calculation_method,rate=price(d.pricing.current_unit_price),cost=d.cost_model,q=['operator_support','setup_per_batch'].includes(method)?null:quantity(i.quantity),hourRate=price(d.pricing.hourly_rate)??rate;
 let amount=null,plannedCost=null,personHours=0,machineHours=0,measure=q,unitCost=d.resource_costing?resourceUnitCost(d):finite(cost.unit_cost)?cost.unit_cost:null;
 if(method==='operator_support'){
  if(d.post_id==='P43'&&d.code!=='ФРС.ОП')throw Error('P43: станочник уже включён в ФРС.ОП');const minutes=operatorMinutes(d,i);if(minutes===undefined)throw Error('Не задана занятость оператора этого поста');
  machineHours=i.person_hours!=null?(i.machine_hours??0):quantity(i.machine_hours);personHours=i.person_hours??(i.intervals?.length?intervalHours(i.intervals):machineHours*minutes/60);measure=personHours;
  amount=price(d.pricing.current_unit_price)===null?null:personHours*d.pricing.current_unit_price;plannedCost=unitCost===null?null:personHours*unitCost;
 }else if(method==='unique_program_prep'){
  const output=d.source_work_id===112?120:d.source_work_id===113?30:d.productivity?.value;personHours=q/positive(output,'Выработка подготовки');measure=personHours;amount=d.pricing.manual_override?(rate===null?null:q*rate):hourRate===null?null:personHours*hourRate;plannedCost=finite(cost.labor_cost_per_person_hour)?personHours*cost.labor_cost_per_person_hour:unitCost===null?null:q*unitCost;
 }else if(method==='crew_cycle'){
  personHours=q*positive(d.cycle?.workers,'Число работников')*nonnegative(d.cycle?.minutes_per_unit,'Цикл')/60;measure=personHours;
  // A manual physical-unit price override replaces the tariff amount, not the time norm.
  amount=d.pricing.manual_override?(rate===null?null:q*rate):(hourRate===null?null:personHours*hourRate+q*(d.pricing.consumables_per_unit||0));plannedCost=finite(cost.labor_cost_per_person_hour)?personHours*cost.labor_cost_per_person_hour+q*(cost.consumables_per_unit||0):unitCost===null?null:q*unitCost;
 }else if(method==='output_per_hour'||method==='machine_hours'){
  if(d.productivity){if(!materialUnits.sameUnit(d.productivity.unit,d.unit))throw Error('Не совпадают единицы объёма и выработки');const hours=q/positive(d.productivity.value,'Выработка');if(method==='machine_hours'||d.productivity.basis==='machine')machineHours=hours;else personHours=hours*(d.productivity.basis==='crew'?positive(d.cycle?.workers,'Число работников'):1);}else if(method==='machine_hours')machineHours=quantity(i.machine_hours??q);else throw Error('Нет выработки');
  measure=machineHours||personHours;amount=d.pricing.manual_override?(rate===null?null:q*rate):hourRate===null?null:measure*hourRate;const c=machineHours?cost.machine_cost_per_machine_hour:cost.labor_cost_per_person_hour;plannedCost=finite(c)?measure*c:unitCost===null?null:q*unitCost;
 }else if(method==='person_hours'||method==='setup_per_batch'){
  personHours=method==='setup_per_batch'?quantity(i.setup_hours):quantity(i.person_hours??q);measure=personHours;amount=hourRate===null?null:personHours*hourRate;plannedCost=finite(cost.labor_cost_per_person_hour)?personHours*cost.labor_cost_per_person_hour:unitCost===null?null:personHours*unitCost;
 }else if(method==='composite'&&d.components?.length){
  const components=d.components.map(c=>({name:c.name,amount:finite(c.quantity)&&price(c.unit_rate)!==null?q*c.quantity*c.unit_rate:null,plannedCost:finite(c.quantity)&&finite(c.unit_cost)?q*c.quantity*c.unit_cost:null}));amount=components.some(c=>c.amount===null)?null:components.reduce((s,c)=>s+c.amount,0);plannedCost=components.some(c=>c.plannedCost===null)?null:components.reduce((s,c)=>s+c.plannedCost,0);return {amount,plannedCost,personHours,machineHours,measure:q,components};
 }else{amount=method==='external_quote'&&i.supplier_quote!==undefined?price(i.supplier_quote):rate===null?null:q*rate;plannedCost=unitCost===null?null:q*unitCost;personHours=q*(d.parameters?.person_hours_per_unit?.value||0);machineHours=q*(d.parameters?.machine_hours_per_unit?.value||0);}
 if(!d.resource_costing&&Object.hasOwn(cost,'unit_cost_override'))plannedCost=cost.unit_cost_override===null?null:(q??measure)*cost.unit_cost_override;
 if(d.source_work_id===144&&i.package_cut){if(!Number.isInteger(i.profiles_per_package)||i.profiles_per_package<2)throw Error('Пакет: целое число профилей от 2');amount=rate===null?null:q*.8*rate*i.profiles_per_package;const cutCost=!d.resource_costing&&Object.hasOwn(cost,'unit_cost_override')?cost.unit_cost_override:unitCost;plannedCost=cutCost===null?null:q*.8*cutCost*i.profiles_per_package;}
 const factor=i.labor_factor??1;positive(factor,'Коэффициент труда');if(factor!==1){const laborQuote=method==='direct_unit_rate'&&finite(d.parameters?.internal_person_hour_tariff?.value)?personHours*d.parameters.internal_person_hour_tariff.value:d.resource_type==='labor'||['person_hours','crew_cycle','operator_support','unique_program_prep'].includes(method)?(amount??0)-(q??0)*(d.pricing.consumables_per_unit||0):personHours*(d.parameters?.internal_person_hour_tariff?.value||0);const laborCost=finite(cost.labor_cost_per_person_hour)?personHours*cost.labor_cost_per_person_hour:personHours*(d.parameters?.cost_per_person_hour?.value||0);if(amount!==null)amount+=laborQuote*(factor-1);if(plannedCost!==null)plannedCost+=laborCost*(factor-1);}
 if((amount!==null&&!finite(amount))||(plannedCost!==null&&!finite(plannedCost)))throw Error('Слишком большие значения: переполнение расчёта');
 return {amount,plannedCost,personHours,machineHours,measure,components:[{code:d.code,name:d.name,amount,plannedCost}]};
}
function packageKey(l){const p=l.production;return [p.productId,p.workPackage,p.segment].join('\u001f');}
function calculate(state,q=state.qty){
 let s=state;const errors=[],warnings=[];if(!Number.isInteger(q)||q<1)errors.push('Партия должна быть целым числом от 1');
 for(const [key,value]of Object.entries({markup:40,vat:0,overhead:0,transport:0}))if(s[key]!==value)errors.push('Производственная методика: проверьте фиксированный параметр '+key);
 const graph=root.ProcessGraphCore||(typeof require==='function'?require('./process-graph-core.js'):null);if(graph){const g=graph.resolve(s,q);s=g.state;errors.push(...g.errors);}
 const rows=(s.lines||[]).map(l=>{if(l.production?.selected===false)return {...l,amount:0,plannedCost:0,excluded:true,components:[]};try{
  if(l.production){const p=l.production;let inputs=copy(p.inputs);if(l.scope==='unit'&&!['setup_per_batch','unique_program_prep','operator_support','panel_saw'].includes(p.definition.calculation_method)&&finite(inputs.quantity))inputs.quantity*=q;const result=calculateLine(p.definition,inputs);if(p.definition.status!=='confirmed')warnings.push(l.name+': норма '+p.definition.status);if(p.definition.unit_change_notice)warnings.push(l.name+': Единица измерения изменена на базовую. Требуется проверка стоимости и корректности расчёта');return {...l,...result,need:result.measure,purchase:result.measure};}
  const need=quantity(l.qty)*(l.scope==='batch'?1:q)*(1+nonnegative(l.reserve,'Запас')/100),pack=positive(l.pack,'Кратность'),purchase=l.kind==='material'?Math.ceil(need/pack-1e-10)*pack:need;
  if(l.kind==='work')throw Error('Сопоставьте работу с производственным вариантом и проверьте базу цены');const amount=price(l.price)===null?null:(l.kind==='material'&&l.allocation==='share'?need:purchase)*l.price;
  return {...l,need,purchase,amount,plannedCost:l.kind==='material'?amount:null,components:[]};
 }catch(e){errors.push(l.name+': '+e.message);return {...l,amount:null,plannedCost:null,components:[]};}});
 // Operator time may be linked to machine rows. It is never inferred from the tariff amount.
 for(const row of rows.filter(l=>!l.excluded&&l.production?.definition.calculation_method==='operator_support')){
  const p=row.production;if(p.inputs.person_hours!=null||p.inputs.machine_hours!=null)continue;
  const machines=rows.filter(l=>l!==row&&l.production&&operatorSource(l.production.definition)&&packageKey(l)===packageKey(row)&&l.production.definition.post_id===p.definition.post_id&&(!p.inputs.machine_line_ids?.length||p.inputs.machine_line_ids.includes(l.id)));
  try{
   if(!machines.length||machines.some(l=>!l.excluded&&!finite(l.machineHours)))throw Error('Нет машино-часов связанных операций');
   const inputs={...p.inputs,machine_hours:machines.reduce((s,l)=>s+(l.excluded?0:l.machineHours),0)};
   if(!inputs.intervals?.length)inputs.person_hours=machines.reduce((s,l)=>{if(l.excluded)return s;const norm=l.production.definition.parameters?.operator_minutes_per_machine_hour?.value,minutes=norm>0?nonnegative(norm,'Занятость оператора'):operatorMinutes(p.definition,p.inputs);return s+l.machineHours*nonnegative(minutes,'Занятость оператора')/60;},0);
   Object.assign(row,calculateLine(p.definition,inputs));const prefix=row.name+': ';for(let i=errors.length-1;i>=0;i--)if(errors[i].startsWith(prefix)&&/Объём/.test(errors[i]))errors.splice(i,1);
  }catch(e){errors.push(row.name+': '+e.message)}
 }
 const selected=rows.filter(l=>!l.excluded),seen=new Map(),intervals=[];
 for(const row of selected){const p=row.production;if(!p)continue;const d=p.definition,key=packageKey(row);if(d.scope==='product_manufacturing'&&[34,35,37,49].includes(d.source_work_id))errors.push(row.name+': монтаж относится к отдельной области');
  const once=['unique_program_prep','setup_per_batch'].includes(d.calculation_method)?d.calculation_method+'|'+p.productId+'|'+d.post_id+'|'+(p.inputs.unique_program_id||p.inputs.batch_id||d.code):key+'|'+d.code;
  if(seen.has(once))errors.push(row.name+': повтор операции/подготовки в одной области');seen.set(once,row);
  if(p.inputs.person_hours==null&&p.inputs.intervals?.length&&d.calculation_method==='operator_support'){try{const before=intervalHours(intervals),after=intervalHours([...intervals,...p.inputs.intervals]),hours=after-before;if(hours<row.personHours)warnings.push(row.name+': пересечение времени сотрудника учтено один раз');const factor=row.personHours?hours/row.personHours:0;row.amount=row.amount===null?null:row.amount*factor;row.plannedCost=row.plannedCost===null?null:row.plannedCost*factor;row.personHours=hours;row.components=[{code:d.code,name:d.name,amount:row.amount,plannedCost:row.plannedCost}];intervals.push(...p.inputs.intervals);}catch(e){errors.push(e.message)}}
  for(const other of selected){if(other===row||!other.production||packageKey(other)!==key)continue;const od=other.production.definition;
   if(p.parentLineId===other.id||other.production.parentLineId===row.id)continue;
   if(d.calculation_method==='panel_saw'&&(od.post_id==='P43'&&(/^ФРС\./.test(od.code)||od.calculation_method==='panel_saw')))errors.push(row.name+': ресурсы форматника ФРС уже включены в карту');
   if(d.incompatible_in_same_work_package?.includes(od.code)||(d.alternative_group_id&&d.alternative_group_id===od.alternative_group_id))errors.push(row.name+': альтернативные операции для участка '+p.segment);
   if([34,35,49].includes(d.source_work_id)&&od.scope==='site_installation'&&od.code!==d.code)errors.push(row.name+': агрегат и детализация монтажа для одного участка');
   if(d.calculation_method==='external_quote'&&['machine','operator_support'].includes(od.resource_type))errors.push(row.name+': подряд и собственные ресурсы одного участка');
   if(d.resource_type==='machine'&&d.operator_included&&od.resource_type==='operator_support'&&d.post_id===od.post_id)errors.push(row.name+': оператор уже включён в станочную ставку');
  }
 }
 const children=new Map();for(const row of selected){const parent=row.production?.parentLineId;if(parent){if(!children.has(parent))children.set(parent,[]);children.get(parent).push(row);}}
 const visited=new Set(),active=new Set();function aggregate(row){if(active.has(row.id)){errors.push('Цикл комплексов');return}if(visited.has(row.id))return;active.add(row.id);const parts=children.get(row.id);if(parts?.length){if(row.production?.definition.calculation_method!=='composite')errors.push(row.name+': родитель должен быть комплексом');for(const part of parts)aggregate(part);row.amount=parts.some(c=>c.amount===null)?null:parts.reduce((s,c)=>s+c.amount,0);row.plannedCost=parts.some(c=>c.plannedCost===null)?null:parts.reduce((s,c)=>s+c.plannedCost,0);row.displayOnly=true;}active.delete(row.id);visited.add(row.id);}for(const row of selected)aggregate(row);
 for(const row of selected)if(row.production?.parentLineId&&!selected.some(x=>x.id===row.production.parentLineId))errors.push(row.name+': отсутствует родитель комплекса');
 const counted=selected.filter(l=>!l.displayOnly),scopeTotals=Object.create(null),tree=Object.create(null);let base=0,planned=0,incomplete=false;
 for(const row of counted){if(row.amount===null){errors.push(row.name+': стоимость отсутствует');}else base+=row.amount;if(row.plannedCost===null)incomplete=true;else planned+=row.plannedCost;
  const p=row.production,d=p?.definition,scope=d?.scope||(row.installation?'site_installation':row.kind==='material'?'procurement_materials':'product_manufacturing');scopeTotals[scope]=(scopeTotals[scope]||0)+(row.amount||0);
  const keys=[p?.productId||s.name,scope,d?.stage||'procurement',d?.shop_id||row.group,d?.post_id||'Без поста'];let branch=tree;for(const key of keys)branch=branch[key]??=(Object.create(null));(branch.lines??=[]).push(row.id);
 }
 if(!counted.length)errors.push('Добавьте материалы или работы');
 const total=Math.round((base*1.4+Number.EPSILON)*100)/100,plannedCost=incomplete?null:planned,profit=incomplete?null:total-planned,margin=incomplete||!total?null:profit/total*100,M=counted.filter(x=>x.kind==='material').reduce((s,x)=>s+(x.amount||0),0),W=base-M;
 return {q,rows,M,W,D:scopeTotals.product_design||0,C:plannedCost,cash:counted.filter(x=>x.kind==='material').reduce((s,x)=>s+(x.purchase||0)*(x.price||0),0),overhead:0,transport:0,royalty:0,fixedGross:0,markupBase:base,markupMode:'cost',P:base*.4,net:total,tax:0,total,unit:total/q,costUnit:incomplete?null:planned/q,margin,profit,plannedCost,preMarkupBase:base,scopeTotals,productManufacturingBase:scopeTotals.product_manufacturing||0,productionCost:plannedCost,profitIncomplete:incomplete,tree,errors:[...new Set(errors)],warnings:[...new Set(warnings)],scopeIssues:[],approvalIssues:[...new Set([...errors,...warnings])],partial:errors.length>0,preliminary:errors.length>0||warnings.length>0,mass:0,massMissing:true};
}
function migrate(state,catalog){const out=copy(state);out.engineVersion=VERSION;delete out.archive;delete out.approval;out.markup=40;out.markupBase='cost';out.overhead=0;out.transport=0;out.vat=0;out.royalty=0;
 out.lines=out.lines.map(l=>{if(l.production||l.kind==='material')return l;const match=catalog.filter(d=>d.source_record===l.catalogId);let d=match.length===1?copy(match[0]):null;
  if(!d)d={id:'app-'+l.id,code:'APP-'+l.id,source_work_id:null,name:l.name,scope:l.installation?'site_installation':'product_manufacturing',stage:l.installation?'installation':'machining',shop_id:l.workshop||'Сборочный',post_id:null,unit:l.unit,quantity_basis:'Сохранённый объём; требуется проверка',calculation_method:'direct_unit_rate',financial_basis:l.source||'Позиция только приложения',origin:'input',status:'needs_review',pricing:{base_unit_price:l.basePrice??l.price,current_unit_price:l.price,source_formula:l.sourceFormula||'',source_parameters:l.sourceParameters||{},formula_note:l.source||''},cost_model:{unit_cost:null}};
  // Migration preserves old quantity and price; a changed physical unit requires explicit review.
  const sourceId=l.catalogId?.match(/^Перечень_работ:(\d+)$/),notice=!materialUnits.sameUnit(d.unit,l.unit)||match.length>1;if(sourceId)d.source_work_id=Number(sourceId[1]);if(match.length!==1)d.unit=l.unit;d.name=l.name;d.pricing.current_unit_price=l.price;d.unit_change_notice=notice;d.status=sourceId&&!match.length?'out_of_scope':'needs_review';d.calculation_method='direct_unit_rate';d.resource_costing=false;d.migration_note='Проверьте вариант, исходную единицу и базу цены перед применением новой методики';if(notice)d.cost_model.unit_cost=null;
  return {...l,unit:d.unit,production:{definition:d,inputs:{quantity:l.qty},productId:out.name||'Изделие',segment:'Основной',workPackage:'Основной',selected:true}};
 });metadata(out);return out;}
const api={VERSION,SCOPES,METHODS,STATUSES,ORIGIN_COLORS,price,definition,catalogDefinitions,mergeDefinitions,metadata,makeLine,synchronize,synchronizeCatalog,overridePrice,resetPrice,saveConfiguration,intervalHours,panelSaw,calculateLine,calculate,migrate,resourceUnitCost,resourceBreakdown,operatorSource};
root.ProductionModelCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
