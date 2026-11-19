const fs=require('node:fs'),path=require('node:path');const root=__dirname,target=path.join(root,'site-edit');
const copy=(from,to=from)=>{fs.mkdirSync(path.dirname(path.join(target,to)),{recursive:true});fs.copyFileSync(path.join(root,from),path.join(target,to))};
fs.copyFileSync(path.join(target,'ui-smoke-check.cjs'),path.join(target,'review-ui-smoke-check.cjs'));
for(const f of fs.readdirSync(path.join(root,'dist')))if(f.endsWith('.js')&&!['app.js','business-core.js'].includes(f))copy('dist/'+f);
for(const f of ['worker/api.js','worker/records.js','build-worker.cjs','build-rates.cjs','drizzle/0001_record_storage.sql','drizzle/meta/_journal.json','dist/operation-rates.json','operations-check.cjs','operation-rates-check.cjs','architecture-check.cjs','ui-smoke-check.cjs','run-checks.cjs','preview-server.cjs','ARCHITECTURE.txt'])copy(f);
for(const f of fs.readdirSync(path.join(root,'tests/regression')))copy('tests/regression/'+f);
function edit(p,a,b){p=path.join(target,p);const s=fs.readFileSync(p,'utf8');if(!s.includes(a))throw Error('Missing '+p+' '+a.slice(0,45));fs.writeFileSync(p,s.replace(a,b))}
edit('dist/app.js',"version:1,name:'Новое изделие'","version:1,draftId:crypto.randomUUID(),schemaVersion:1,engineVersion:'cost-review-v1',name:'Новое изделие'");
let app=fs.readFileSync(path.join(target,'dist/app.js'),'utf8'),a=app.indexOf('function validState('),b=app.indexOf('\nfunction persist(',a);app=app.slice(0,a)+"function validState(s){try{DomainSchema.calculation(s);return true}catch{return false}}"+app.slice(b);fs.writeFileSync(path.join(target,'dist/app.js'),app);
edit('dist/app.js',"if(page===0&&typeof projectCard", "if(page===2)body=operationsCard()+body;\n if(page===0&&typeof projectCard");
edit('dist/app.js',"function editLine(id){const l=state.lines.find(x=>x.id===id);if(!l)return;", "function editLine(id){const l=state.lines.find(x=>x.id===id);if(!l)return;if(l.operation){operationDialog(id);return;}");
edit('dist/app.js',"${money(l.amount)}${kind==='material'", "${money(l.amount)}${l.operationCost?`<span class=\"source\">Подготовка: ${money(l.operationCost.setup)} · до минимума: ${money(l.operationCost.minimumExtra)}</span>`:''}${kind==='material'");
edit('dist/app.js',"r.rows.filter(l=>l.kind==='work'&&l.scope==='batch').reduce((t,l)=>t+(l.amount||0),0)","r.rows.filter(l=>l.kind==='work').reduce((t,l)=>t+(l.operationCost?l.operationCost.setup:(l.scope==='batch'?l.amount||0:0)),0)");
edit('dist/index.html','<script src="engine.js">','<script src="domain-schema.js"></script><script src="operations-core.js"></script><script src="engine.js">');
edit('dist/index.html','<script src="business-core.js">','<script src="calculation-archive.js"></script><script src="business-core.js">');
edit('dist/index.html','<script src="cloud.js">','<script src="operation-rates-core.js"></script><script src="operation-rates-data.js"></script><script src="rate-repository.js"></script><script src="operation-editor-store.js"></script><script src="operation-rates.js"></script><script src="operations.js"></script><script src="record-protocol.js"></script><script src="cloud.js">');
edit('dist/cloud.js','RateRepository.LEGACY_KEY]','RateRepository.LEGACY_KEY,\'izdelie-offcuts-v1\',\'izdelie-working-drafts-v1\',\'izdelie-price-review-v1\']');
edit('dist/cloud.js','[STOCK_KEY,LINK_KEY,PROJECTS_KEY]','[STOCK_KEY,LINK_KEY,PROJECTS_KEY,\'izdelie-offcuts-v1\']');
edit('dist/cloud.js','out[OP_RATES_KEY]=JSON.stringify(',"const draftKey='izdelie-working-drafts-v1',draftMap={...parse(remote,draftKey,{})};for(const [id,v] of Object.entries(parse(local,draftKey,{})))if(!draftMap[id]||v.updatedAt>draftMap[id].updatedAt)draftMap[id]=v;out[draftKey]=JSON.stringify(draftMap);out[OP_RATES_KEY]=JSON.stringify(");
edit('dist/domain-schema.js',"'izdelie-operation-rates-v2']","'izdelie-operation-rates-v2','izdelie-offcuts-v1','izdelie-working-drafts-v1','izdelie-price-review-v1']");
// The previously published review method and the earlier local method both
// remain addressable. Never reinterpret an explicitly versioned calculation.
edit('dist/review-core.js',"function(s,q=s.qty){const fixed=", "function(s,q=s.qty){if(s.engineVersion&&s.engineVersion!=='cost-review-v1')return base(s,q);const fixed=");
edit('dist/review-core.js','base({...s,lines:regular},q)','base({...s,engineVersion:\'cost-v1\',lines:regular},q)');
edit('dist/review-core.js',"if(engine.reviewInstalled)return;engine.reviewInstalled=true;", "if(engine.reviewInstalled)return;engine.reviewInstalled=true;engine.VERSION='cost-review-v1';engine.SUPPORTED_VERSIONS=['cost-v1','cost-review-v1'];");
edit('dist/review-core.js',"['updated','approval','libraryId','variantId']","['updated','approval','libraryId','variantId','archive','draftId','schemaVersion','engineVersion']");
edit('dist/calculation-archive.js',"out.engineVersion=out.engineVersion||'cost-v1'", "out.engineVersion=out.engineVersion||root.CostEngine.VERSION");
edit('dist/calculation-archive.js',"out.engineVersion!==root.CostEngine.VERSION", "!(root.CostEngine.SUPPORTED_VERSIONS||[root.CostEngine.VERSION]).includes(out.engineVersion)");
edit('dist/business.js',"c.engineVersion=s.engineVersion||'cost-v1'", "c.engineVersion=s.engineVersion||CostEngine.VERSION");
edit('dist/business.js',"state.engineVersion!==CostEngine.VERSION", "!(CostEngine.SUPPORTED_VERSIONS||[CostEngine.VERSION]).includes(state.engineVersion)");
edit('dist/business.js',"state.engineVersion!==CostEngine.VERSION", "!(CostEngine.SUPPORTED_VERSIONS||[CostEngine.VERSION]).includes(state.engineVersion)");
// Rebind an archived signature only after the review adapter has preserved all
// extra fields; the archived figures themselves remain unchanged.
edit('dist/review-ui.js',"l.normNote=s.lines[i].normNote||'';});return c;", "l.normNote=s.lines[i].normNote||'';});if(s.archive&&s.archive.signature===CalculationArchive.signature(s)){c.archive=structuredClone(s.archive);c.archive.signature=CalculationArchive.signature(c)}return c;");
edit('run-checks.cjs',"'architecture-check.cjs','ui-smoke-check.cjs'", "'architecture-check.cjs','ui-smoke-check.cjs','review-check.cjs','review-ui-smoke-check.cjs'");
console.log('Prepared architecture update on top of published UX changes.');
