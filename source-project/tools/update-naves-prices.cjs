// One-off update of the named project's working draft and a new library revision.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');
const core=require('../dist/production-model-core.js'),catalog=require('../dist/production-catalog.js'),schema=require('../dist/domain-schema.js'),protocol=require('../dist/record-protocol.js');
require('../dist/engine.js');require('../dist/review-core.js').install(globalThis.CostEngine);
const archive=require('../dist/calculation-archive.js');
const workspace=path.resolve(__dirname,'../..'),backupDir=path.join(workspace,'backups/naves-tpu-prices-2026-11-19'),outDir=path.join(workspace,'outputs/naves-tpu-prices-2026-11-19');
const installedRoot='C:/Users/Danil.S/Desktop/Личная папка ДАНИЛ.С/1. - Рассчеты/Рассчеты изделий/Калькулятор стоимости 19.11.2026_173000/Calculator-Windows-x64-2026-11-19T07-20-41-020Z';
const draftRecord=JSON.parse(fs.readFileSync(path.join(backupDir,'working-draft-before.json'),'utf8')),libraryRecord=JSON.parse(fs.readFileSync(path.join(backupDir,'library-before.json'),'utf8'));
const draft=JSON.parse(draftRecord.payload),original=draft.calculation,next=structuredClone(original),library=JSON.parse(libraryRecord.payload),now=new Date().toISOString();
assert.equal(original.name,'Навес ТПУ');assert.equal(original.engineVersion,'production-v1');assert.equal(original.libraryId,library.id);
assert.ok(fs.existsSync(path.join(backupDir,'calculator-before.sqlite')),'Full database backup required');
const report={project:original.name,source:'Bundled production calculation model 19.11.2026; welding output 1.2 m/hour supplied by user',updated:[],unchanged:[],warnings:[],backup:backupDir};
const normUnit=u=>String(u).replaceAll('²','2').replaceAll('·','').replaceAll('/','').replaceAll(' ','').toLowerCase();
for(let j=0;j<next.lines.length;j++){
 const l=next.lines[j];if(l.kind!=='work')continue;
 const source=l.production?.definition.source_work_id??Number(l.catalogId?.match(/^Перечень_работ:(\d+)$/)?.[1]);
 let d;
 if(source===95){
  d=structuredClone(catalog.operations.find(x=>x.source_work_id===95));
  const hourCost=d.parameters.cost_per_person_hour.value,hourTariff=d.parameters.internal_person_hour_tariff.value,output=1.2;
  Object.assign(d,{id:'naves-welding-per-meter',code:'Р95.М',name:'Сварка металлоконструкций',unit:'м',quantity_basis:'Длина сварных швов. Выработка 1,2 м за человеко-час — уточнение пользователя 19.11.2026.',calculation_method:'output_per_hour',resource_type:'labor',origin:'input',status:'needs_review',resource_costing:true,productivity:{value:output,unit:'м',basis:'person',period:'hour',origin:'input'}});
  d.financial_basis+='; часовые затраты из исходной модели, выработка 1,2 м/ч задана пользователем 19.11.2026';
  d.parameters={order_quantity:{value:null,origin:'input'},output_per_hour:{value:output,origin:'input'},person_hours_per_unit:{value:1/output,origin:'input'},cost_per_person_hour:{value:hourCost,origin:'catalog'},machine_hours_per_unit:{value:0},cost_per_machine_hour:{value:0},supplies_or_purchased_cost_per_unit:{value:0},internal_person_hour_tariff:{value:hourTariff,origin:'catalog'}};
  d.pricing={base_unit_price:hourTariff/output,current_unit_price:hourTariff/output,hourly_rate:hourTariff,base_hourly_rate:hourTariff,manual_override:false,source_formula:'',source_parameters:structuredClone(d.parameters),formula_note:'Время = длина швов / 1,2. Себестоимость = время × стоимость часа труда.'};
  d.cost_model={unit_cost:hourCost/output,labor_cost_per_person_hour:hourCost};
 }else{
  const matches=catalog.operations.filter(x=>x.source_work_id===source&&!['inactive','out_of_scope'].includes(x.status)&&normUnit(x.unit)===normUnit(l.unit));
  if(matches.length!==1){report.unchanged.push({id:l.id,name:l.name,quantity:l.qty,unit:l.unit,reason:source===144?'Проект задан в часах, новая база — в резах/проходах; количество резов не известно':'Нет однозначного соответствия в новой базе'});continue;}
  d=structuredClone(matches[0]);d.name=l.name;
 }
 core.definition(d);
 const before={unit:l.unit,quantity:l.qty,tariff:l.price,unitCost:l.production?.definition.cost_model.unit_cost??null};
 const inputs=structuredClone(l.production.inputs);
 const production={...l.production,definition:d,inputs};
 Object.assign(l,{name:d.name,unit:d.unit,price:d.pricing.current_unit_price,basePrice:d.pricing.base_unit_price,baseUnit:d.unit,sourceFormula:d.pricing.source_formula,sourceParameters:structuredClone(d.pricing.source_parameters),source:d.financial_basis,group:d.shop_id,workshop:d.shop_id,production});
 if(d.calculation_method==='unique_program_prep')l.production.inputs.unique_program_id||='Основная программа лазерного раскроя';
 report.updated.push({id:l.id,name:l.name,before,after:{unit:l.unit,quantity:l.qty,tariff:l.price,unitCost:core.resourceUnitCost(d)},sourceWorkId:source});
}
next.updated=now;delete next.archive;delete next.approval;
schema.calculation(next);
assert.deepEqual(next.lines.filter(l=>l.kind==='material'),original.lines.filter(l=>l.kind==='material'),'Materials must remain unchanged');
assert.deepEqual(next.lines.map(l=>({id:l.id,qty:l.qty,scope:l.scope})),original.lines.map(l=>({id:l.id,qty:l.qty,scope:l.scope})),'Quantities, identity and quantity bases must remain unchanged');
assert.equal(report.updated.length,14);assert.equal(report.unchanged.length,2);
const zinc=next.lines.find(l=>l.production?.definition.source_work_id===190),weld=next.lines.find(l=>l.production?.definition.id==='naves-welding-per-meter');
assert.equal(zinc.unit,'м²');assert.equal(zinc.qty,8);assert.equal(weld.unit,'м');assert.equal(weld.qty,30);
assert.ok(Math.abs(core.calculateLine(weld.production.definition,weld.production.inputs).plannedCost-34329.7697368421)<1e-7);
assert.ok(Math.abs(core.calculateLine(zinc.production.definition,zinc.production.inputs).plannedCost-3147.2587719298244)<1e-7);
const result=globalThis.CostEngine.calculate(next);
report.result={knownTariffBase:result.preMarkupBase,knownSaleTotal:result.total,completeCost:result.plannedCost,errors:result.errors};
report.warnings.push('Объёмы сохранены по просьбе заменить стоимости; прежние миграционные количества в физических единицах не являются обмером проекта.');
report.warnings.push('Есть строка порошковой покраски без объёма. Полный итог пока не определён.');
report.warnings.push('Ставки собственного лазера в новой базе не включают сопровождение оператора; соответствующей отдельной операции в проекте нет. Новые строки не добавлялись.');
const revisedLibrary=structuredClone(library),saved=archive.capture(next);revisedLibrary.updatedAt=now;revisedLibrary.revisions.push({id:crypto.randomUUID(),date:now,calculation:saved});
assert.deepEqual(revisedLibrary.revisions.slice(0,-1),library.revisions,'Prior revisions must remain unchanged');
const revisedDraft={...draft,updatedAt:now,calculation:next};
const changes=[{collection:draftRecord.collection,id:draftRecord.entity_id,expectedRevision:draftRecord.rev,value:revisedDraft},{collection:libraryRecord.collection,id:libraryRecord.entity_id,expectedRevision:libraryRecord.rev,value:revisedLibrary}];
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'Навес_ТПУ_актуальные_стоимости.json'),JSON.stringify(next,null,2));
fs.writeFileSync(path.join(outDir,'changes.json'),JSON.stringify(report,null,2));
fs.writeFileSync(path.join(outDir,'Навес_ТПУ_новая_версия_для_базы.json'),JSON.stringify({format:'izdelie-library',version:2,exportedAt:now,entries:[revisedLibrary]},null,2));
console.log(JSON.stringify({prepared:true,updated:report.updated.length,unchanged:report.unchanged.length,weldingCostPerMeter:core.resourceUnitCost(weld.production.definition),weldingCost:core.calculateLine(weld.production.definition,weld.production.inputs).plannedCost,output:outDir}));
if(!process.argv.includes('--apply'))process.exit(0);
(async()=>{
 const {startServer}=require('../portable/server.cjs');let local;
 try{
  local=await startServer({root:installedRoot,port:0});
  const before=await (await fetch(local.origin+'/api/records')).json(),flat=protocol.flatten(before.data);
  for(const c of changes){assert.equal(before.versions[protocol.key(c.collection,c.id)],c.expectedRevision,'Project changed while preparing update');assert.equal(JSON.stringify(flat[protocol.key(c.collection,c.id)].value),JSON.stringify(JSON.parse(c.collection===draftRecord.collection?draftRecord.payload:libraryRecord.payload)),'Project contents changed');}
  const afterFlat={...flat};for(const c of changes)afterFlat[protocol.key(c.collection,c.id)]=c;schema.dataset(protocol.expand(Object.values(afterFlat)));
  fs.writeFileSync(path.join(backupDir,'dataset-before-apply.json'),JSON.stringify(before,null,2));
  const response=await fetch(local.origin+'/api/records',{method:'PUT',headers:{origin:local.origin,'content-type':'application/json'},body:JSON.stringify({changes})});
  const answer=await response.json();if(!response.ok)throw Error('Update rejected: '+JSON.stringify(answer));
  const after=await (await fetch(local.origin+'/api/records')).json(),afterRecords=protocol.flatten(after.data);
  for(const c of changes){assert.equal(after.versions[protocol.key(c.collection,c.id)],c.expectedRevision+1);assert.deepEqual(afterRecords[protocol.key(c.collection,c.id)].value,c.value);}
  for(const [key,r]of Object.entries(flat))if(!changes.some(c=>protocol.key(c.collection,c.id)===key))assert.deepEqual(afterRecords[key],r,'Unrelated record changed');
  const checkDb=new DatabaseSync(path.join(installedRoot,'data/calculator.sqlite'),{readOnly:true});for(const c of changes){const r=checkDb.prepare('SELECT rev,payload FROM entity_records WHERE collection=? AND entity_id=?').get(c.collection,c.id);assert.equal(r.rev,c.expectedRevision+1);assert.deepEqual(JSON.parse(r.payload),c.value);}checkDb.close();
  fs.writeFileSync(path.join(outDir,'applied.json'),JSON.stringify({appliedAt:now,database:path.join(installedRoot,'data/calculator.sqlite'),updatedRecords:changes.map(c=>({collection:c.collection,id:c.id,revision:c.expectedRevision+1})),updatedOperations:report.updated.length,previousLibraryRevisions:library.revisions.length,libraryRevisions:revisedLibrary.revisions.length,verifiedReadback:true},null,2));
  console.log('Applied and verified: working draft + new library revision; all unrelated records unchanged.');
 }finally{if(local)await new Promise(resolve=>local.server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
