const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
assert.ok(fs.existsSync('dist/production-model-core.js'),'Новая производственная методика должна существовать');
const core=require('./dist/production-model-core.js'),data=require('./dist/production-catalog.js');
for(const thickness of [3,4,6,9,10,12,15,18,21,27,30]){
 const d=data.operations.find(d=>d.code==='Р146.'+thickness),passes=Math.ceil(thickness/3);
 assert.ok(Math.abs(d.parameters.output_per_hour.value-270/passes)<1e-8,'Фанера '+thickness+' мм: проход каждые 3 мм, включая 4 мм');
 const result=core.calculateLine(d,{quantity:270});assert.ok(Math.abs(result.machineHours-passes)<1e-8);
}
const plywood4=data.operations.find(d=>d.code==='Р146.4');
assert.equal(plywood4.pricing.source_parameters.output_per_hour.value,270,'Исходная норма остаётся в происхождении');
assert.ok(Math.abs(core.calculateLine(plywood4,{quantity:270}).amount-200)<1e-8);
assert.ok(Math.abs(core.calculateLine(plywood4,{quantity:270}).plannedCost-510)<1e-8);
const oldPlywood4={...structuredClone(plywood4),parameters:structuredClone(plywood4.pricing.source_parameters)};
assert.equal(core.calculateLine(oldPlywood4,{quantity:270}).machineHours,1,'Старый снимок не получает новую норму автоматически');
const siteTrimming=data.operations.find(d=>d.name==='Торцевание доски'&&d.scope==='site_installation');
const shopTrimming=data.operations.find(d=>d.name==='Торцевание доски'&&d.shop_id==='Древообработка');
assert.ok(shopTrimming,'Торцевание доски должно быть доступно в древообработке');
assert.equal(shopTrimming.scope,'product_manufacturing');
assert.deepEqual(shopTrimming.cycle,siteTrimming.cycle);assert.deepEqual(shopTrimming.cost_model,siteTrimming.cost_model);
assert.equal(shopTrimming.pricing.current_unit_price,67.875);assert.equal(data.postNames[shopTrimming.post_id],'Торцевание доски');
// Resource costs are derived for new definitions; old snapshots retain their cached cost.
const zinc=structuredClone(data.operations.find(d=>d.source_work_id===190));
zinc.resource_costing=true;zinc.cost_model.unit_cost=99999;
assert.ok(Math.abs(core.resourceUnitCost(zinc)-393.40734649122805)<1e-8);
assert.ok(Math.abs(core.calculateLine(zinc,{quantity:8}).plannedCost-3147.2587719298244)<1e-8);
delete zinc.resource_costing;assert.equal(core.calculateLine(zinc,{quantity:8}).plannedCost,799992);
zinc.resource_costing=true;zinc.parameters.cost_per_person_hour.value=null;assert.equal(core.resourceUnitCost(zinc),null);
zinc.parameters.person_hours_per_unit.value=0;assert.ok(Math.abs(core.resourceUnitCost(zinc)-133.33333333333334)<1e-8);
assert.ok(core.resourceBreakdown(zinc).every(x=>typeof x.name==='string'));
const approx=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const def=(over={})=>({id:'test',code:'TEST',name:'Тест',source_work_id:null,scope:'product_manufacturing',stage:'machining',shop_id:'Металлоцех',post_id:'P23',unit:'шт.',quantity_basis:'Количество изделий',calculation_method:'direct_unit_rate',financial_basis:'Задана ставка',origin:'input',status:'needs_review',pricing:{base_unit_price:100,current_unit_price:100,source_formula:'=A1',source_parameters:{a:100},formula_note:'Исходное основание'},cost_model:{unit_cost:60},...over});
const line=(id,d=def(),inputs={quantity:1},extra={})=>core.makeLine(d,id,inputs,extra);
const state=lines=>({version:1,engineVersion:'production-v1',name:'Тест',code:'',client:'',notes:'',type:'МАФ и мебель',scope:'Изготовление',qty:1,overhead:0,transport:0,markup:40,markupBase:'cost',vat:0,lines});
let r=core.calculate(state([line('a'),line('b',def({id:'two',code:'TWO',pricing:{base_unit_price:200,current_unit_price:200}}))]));
assert.deepEqual(r.rows.map(l=>l.amount),[100,200]);assert.equal(r.total,420);assert.equal(r.plannedCost,120);assert.equal(r.profit,300); // AT-01
const support=(post,mode='flat')=>def({post_id:post,calculation_method:'operator_support',pricing:{current_unit_price:2081,base_unit_price:2081},resource_type:'operator_support'});
let p=core.calculateLine(support('P01'),{machine_hours:10});assert.equal(p.personHours,2.5);assert.equal(p.amount,5202.5); // AT-02
assert.equal(core.calculateLine(support('P07'),{machine_hours:10}).personHours,5);approx(core.calculateLine(support('P08'),{machine_hours:10,mode:'3d'}).personHours,20/3); // AT-03
assert.equal(core.calculateLine(support('P07'),{person_hours:2.75}).personHours,2.75);
assert.equal(core.calculateLine(support('P07'),{person_hours:0,machine_hours:10}).personHours,0);
assert.equal(core.calculateLine(support('P07'),{person_hours:2,machine_hours:10,intervals:[{employee:'a',start:0,end:180}]}).personHours,2,'Ручные часы заменяют норму и интервалы');
assert.throws(()=>core.calculateLine(support('P07'),{person_hours:-1}),/не меньше нуля/);
const manualOperator=core.calculate(state([line('manual-hours',support('P07'),{person_hours:2,intervals:[{employee:'a',start:0,end:180}]})]));
assert.equal(manualOperator.rows[0].personHours,2);assert.equal(manualOperator.errors.length,0,'Ручным часам не нужны станочные источники');
assert.equal(core.intervalHours([{employee:'a',start:0,end:120},{employee:'a',start:60,end:180},{employee:'b',start:60,end:120}]),4); // AT-04
r=core.calculate(state([line('a',support('P01'),{machine_hours:10,intervals:[{employee:'a',start:0,end:150}]}),line('b',support('P02'),{machine_hours:10,intervals:[{employee:'a',start:60,end:210}]})]));assert.equal(r.W,3.5*2081);
for(const [id,q,h,a] of [[112,240,2,4162],[113,90,3,6243]]){const d=data.operations.find(x=>x.source_work_id===id);p=core.calculateLine(d,{quantity:q,repeated_parts:100});assert.equal(p.personHours,h);assert.equal(p.amount,a)} // AT-05
const saw=data.operations.find(x=>x.source_work_id===144);approx(core.calculateLine(saw,{quantity:1,package_cut:true,profiles_per_package:4}).amount,254.848); // AT-06
r=core.calculate(state([line('a'),line('b',def({scope:'site_installation'})),line('c',def({scope:'construction'}))]));assert.equal(r.scopeTotals.product_manufacturing,100);assert.equal(r.productManufacturingBase,100);assert.equal(r.preMarkupBase,300); // AT-07
assert.ok(!data.operations.some(x=>[37,139,175].includes(x.source_work_id)&&!['inactive','out_of_scope'].includes(x.status))); // AT-08
const aggregate=data.operations.find(x=>x.source_work_id===35),detailed=data.operations.find(x=>x.code==='М01');
r=core.calculate(state([line('a',aggregate),line('b',detailed)]));assert.ok(r.errors.some(x=>/альтернатив|детализац/i.test(x))); // AT-09
assert.ok(!core.calculate(state([line('a',aggregate,{quantity:1},{segment:'a'}),line('b',detailed,{quantity:1},{segment:'b'})])).errors.some(x=>/альтернатив|детализац/i.test(x)));
let d=core.synchronize(def(),{unit:'м',price:999,formula:'=Z1'});assert.equal(d.unit,'м');assert.equal(d.pricing.current_unit_price,100);assert.equal(d.unit_change_notice,true);d=core.saveConfiguration(d);assert.equal(d.unit_change_notice,false); // AT-10
d=core.overridePrice(def(),250);assert.equal(d.pricing.base_unit_price,100);assert.equal(d.pricing.source_formula,'=A1');assert.equal(d.pricing.note,'Стоимость за ед. указана индивидуально');d=core.resetPrice(d);assert.equal(d.pricing.current_unit_price,100);assert.equal(d.pricing.note,'Исходное основание'); // AT-11
for(const v of [0,'по запросу',null])assert.equal(core.price(v),null);assert.equal(core.calculateLine(def(),{quantity:0}).amount,0);assert.throws(()=>core.calculateLine(def(),{quantity:null}),/объём/i); // AT-12
const programOverride=core.overridePrice(data.operations.find(x=>x.source_work_id===112),25);assert.equal(core.calculateLine(programOverride,{quantity:240}).amount,6000);
const card={rows:[{thickness_mm:6,length_m:10,strokes:2,sheets:1},{thickness_mm:18,length_m:10,strokes:2,sheets:1},{thickness_mm:30,length_m:10,strokes:2,sheets:1}],setups:1,helper_hours:1,map_hours:2};
const result=core.panelSaw(card,data.panelSaw);assert.equal(result.components.length,7);assert.equal(result.rows.map(x=>x.band).join(','),'ФРС.1,ФРС.2,ФРС.3');assert.ok(result.operatorHours>result.cycleHours);assert.ok(result.components.every(x=>x.code!=='Р103'));assert.throws(()=>core.panelSaw({...card,rows:Array(13).fill(card.rows[0])},data.panelSaw),/12/); // AT-13
const measured=core.panelSaw({...card,rows:[{thickness_mm:6,length_m:10,strokes:2,sheets:1,measured_cycle_hours:0.5}],setups:0,helper_hours:0,map_hours:0},data.panelSaw);assert.equal(measured.cycleHours,.5);approx(measured.operatorHours,.55);
const p43def=def({post_id:'P43',calculation_method:'panel_saw'});r=core.calculate(state([line('card',p43def,{card,panel_parameters:data.panelSaw}),line('operator',data.operations.find(x=>x.code==='ФРС.ОП'))]));assert.ok(r.errors.some(e=>/ФРС|форматник/i.test(e)),'P43 card must reject additional operator/resource lines');
assert.deepEqual(core.ORIGIN_COLORS,{dialogue:'green',model:'amber',catalog:'gray',input:'input'});assert.ok(data.operations.filter(x=>x.origin==='model').every(x=>x.status!=='confirmed')); // AT-14
const audit=JSON.parse(fs.readFileSync('../docs/production-migration/source-to-app-mapping.json'));for(const [f,h]of Object.entries(audit.protectedHashes)){if(f==='materialRecords')continue;const renamed=require('./tests/fixtures/catalog-normalization-baseline.json').files;assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex'),renamed[f]||h)} // AT-15
r=core.calculate(state([line('a',def({cost_model:{}}))]));assert.equal(r.plannedCost,null);assert.equal(r.profit,null);assert.equal(r.margin,null);assert.equal(r.profitIncomplete,true); // AT-16
// Boundaries: crew hours, units, forbidden costs, alternatives, composite display totals.
assert.equal(core.calculateLine(def({calculation_method:'crew_cycle',cycle:{workers:2,minutes_per_unit:120},pricing:{current_unit_price:1810}}),{quantity:1}).amount,7240);
const crewChanged=structuredClone(detailed);crewChanged.cycle.minutes_per_unit*=2;approx(core.calculateLine(crewChanged,{quantity:10}).plannedCost,core.calculateLine(detailed,{quantity:10}).plannedCost*2);
const manualCost=structuredClone(detailed);manualCost.resource_costing=false;manualCost.cost_model.unit_cost_override=10;assert.equal(core.calculateLine(manualCost,{quantity:10}).plannedCost,100);
assert.throws(()=>core.calculateLine(def({calculation_method:'output_per_hour',productivity:{value:2,unit:'м',basis:'person'}}),{quantity:10}),/единиц/i);
assert.throws(()=>core.calculateLine(support('P43'),{machine_hours:1}),/P43/);
assert.throws(()=>core.calculateLine(saw,{quantity:1,package_cut:true,profiles_per_package:1.5}),/пакет/i);
assert.throws(()=>core.calculateLine(def(),{quantity:1e308}),/слишком|переполн/i);
assert.equal(core.calculateLine(def({calculation_method:'setup_per_batch',cost_model:{labor_cost_per_person_hour:20}}),{setup_hours:2}).amount,200);
assert.equal(core.calculateLine(def({calculation_method:'output_per_hour',productivity:{value:2,unit:'шт.',basis:'person'},cost_model:{labor_cost_per_person_hour:10}}),{quantity:10}).plannedCost,50);
assert.equal(core.calculateLine(def({calculation_method:'machine_hours',productivity:{value:2,unit:'шт.',basis:'machine'},cost_model:{machine_cost_per_machine_hour:10}}),{quantity:10}).plannedCost,50);
assert.equal(core.calculateLine(def({calculation_method:'person_hours'}),{quantity:4}).amount,400);
assert.equal(core.calculateLine(def({calculation_method:'external_quote'}),{quantity:1,supplier_quote:500}).amount,500);
const parent=def({calculation_method:'composite'});r=core.calculate(state([line('parent',parent),line('child',def(),{quantity:1},{parentLineId:'parent'})]));assert.equal(r.preMarkupBase,100);assert.equal(r.rows[0].amount,100);
const old=state([line('a')]);old.engineVersion='cost-review-v1';delete old.lines[0].production;old.lines[0].catalogId='Перечень_работ:144';old.lines[0].unit='н/ч';const original=JSON.stringify(old),copy=core.migrate(old,data.operations);assert.equal(JSON.stringify(old),original);assert.equal(copy.engineVersion,'production-v1');assert.equal(copy.lines[0].qty,1);assert.equal(copy.lines[0].price,100);assert.ok(copy.lines[0].production.definition.unit_change_notice);
const uniqueOld=structuredClone(old);uniqueOld.lines[0].catalogId='Перечень_работ:112';const uniqueMigrated=core.migrate(uniqueOld,data.operations);assert.equal(uniqueMigrated.lines[0].unit,'м контура');assert.equal(uniqueMigrated.lines[0].qty,1);assert.equal(uniqueMigrated.lines[0].price,100);assert.equal(uniqueMigrated.lines[0].production.definition.cost_model.unit_cost,null);
assert.throws(()=>core.metadata({...state([line('a')]),lines:[{...line('a'),production:{...line('a').production,inputs:{quantity:-1}}}]}),/объём|числ/i);
const engine=require('./dist/engine.js');require('./dist/review-core.js').install(engine);assert.equal(engine.calculate(state([line('a')])).total,140);assert.ok(engine.SUPPORTED_VERSIONS.includes('production-v1'));
global.CostEngine=engine;const archive=require('./dist/calculation-archive.js');assert.equal(archive.result(archive.capture(state([line('a')]))).total,140);
const schema=require('./dist/domain-schema.js');schema.calculation(state([line('a')]));assert.throws(()=>schema.calculation({...state([line('a')]),lines:[{...line('a'),production:{bad:true}}]}),/производ|операц/i);
const incomplete=archive.capture(state([line('a',def({cost_model:{}}))]));schema.calculation(incomplete);
const report=require('./dist/internal-report.js').model(state([line('a')]),core.calculate(state([line('a')])));assert.ok(report.summary.some(row=>row[0]==='Плановая прибыль'&&row[1]===80));
assert.equal(data.installationTemplates.length,46);assert.equal(data.operations.length,286);assert.equal(data.sourceMapping.length,151);
assert.ok(data.operations.find(d=>d.source_work_id===23).reference_components.length>=10);
assert.equal(data.operations.find(d=>d.source_work_id===23).reference_components[0].name,'Фанера / пенополистирол опалубки');
for(const op of data.operations)core.definition(op);
const sourceSync=core.synchronizeCatalog([def({source_work_id:10,source_unit:'шт.'}),def({id:'app-only',source_work_id:null})],[{row:10,name:'Из источника',unit:'м',price:500,priceFormula:'=B10'},{row:11,name:'Новая работа',unit:'кг',price:0,workshop:'Металлоцех',post:'P20'}],[]);assert.equal(sourceSync.operations.length,3);assert.equal(sourceSync.operations[0].pricing.current_unit_price,100);assert.equal(sourceSync.operations[0].unit,'м');assert.equal(sourceSync.operations[0].unit_change_notice,true);assert.equal(sourceSync.operations[1].id,'app-only');assert.equal(sourceSync.operations[2].pricing.current_unit_price,null);
console.log('Production model acceptance checks passed (AT-01…AT-16 + boundaries, migration, archive, schema)');
