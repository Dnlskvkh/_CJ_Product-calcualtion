const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const core=require('./dist/model-spec-core.js'),schema=require('./dist/domain-schema.js'),protocol=require('./dist/record-protocol.js');
const example=fs.readFileSync('SKETCHUP_SPEC_EXAMPLE.json','utf8'),spec=core.parse(example),copy=()=>structuredClone(spec);
assert.equal(core.parse('```json\n'+example+'\n```').parts.length,2);
for(const mutate of [s=>s.version=2,s=>s.parts[1].id=s.parts[0].id,s=>s.parts[0].quantity.value='1',s=>s.parts[0].quantity.value=-1,s=>s.parts[0].quantity.value=2,s=>s.parts[0].metrics[0].unit='м',s=>s.parts[0].quantity.evidence_refs=['absent'],s=>s.assemblies[0].parent_id='A1',s=>s.requirements[0].process_id='missing',s=>s.parts[1].occurrence_refs[0]=s.parts[0].occurrence_refs[0]]){const invalid=copy();mutate(invalid);assert.throws(()=>core.validate(invalid));}
assert.throws(()=>core.parse('{"format":"cj-model-spec","version":1,"__proto__":{}}'),/ключ/);
const foreign=copy();foreign.products.push({id:'P2',name:'Другое',batch_qty:1,evidence_refs:[]});foreign.parts[1].product_id='P2';assert.throws(()=>core.validate(foreign));
const catalog=[{id:'panel-area',name:'Фанера',kind:'material',unit:'м²',price:100},{id:'screws',name:'Саморез TX25',kind:'material',unit:'шт.',price:3},{id:'paint',name:'Краска',kind:'material',unit:'л',price:200},{id:'labor',name:'Нанесение покрытия',kind:'work',unit:'н/ч',price:500},{id:'old',name:'АРХИВ Краска',kind:'material',unit:'л',price:1},{id:'stub',name:'Саморез TX25',sheet:'Крепёжные_элементы_Заглушка',kind:'material',unit:'шт.',price:1}];
const rows=core.rows(spec,'P1'),part=rows.find(r=>r.key==='part-D1'),fastener=rows.find(r=>r.key==='part-D2'),work=rows.find(r=>r.key==='work-W1'),paint=rows.find(r=>r.key==='resource-R1'),tool=rows.find(r=>r.key==='resource-R2');
assert(tool.disabled);assert(!core.candidates(paint,catalog).some(c=>c.id==='old'));assert(!core.candidates(fastener,catalog).some(c=>c.id==='stub'));
const area={...core.config(part,catalog),catalogId:'panel-area',unit:'м²',driver:'face_area',selected:true};
assert.equal(core.amount(spec,part,area).value,0.5);
assert.equal(core.amount(spec,part,{...area,driver:'count',unit:'шт.'}).value,null);
assert.equal(core.amount(spec,work,{...core.config(work,catalog),unit:'н/ч',driver:'coating_area',factor:0.25,note:'Учебная норма проверки'}).value,null,'Unknown coating area must not fall back to face area');
const coating=copy();coating.parts[0].metrics.find(m=>m.key==='coating_area').value=1.25;Object.assign(coating.parts[0].metrics.find(m=>m.key==='coating_area'),{status:'observed',evidence_refs:['E1']});
const labor={...core.config(work,catalog),selected:true,catalogId:'labor',unit:'н/ч',driver:'coating_area',factor:0.25,note:'Искусственная норма теста: ч/м² на всю систему'};
assert.equal(core.amount(coating,work,labor).value,0.3125);
const consumption={...core.config(paint,catalog),selected:true,catalogId:'paint',unit:'л',driver:'coating_area',factor:0.2,note:'Искусственная норма теста: л/м² на всю систему',inclusion:'separate'};
assert.equal(core.amount(coating,paint,consumption).value,0.25);
const processVolume=copy();Object.assign(processVolume.process_candidates[0].measure,{value:1.25,status:'observed',evidence_refs:['E1']});assert.equal(core.drive(processVolume,paint,'measure').value,1.25,'Resource norm must use its process volume, not its own unknown quantity');
const knownResource=copy();Object.assign(knownResource.requirements[0].quantity,{value:2,unit:'л',status:'observed',evidence_refs:['E1']});const knownRow=core.rows(knownResource,'P1').find(r=>r.key==='resource-R1');assert.equal(core.config(knownRow,[]).driver,'resource_quantity');assert.equal(core.amount(knownResource,knownRow,core.config(knownRow,[])).value,2);
assert.equal(core.amount(coating,paint,{...consumption,note:''}).value,null);
assert.equal(core.amount(coating,paint,{...consumption,factor:0}).value,null);
assert.equal(core.amount(coating,paint,{...consumption,manual:0}).value,0);
const batch=structuredClone(coating);batch.parts[0].quantity.basis='batch';assert.equal(core.amount(batch,paint,consumption).scope,'batch');
const inferred=structuredClone(coating);inferred.parts[0].metrics.find(m=>m.key==='coating_area').status='inferred';assert.equal(core.amount(inferred,paint,consumption).value,null);
const template=core.template({version:1,id:'t1',name:'Покрытие — тест',profile:'spec',rules:[{key:work.templateKey,catalogId:'labor',unit:'н/ч',driver:'coating_area',factor:0.25,note:labor.note,estimate:false,inclusion:'separate',selected:true}]});
const reused=core.config(work,catalog,template);assert(reused.selected);assert.equal(reused.manual,null);assert.equal(core.amount(coating,work,reused).value,0.3125);
const conflict=structuredClone(template);conflict.rules[0].factor=0.5;const merged=core.mergeTemplates({t1:template},{t1:conflict},()=> 't2');assert.equal(Object.keys(merged).length,2);assert.equal(merged.t1.rules[0].factor,0.5);assert.equal(merged.t2.rules[0].factor,0.25);
const dataset={[core.TEMPLATE_KEY]:JSON.stringify({t1:template})};schema.dataset(dataset);assert.deepEqual(protocol.expand(Object.values(protocol.flatten(dataset))),dataset);
const invalidTemplate=structuredClone(template);invalidTemplate.rules[0].note='';assert.throws(()=>schema.dataset({[core.TEMPLATE_KEY]:JSON.stringify({t1:invalidTemplate})}));
globalThis.OperationsCore=require('./dist/operations-core.js');const engine=require('./dist/engine.js');
const blank=()=>({version:1,engineVersion:'cost-v1',name:'Тест',code:'',client:'',notes:'',type:'МАФ',scope:'Изготовление',qty:10,overhead:7,transport:6,markup:40,vat:22,lines:[]});
const makeLine=(id,kind)=>{const c=catalog.find(c=>c.id===id);return {id:crypto.randomUUID(),catalogId:c?.id||'',name:c?.name||'',kind,unit:c?.unit||'шт.',qty:null,price:c?.price??null,reserve:0,pack:1,scope:'unit',allocation:'whole',group:'Общее',source:'Тест',confirmed:false};};
const initial=blank(),before=JSON.stringify(initial),items=[{row:part,config:area},{row:work,config:labor},{row:paint,config:consumption},{row:tool,config:{selected:true}}];
const result=core.apply(initial,coating,'P1',items,makeLine);assert.equal(JSON.stringify(initial),before);assert.equal(result.added,3);schema.calculation(result.state);
assert.equal(result.state.lines[1].qty,0.3125);assert.equal(result.state.lines[2].qty,0.25);assert.equal(result.state.modelSpecImports[0].notices.filter(n=>n.includes('Бита')).length,1);
const cost=engine.calculate(result.state);assert.equal(cost.errors.length,0);assert.equal(cost.M,1100);assert.equal(cost.W,1562.5);
const doubled=engine.calculate(result.state,20);assert.equal(doubled.M,2000);assert.equal(doubled.W,cost.W*2);
const publicDoc=require('./dist/business-core.js').publicDocument({number:'test',date:'',validUntil:'',subject:'',client:'',contact:'',payment:'',delivery:'',leadtime:'',warranty:'',comment:'',discount:0,items:[{name:'Тест',qty:10,calculation:result.state,override:null}]},{},engine.calculate);assert(!JSON.stringify(publicDoc).includes('modelSpec'));assert(!JSON.stringify(publicDoc).includes('Искусственная норма'));
assert.throws(()=>core.apply(result.state,coating,'P1',items,makeLine),/уже добавлены/);
const revised=structuredClone(coating);revised.source.revision='demo-2';assert.throws(()=>core.apply(result.state,revised,'P1',items,makeLine),/Другая ревизия/);
assert.throws(()=>core.apply(initial,coating,'P1',[{row:paint,config:{...consumption,inclusion:'unknown'}}],makeLine),/включён/);
assert.throws(()=>core.apply(initial,coating,'P1',[{row:paint,config:{...consumption,inclusion:'included'}}],makeLine),/включён/);
const included=copy();included.requirements[0].inclusion='included';included.requirements[0].evidence_refs=['E1'];assert(core.rows(included,'P1').find(r=>r.key==='resource-R1').disabled);
const purchased=copy();purchased.assemblies[0].supply_mode='purchased';assert(core.rows(purchased,'P1').filter(r=>r.type==='part').every(r=>r.disabled));
purchased.requirements[0].part_ids=[];assert(core.rows(purchased,'P1').find(r=>r.key==='resource-R1').disabled,'Resource must inherit its process purchase exclusion');
const unknown=core.apply(initial,spec,'P1',[{row:part,config:{...area,driver:'mass',unit:'кг',catalogId:''}}],makeLine);assert.equal(unknown.state.lines[0].qty,null);assert.equal(unknown.state.lines[0].price,null);
const alternatives=core.rows(coating,'P1').filter(r=>r.type==='work');alternatives.forEach(r=>r.entity.alternative_group='test-route');assert.throws(()=>core.apply(initial,coating,'P1',alternatives.map(row=>({row,config:{...core.config(row,catalog),selected:true}})),makeLine),/взаимоисключающие/);
// Alternative groups must also include lines imported in earlier applications.
for(const type of ['work','resource']){
 const routes=structuredClone(coating);
 if(type==='work')routes.process_candidates.forEach(w=>w.alternative_group='test-route');
 else{routes.requirements[0].alternative_group='test-route';routes.requirements.push({...structuredClone(routes.requirements[0]),id:'R-alternative'});}
 core.validate(routes);
 const choices=core.rows(routes,'P1').filter(r=>r.type===type&&r.entity.alternative_group==='test-route').map(row=>({row,config:{...core.config(row,catalog),selected:true,catalogId:type==='work'?'labor':'paint',unit:type==='work'?'н/ч':'л',manual:1,inclusion:'separate'}}));
 assert.equal(choices.length,2);
 assert.throws(()=>core.apply(initial,routes,'P1',choices,makeLine),/взаимоисключающие/);
 const first=core.apply(initial,routes,'P1',[choices[0]],makeLine).state;
 // JSON round-trip models reopening an existing calculation without new metadata.
 const reopened=JSON.parse(JSON.stringify(first)),snapshot=JSON.stringify(reopened);
 assert.throws(()=>core.apply(reopened,routes,'P1',[{row:part,config:area},choices[1]],makeLine),/взаимоисключающие/);
 assert.equal(JSON.stringify(reopened),snapshot,'Rejected import must preserve the calculation');
 const combined=core.apply(reopened,routes,'P1',[choices[0],{row:part,config:area}],makeLine);
 assert.equal(combined.added,1,'An existing identical choice must not block an unrelated new row');
 assert.equal(combined.state.lines.length,2);
 assert.throws(()=>core.apply(reopened,routes,'P1',[choices[0]],makeLine),/уже добавлены/);
 const deleted=structuredClone(reopened);deleted.lines=[];
 assert.equal(core.apply(deleted,routes,'P1',[choices[1]],makeLine).added,1,'Removing the old alternative permits replacement');
 const foreignDocument=structuredClone(reopened);foreignDocument.lines[0].modelSpecOrigin.documentKey='spec-other-document';
 assert.equal(core.apply(foreignDocument,routes,'P1',[choices[1]],makeLine).added,1,'Group names from other documents must not conflict');
}
const store=new Map([['izdelie-state',JSON.stringify(initial)],['izdelie-recovery','old-recovery']]);let fail=true;const storage={getItem:k=>store.get(k)??null,setItem(k,v){if(k==='izdelie-state'&&fail){fail=false;throw Error('Quota');}store.set(k,v);},removeItem:k=>store.delete(k)};
assert.throws(()=>core.saveWithRecovery(storage,result.state,initial),/не применён/);assert.equal(store.get('izdelie-state'),JSON.stringify(initial));assert.equal(store.get('izdelie-recovery'),'old-recovery');core.saveWithRecovery(storage,result.state,initial);assert.deepEqual(JSON.parse(store.get('izdelie-recovery')),initial);
// Full browser module order: preview is read-only, failed write keeps the open dialog and state.
const elements=new Map(),el=()=>({innerHTML:'',textContent:'',value:'',style:{},open:false,disabled:false,checked:false,classList:{toggle(){},add(){},remove(){}},append(){},prepend(){},insertAdjacentHTML(){},querySelector(){return null},querySelectorAll(){return []},setAttribute(){},focus(){},showModal(){this.open=true},close(){this.open=false}}),browserStore=new Map();
const ctx={console,crypto,structuredClone,TextEncoder,Intl,Date,Math,JSON,Map,Set,WeakMap,Number,String,Object,Array,Blob,URL,setTimeout(){},clearTimeout(){},location:{protocol:'file:'},navigator:{onLine:false},document:{getElementById(id){if(!elements.has(id))elements.set(id,el());return elements.get(id);},createElement:el,querySelectorAll(){return []}},localStorage:{getItem:k=>browserStore.get(k)??null,setItem:(k,v)=>browserStore.set(k,v),removeItem:k=>browserStore.delete(k)},fetch:async()=>{throw Error('offline')},addEventListener(){},scrollTo(){},matchMedia:()=>({matches:false})};ctx.document.body={append(){}};ctx.window=ctx;vm.createContext(ctx);
const scripts=[...fs.readFileSync('dist/index.html','utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);for(const file of scripts)if(file!=='graph-react.js')vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),ctx,{filename:file});
assert(fs.readFileSync('dist/model-spec-ui.js','utf8').includes('oninput="modelSpecChange(${i},\'unit\',this.value)"'),'Unit edits must update the preview during input');
ctx.testSpec=example;vm.runInContext(`state=blank();const beforePreview=JSON.stringify(state);modelSpecDialog();$('fill-json').value=testSpec;modelSpecParse();if(JSON.stringify(state)!==beforePreview)throw Error('Preview mutated calculation');modelSpecDraft.useCard=false;const oldWrite=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota')};modelSpecCommit();if(JSON.stringify(state)!==beforePreview||!$('modal').open)throw Error('Failed import changed state or closed preview');localStorage.setItem=oldWrite;modelSpecCommit();if(state.lines.length!==2)throw Error('Import did not add parts');const firstLine=state.lines[0];if(!firstLine.modelSpecOrigin)throw Error('Missing provenance');const clean=cleanCalculation(state);if(!clean.modelSpecImports||!clean.lines[0].modelSpecOrigin)throw Error('Copy dropped provenance');const saved=CalculationArchive.capture(state);const copied=cleanCalculation(saved);if(copied.archive.signature!==CalculationArchive.signature(copied))throw Error('Archive signature was lost');modelSpecRestore();if(state.lines.length)throw Error('Recovery did not restore state');`,ctx);
const uiAlternatives=copy();uiAlternatives.process_candidates.forEach(w=>w.alternative_group='test-route');ctx.testAlternatives=JSON.stringify(uiAlternatives);
vm.runInContext(`
 state=blank();
 function chooseAlternative(key){
  modelSpecDialog();$('fill-json').value=testAlternatives;modelSpecParse();modelSpecDraft.useCard=false;
  for(const item of modelSpecDraft.items){item.config.selected=item.row.key===key;if(item.config.selected)item.config.manual=1;}
 }
 chooseAlternative('work-W1');modelSpecCommit();
 if(state.lines.length!==1||$('modal').open)throw Error('First alternative was not imported');
 state=cleanCalculation(state);
 const beforeAlternative=JSON.stringify(state),beforeStoredAlternative=localStorage.getItem('izdelie-state'),beforeRecoveryAlternative=localStorage.getItem('izdelie-recovery');
 chooseAlternative('work-W2');modelSpecCommit();
 if(!$('modal').open||!$('fill-error').textContent.includes('взаимоисключающие'))throw Error('Missing visible alternative conflict');
 if(JSON.stringify(state)!==beforeAlternative||localStorage.getItem('izdelie-state')!==beforeStoredAlternative||localStorage.getItem('izdelie-recovery')!==beforeRecoveryAlternative)throw Error('Alternative conflict changed calculation or recovery');
`,ctx);
console.log('Model specification: validation, provenance, units, norms, hours, quantity bases, tools, included resources, templates/CAS merge, repeat imports, sequential alternative conflicts, version conflicts, rollback, script order and archive/copy UI flow passed.');
