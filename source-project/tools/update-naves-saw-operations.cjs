// Apply the two corrected operation definitions without guessing physical quantities.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {DatabaseSync,backup}=require('node:sqlite');
const core=require('../dist/production-model-core.js'),catalog=require('../dist/production-catalog.js'),schema=require('../dist/domain-schema.js'),protocol=require('../dist/record-protocol.js');
require('../dist/engine.js');require('../dist/review-core.js').install(globalThis.CostEngine);const archive=require('../dist/calculation-archive.js');
const workspace=path.resolve(__dirname,'../..'),dbPath=JSON.parse(fs.readFileSync(path.join(workspace,'outputs/naves-tpu-prices-2026-11-19/applied.json'),'utf8')).database,installedRoot=path.dirname(path.dirname(dbPath));
const backupDir=path.join(workspace,'backups/naves-tpu-saw-operations-2026-11-19'),outDir=path.join(workspace,'outputs/naves-tpu-saw-operations-2026-11-19');
assert.ok(dbPath.replaceAll('\\','/').endsWith('Calculator-Windows-x64-2026-11-19T07-20-41-020Z/data/calculator.sqlite'));
(async()=>{
 if(fs.existsSync(path.join(outDir,'applied.json')))throw Error('This correction has already been applied; do not repeat it over later edits.');
 fs.mkdirSync(backupDir,{recursive:true});fs.mkdirSync(outDir,{recursive:true});
 const db=new DatabaseSync(dbPath,{readOnly:true});const rows=db.prepare('SELECT collection,entity_id,payload,rev FROM entity_records').all();
 const draftRow=rows.find(r=>r.collection==='izdelie-working-drafts-v1'&&JSON.parse(r.payload).calculation?.name==='Навес ТПУ');assert.ok(draftRow);
 const draft=JSON.parse(draftRow.payload),original=draft.calculation,next=structuredClone(original),libraryRow=rows.find(r=>r.collection==='izdelie-library-v2'&&r.entity_id===original.libraryId),library=JSON.parse(libraryRow.payload);
 assert.equal(library.revisions.length,2,'Expected the previously updated project version');
 if(!fs.existsSync(path.join(backupDir,'calculator-before.sqlite')))await backup(db,path.join(backupDir,'calculator-before.sqlite'));db.close();
 fs.writeFileSync(path.join(backupDir,'working-draft-before.json'),JSON.stringify(draftRow,null,2));fs.writeFileSync(path.join(backupDir,'library-before.json'),JSON.stringify(libraryRow,null,2));
 const changesReport=[];
 for(const [oldCatalog,id]of [['suggest-wood-crosscut','production-wood-board-trimming'],['Перечень_работ:144','production-Р144']]){
  const line=next.lines.find(l=>l.catalogId===oldCatalog);assert.ok(line);const before={name:line.name,unit:line.unit,quantity:line.qty,rate:line.price};
  const d=structuredClone(catalog.operations.find(x=>x.id===id));assert.ok(d);core.definition(d);
  Object.assign(line,{name:d.name,unit:d.unit,qty:null,price:d.pricing.current_unit_price,basePrice:d.pricing.base_unit_price,baseUnit:d.unit,source:d.financial_basis,sourceFormula:d.pricing.source_formula,sourceParameters:structuredClone(d.pricing.source_parameters),group:d.shop_id,workshop:d.shop_id});
  line.production={...line.production,definition:d,inputs:{quantity:null},productId:line.production?.productId||next.name,segment:line.production?.segment||'Основной',workPackage:line.production?.workPackage||'Основной',selected:line.production?.selected!==false};
  changesReport.push({id:line.id,before,after:{name:line.name,unit:line.unit,quantity:null,rate:line.price,unitCost:core.resourceUnitCost(d),shop:d.shop_id,post:catalog.postNames[d.post_id]},reason:'Часовой объём не переносится в число торцов/резов; поле оставлено пустым по указанию пользователя.'});
 }
 assert.equal(changesReport.length,2);
 for(const line of next.lines)if(!changesReport.some(c=>c.id===line.id))assert.deepEqual(line,original.lines.find(x=>x.id===line.id),'Other positions must remain unchanged');
 const wood=next.lines.find(l=>l.catalogId==='suggest-wood-crosscut'),saw=next.lines.find(l=>l.catalogId==='Перечень_работ:144');
 assert.equal(wood.unit,'торец');assert.equal(wood.qty,null);assert.equal(wood.price,67.875);assert.equal(saw.unit,'рез');assert.equal(saw.qty,null);assert.equal(saw.price,79.64);
 assert.ok(Math.abs(core.calculateLine(wood.production.definition,{quantity:1}).plannedCost-46.81332236842105)<1e-8);
 assert.ok(Math.abs(core.calculateLine(saw.production.definition,{quantity:1}).plannedCost-54.927631578947356)<1e-8);
 assert.throws(()=>core.calculateLine(wood.production.definition,{quantity:null}),/Объём/);assert.throws(()=>core.calculateLine(saw.production.definition,{quantity:null}),/Объём/);
 const now=new Date().toISOString();next.updated=now;delete next.archive;delete next.approval;schema.calculation(next);
 const revisedLibrary=structuredClone(library);revisedLibrary.updatedAt=now;revisedLibrary.revisions.push({id:crypto.randomUUID(),date:now,calculation:archive.capture(next)});assert.deepEqual(revisedLibrary.revisions.slice(0,-1),library.revisions);
 const updatedDraft={...draft,updatedAt:now,calculation:next},changes=[{collection:draftRow.collection,id:draftRow.entity_id,expectedRevision:draftRow.rev,value:updatedDraft},{collection:libraryRow.collection,id:libraryRow.entity_id,expectedRevision:libraryRow.rev,value:revisedLibrary}];
 fs.writeFileSync(path.join(outDir,'Навес_ТПУ_торцевание_и_ленточная_пила.json'),JSON.stringify(next,null,2));fs.writeFileSync(path.join(outDir,'changes.json'),JSON.stringify(changesReport,null,2));
 console.log(JSON.stringify({prepared:true,updates:changesReport.map(c=>c.after),libraryVersion:revisedLibrary.revisions.length}));
 if(!process.argv.includes('--apply'))return;
 const workerPath=path.join(installedRoot,'app/worker.mjs'),manifestPath=path.join(installedRoot,'SHA256SUMS.txt'),builtWorker=path.join(__dirname,'../dist/server/index.js');
 const manifest=fs.readFileSync(manifestPath,'utf8'),workerEntry=manifest.split(/\r?\n/).find(l=>l.endsWith('  app/worker.mjs'));assert.ok(workerEntry);
 const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');assert.equal(workerEntry.slice(0,64),sha(workerPath),'Installed worker must match its manifest before replacement');
 for(const [file,name]of [[workerPath,'worker-before.mjs'],[manifestPath,'SHA256SUMS-before.txt']])if(!fs.existsSync(path.join(backupDir,name)))fs.copyFileSync(file,path.join(backupDir,name));
 fs.copyFileSync(builtWorker,workerPath);fs.writeFileSync(manifestPath,manifest.replace(workerEntry,sha(workerPath)+'  app/worker.mjs'));assert.equal(sha(workerPath),sha(builtWorker));
 let local;try{
  local=await require('../portable/server.cjs').startServer({root:installedRoot,port:0});
  const servedCatalog=await (await fetch(local.origin+'/production-catalog.js')).text();assert.ok(servedCatalog.includes('production-wood-board-trimming'));assert.ok(servedCatalog.includes('P44'));
  const snapshot=await (await fetch(local.origin+'/api/records')).json(),flat=protocol.flatten(snapshot.data);
  for(const c of changes){assert.equal(snapshot.versions[protocol.key(c.collection,c.id)],c.expectedRevision);assert.deepEqual(flat[protocol.key(c.collection,c.id)].value,JSON.parse(c.collection===draftRow.collection?draftRow.payload:libraryRow.payload));}
  const afterFlat={...flat};for(const c of changes)afterFlat[protocol.key(c.collection,c.id)]=c;schema.dataset(protocol.expand(Object.values(afterFlat)));
  const response=await fetch(local.origin+'/api/records',{method:'PUT',headers:{origin:local.origin,'content-type':'application/json'},body:JSON.stringify({changes})});if(!response.ok)throw Error('Update rejected: '+await response.text());
  const after=await (await fetch(local.origin+'/api/records')).json(),verified=protocol.flatten(after.data);
  for(const c of changes){assert.equal(after.versions[protocol.key(c.collection,c.id)],c.expectedRevision+1);assert.deepEqual(verified[protocol.key(c.collection,c.id)].value,c.value);}
  for(const [key,value]of Object.entries(flat))if(!changes.some(c=>protocol.key(c.collection,c.id)===key))assert.deepEqual(verified[key],value);
  const check=new DatabaseSync(dbPath,{readOnly:true});for(const c of changes)assert.deepEqual(JSON.parse(check.prepare('SELECT payload FROM entity_records WHERE collection=? AND entity_id=?').get(c.collection,c.id).payload),c.value);check.close();
  fs.writeFileSync(path.join(outDir,'applied.json'),JSON.stringify({database:dbPath,appliedAt:now,libraryVersion:revisedLibrary.revisions.length,verifiedReadback:true,changedOperations:2,quantitiesLeftEmpty:true},null,2));console.log('Applied and verified; prior versions and all other records unchanged.');
 }finally{if(local)await new Promise(resolve=>local.server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1});
