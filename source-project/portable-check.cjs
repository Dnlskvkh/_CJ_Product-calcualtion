const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),crypto=require('node:crypto');
const root=path.resolve(process.argv[2]);
const {startServer}=require(path.join(root,'server.cjs'));
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'calculator-portable-test-'));
let running;
const stop=async()=>{if(running){await new Promise(resolve=>{running.server.close(resolve);running.server.closeAllConnections()});running=null}};
(async()=>{
 for(const line of fs.readFileSync(path.join(root,'SHA256SUMS.txt'),'utf8').trim().split('\n')){
  const [hash,file]=line.split('  ');assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),hash,file);
 }
 running=await startServer({root,port:0,dataDir});
 let origin=running.origin;
 const html=await (await fetch(origin)).text();assert.match(html,/<title>Изделие/);
 const paths=new Set([...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m=>m[1]).filter(p=>/\.(js|css|png|svg|woff2|webmanifest)$/.test(p)));
 for(const file of paths){const response=await fetch(new URL(file,origin));assert.equal(response.status,200,file);assert.ok((await response.arrayBuffer()).byteLength>0,file)}
 assert.equal((await fetch(origin+'/api/records')).status,200);
 const collection='izdelie-company-v2';
 const changes=[{collection,id:'$collection',value:'object',expectedRevision:0},{collection,id:'name',value:'Portable restart test',expectedRevision:0}];
 const put=body=>fetch(origin+'/api/records',{method:'PUT',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await put({changes})).status,200);
 assert.equal((await put({changes})).status,409);
 assert.equal((await put({changes:[{collection,id:'$collection',value:'array',expectedRevision:1}]})).status,400);
 assert.equal((await fetch(origin+'/api/records',{headers:{origin:'https://example.org'}})).status,403);
 const badHost=await new Promise((resolve,reject)=>{http.get(origin,{headers:{host:'example.org'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))}).on('error',reject)});assert.equal(badHost,403);
 const before=await (await fetch(origin+'/api/records')).json();assert.equal(before.revision,1);
 await stop();assert.ok(fs.statSync(path.join(dataDir,'calculator.sqlite')).size>0);
 running=await startServer({root,port:0,dataDir});origin=running.origin;
 assert.deepEqual(await (await fetch(origin+'/api/records')).json(),before);
 assert.equal((await put({changes:[{collection,id:'name',value:'After restart',expectedRevision:1}]})).status,200);
 assert.equal((await (await fetch(origin+'/api/backups')).json()).backups.length,1);
 const productionCore=require('./dist/production-model-core.js'),productionCatalog=require('./dist/production-catalog.js'),definition=structuredClone(productionCatalog.operations.find(d=>d.source_work_id===112));
 definition.cost_model={unit_cost:null};
 const calculation={version:1,engineVersion:'production-v1',name:'API production test',code:'',client:'',notes:'',type:'МАФ и мебель',scope:'Изготовление',qty:1,overhead:0,transport:0,markup:40,markupBase:'cost',vat:0,lines:[productionCore.makeLine(definition,'program-api',{quantity:240})]};
 const libraryCollection='izdelie-library-v2',productionCollection='izdelie-production-catalog-v1',entry={id:'production-api',revisions:[{id:'revision-1',calculation}]};
 assert.equal((await put({changes:[{collection:libraryCollection,id:'$collection',value:'array',expectedRevision:0},{collection:libraryCollection,id:entry.id,value:entry,expectedRevision:0},{collection:productionCollection,id:'$collection',value:'object',expectedRevision:0},{collection:productionCollection,id:definition.id,value:definition,expectedRevision:0}]})).status,200);
 const productionSnapshot=await (await fetch(origin+'/api/records')).json(),saved=JSON.parse(productionSnapshot.data[libraryCollection])[0].revisions[0].calculation;
 assert.equal(saved.engineVersion,'production-v1');assert.equal(saved.lines[0].production.inputs.quantity,240);assert.equal(saved.lines[0].production.definition.cost_model.unit_cost,null);assert.ok(JSON.parse(productionSnapshot.data[productionCollection])[definition.id]);
 const invalid=structuredClone(entry);invalid.revisions[0].calculation.lines[0].production.inputs.quantity=-1;
 assert.equal((await put({changes:[{collection:libraryCollection,id:entry.id,value:invalid,expectedRevision:1}]})).status,400);assert.deepEqual(await (await fetch(origin+'/api/records')).json(),productionSnapshot);
 const typed={id:'material-api',revisions:[{id:'material-version',calculation:{...calculation,name:'Material type API test',lines:[{id:'typed-material',kind:'material',name:'Материал',group:'Узел',unit:'шт.',scope:'unit',allocation:'whole',qty:1,price:0,reserve:0,pack:1,materialType:'wood.plywood'}]}}]};
 assert.equal((await put({changes:[{collection:libraryCollection,id:typed.id,value:typed,expectedRevision:0}]})).status,200);
 const typedSnapshot=await (await fetch(origin+'/api/records')).json(),badType=structuredClone(typed);badType.revisions[0].calculation.lines[0].materialType='invented';
 assert.equal((await put({changes:[{collection:libraryCollection,id:typed.id,value:badType,expectedRevision:1}]})).status,400);assert.deepEqual(await (await fetch(origin+'/api/records')).json(),typedSnapshot);
 await stop();
 running=await startServer({root,port:0,dataDir});origin=running.origin;assert.deepEqual(await (await fetch(origin+'/api/records')).json(),typedSnapshot);await stop();
 console.log('Material grouping API: valid classification persisted across restart; invalid type rejected without mutation.');
 console.log('Production API: calculation/catalog snapshots, unknown planned cost and rejected-import rollback passed.');
 console.log('Portable: file hashes, all linked assets, persistent SQLite restart, repeat migrations, revision conflict, validation rollback, backups and local access checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await stop();fs.rmSync(dataDir,{recursive:true,force:true})});
