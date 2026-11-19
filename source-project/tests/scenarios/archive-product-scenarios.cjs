// Synthetic prices and quantities are test fixtures, not supplier offers.
const strict=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
let assertions=0;
const assert=new Proxy(strict,{get:(target,key)=>typeof target[key]==='function'?(...args)=>{assertions++;return target[key](...args)}:target[key]});
const Schema=require(path.join(root,'dist/domain-schema.js'));
require(path.join(root,'dist/operations-core.js'));
const Engine=require(path.join(root,'dist/engine.js'));
require(path.join(root,'dist/review-core.js')).install(Engine);
const Archive=require(path.join(root,'dist/calculation-archive.js'));
const Business=require(path.join(root,'dist/business-core.js'));
const line=(id,name,kind,qty,price,extra={})=>({id,catalogId:id,name,kind,qty,price,unit:kind==='work'?'ч':'шт.',group:'Тестовое изделие',reserve:0,pack:1,scope:'unit',allocation:'whole',confirmed:true,date:'2026-11-05',source:'Синтетическая тестовая ставка',mass:1,...extra});
const product=(name,lines,extra={})=>({version:1,engineVersion:'cost-review-v1',name,code:'TEST',client:'Тестовый заказчик',type:'МАФ и мебель',scope:'Изготовление',notes:'INTERNAL_SECRET margin',clientNotes:'Тестовый состав, самовывоз',qty:5,overhead:0,transport:0,markup:0,markupBase:'cost',vat:20,lines,...extra});
const bench=()=>product('Скамья',[
 line('wood','Дерево INTERNAL_SECRET','material',2,100),
 line('assembly','Сборка INTERNAL_SECRET','work',1,50),
 line('setup','Подготовка INTERNAL_SECRET','work',2,100,{scope:'batch'})
]); // 5 * (200 + 50) + 200 = 1450 cost; gross = 1740.
const planter=()=>product('Кашпо',[
 line('steel','Лист INTERNAL_SECRET','material',0.25,800,{pack:1,allocation:'share'}),
 line('weld','Сварка INTERNAL_SECRET','work',0.5,400)
],{qty:3}); // 600 steel + 600 labor = 1200 cost; gross = 1440.
const draft=(calculations)=>({number:'TEST-KP',date:'2026-11-05',validUntil:'',subject:'Тестовое предложение',client:'Тестовый заказчик',contact:'',payment:'По договору',delivery:'Самовывоз',leadtime:'Тестовый срок',warranty:'',comment:'Публичные условия',discount:0,items:calculations.map((calculation,i)=>({id:'item-'+i,key:'key-'+i,name:calculation.name,description:'Комплект '+calculation.name,qty:calculation.qty,override:null,calculation}))});
const company={name:'Тестовая компания',details:'Публичные реквизиты',contacts:'Контакт',signer:'Подписант',internal:'INTERNAL_SECRET company'};
function app(){
 const storage=new Map(),elements=new Map(),element=()=>({innerHTML:'',textContent:'',style:{},value:'',open:false,append(){},prepend(){},insertAdjacentHTML(){},querySelectorAll(){return []},focus(){},setAttribute(){},showModal(){this.open=true},close(){this.open=false},click(){}});
 const context={console,crypto:require('node:crypto').webcrypto,structuredClone,TextEncoder,Intl,Date,Math,JSON,Map,Set,WeakMap,Number,String,Object,Array,Blob,URL,setTimeout(){},clearTimeout(){},location:{protocol:'file:',hash:''},navigator:{onLine:true},addEventListener(){},matchMedia:()=>({matches:false}),scrollTo(){},document:{getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id)},createElement:element,querySelectorAll:()=>[],body:{append(){}}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},fetch:async()=>{throw Error('Test has no network')}};
 context.window=context;vm.createContext(context);
 const scripts=[...fs.readFileSync(path.join(root,'dist/index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)].map(m=>m[1]);
 for(const script of scripts)vm.runInContext(fs.readFileSync(path.join(root,'dist',script),'utf8'),context,{filename:script});
 return {context,storage,elements,run:source=>vm.runInContext(source,context)};
}
const cases=[];const scenario=(name,run)=>cases.push({name,run});
scenario('Скамья и кашпо: независимые цены, партия и публичный документ',()=>{
 const b=bench(),p=planter();Schema.calculation(b);Schema.calculation(p);
 const rb=Engine.calculate(b),rp=Engine.calculate(p);
 assert.equal(rb.C,1450);assert.equal(rb.total,1740);assert.equal(rb.unit,348);
 assert.equal(rp.M,600);assert.equal(rp.cash,800);assert.equal(rp.W,600);assert.equal(rp.total,1440);
 const quote=draft([b,p]),doc=Business.publicDocument(quote,company,Engine.calculate);
 assert.equal(doc.total,3180);assert.equal(doc.tax,530);assert.equal(doc.items.length,2);
 assert.equal(doc.items[0].unit,348);assert.equal(doc.items[1].unit,480);
 assert.equal(doc.items[0].limitations,'Тестовый состав, самовывоз');
 assert.equal(JSON.stringify(doc).includes('INTERNAL_SECRET'),false);
 assert.deepEqual(Object.keys(doc.items[0]).sort(),['position','name','code','description','qty','unit','total','vat','tax','limitations'].sort());
 const frozen=JSON.stringify(doc);quote.items[0].calculation.lines[0].price=999999;quote.items[0].name='Изменённое';assert.equal(JSON.stringify(doc),frozen);
});
scenario('Неизвестная цена, явный ноль и блокировка выдачи неполного КП',()=>{
 const unknown=bench();unknown.lines[0].price=null;
 const r=Engine.calculate(unknown);assert.equal(r.partial,true);assert.equal(r.rows[0].amount,null);assert.equal(r.M,0);assert.equal(r.C,450);
 assert.equal(r.errors.some(e=>e.includes('цена')),true);assert.throws(()=>Business.publicDocument(draft([unknown]),company,Engine.calculate),/цена/);
 const archived=Archive.capture(unknown);assert.equal(archived.lines[0].price,null);assert.equal(Archive.result(archived).partial,true);
 const free=bench();free.lines[0].price=0;const z=Engine.calculate(free);
 assert.equal(z.partial,false);assert.equal(z.rows[0].amount,0);assert.equal(z.warnings.some(e=>e.includes('нулевую цену')),true);
 const doc=Business.publicDocument(draft([free]),company,Engine.calculate);assert.equal(doc.total,540);assert.equal(doc.preliminary,true);
});
scenario('Архив: снимок не пересчитывается, изменение входа снимает снимок',()=>{
 const source=bench(),saved=Archive.capture(source),before=JSON.stringify(saved.archive.result);
 assert.equal(source.archive,undefined);assert.equal(saved.archive.engineVersion,'cost-review-v1');assert.equal(saved.archive.result.total,1740);
 const calculate=Engine.calculate;try{Engine.calculate=()=>{throw Error('Unexpected archived recalculation')};assert.equal(Archive.result(saved).total,1740);}finally{Engine.calculate=calculate;}
 const returned=Archive.result(saved);returned.rows[0].price=999;returned.total=1;assert.equal(JSON.stringify(saved.archive.result),before);
 const updated=structuredClone(saved);updated.lines[0].price=120;assert.equal(Archive.result(updated).total,1980);assert.equal(saved.archive.result.total,1740);
 const metadata=structuredClone(saved);metadata.updated='2099-01-01';metadata.libraryId='another';assert.equal(Archive.signature(metadata),saved.archive.signature);
});
scenario('Старые и неизвестные методики: исторические суммы и запрет пересчёта',()=>{
 const legacy=bench();legacy.engineVersion='cost-v1';legacy.royalty=10;
 const current={...legacy,engineVersion:'cost-review-v1'};
 assert.equal(Engine.calculate(legacy).total,1740);assert.equal(Engine.calculate(current).total,1914);
 const old=Archive.capture(legacy);assert.equal(old.engineVersion,'cost-v1');assert.equal(old.archive.result.total,1740);
 const future=structuredClone(old);future.engineVersion='future-v99';future.archive.engineVersion='future-v99';future.archive.signature=Archive.signature(future);
 assert.equal(Archive.result(future).total,1740);assert.throws(()=>Archive.capture(future),/неизвестную версию/);
 const changed=structuredClone(future);changed.qty=10;const blocked=Archive.result(changed);assert.equal(blocked.partial,true);assert.equal(blocked.total,0);assert.equal(blocked.errors.some(e=>e.includes('не поддерживается')),true);
});
scenario('Библиотека: две версии, изменение ставок и повторное открытие',()=>{
 const a=app();a.context.fixture=bench();a.run('state=cleanCalculation(fixture);commitCalculation(true);state.lines[0].price=120;commitCalculation(false);');
 const library=JSON.parse(a.storage.get('izdelie-library-v2'));assert.equal(library.length,1);assert.equal(library[0].revisions.length,2);
 const [v1,v2]=library[0].revisions.map(x=>x.calculation);assert.equal(v1.lines[0].price,100);assert.equal(v2.lines[0].price,120);
 assert.equal(v1.archive.result.total,1740);assert.equal(v2.archive.result.total,1980);
 a.context.productId=library[0].id;a.run('openLibrary(productId,0,false)');assert.equal(a.run('state.lines[0].price'),100);assert.equal(a.run('CalculationArchive.result(state).total'),1740);
 assert.equal(JSON.parse(a.storage.get('izdelie-recovery')).lines[0].price,120);
});
scenario('КП: выданная версия и клиентский HTML не раскрывают калькуляцию',async()=>{
 const a=app();a.context.fixture=bench();a.storage.set('izdelie-company-v2',JSON.stringify(company));
 a.run("state=cleanCalculation(fixture);quoteDraft=newQuoteDraft();quoteDraft.client='Клиент';quoteDraft.payment='Оплата';quoteDraft.leadtime='Срок';quoteDraft.delivery='Самовывоз';addQuoteCalculation(state,'bench');issueQuote();");
 const first=JSON.parse(a.storage.get('izdelie-quotes-v2'));assert.equal(first.length,1);assert.equal(first[0].document.total,1740);
 const snapshot=JSON.stringify(first[0].document);a.run('quoteDraft.items[0].override=999;issueQuote()');
 const records=JSON.parse(a.storage.get('izdelie-quotes-v2'));assert.equal(records.length,2);assert.equal(records[0].version,2);assert.equal(records[0].document.total,4995);assert.equal(JSON.stringify(records[1].document),snapshot);
 let blob;a.context.URL={createObjectURL:b=>(blob=b,'blob:synthetic-test'),revokeObjectURL(){}};a.context.quoteId=records[1].id;a.run('downloadQuote(quoteId)');
 const html=await blob.text();assert.equal(html.includes('INTERNAL_SECRET'),false);assert.equal(html.includes('rateProfile'),false);assert.equal(html.includes('calculation'),false);assert.equal(html.includes('Скамья'),true);
});
scenario('Импорт библиотеки: ошибка второго изделия не записывает первое',async()=>{
 const a=app();a.context.fixture=bench();a.run('state=cleanCalculation(fixture);commitCalculation(true)');
 const before=new Map(a.storage),bad=planter();bad.lines[0].qty=-1;
 const text=JSON.stringify([bench(),bad]);a.context.testEvent={target:{files:[{name:'synthetic.json',size:text.length,text:async()=>text}]}};
 await a.run('prepareLibraryImport(testEvent)');assert.equal(a.run('pendingLibraryImport.length'),0);assert.equal(a.elements.get('libImportPreview').innerHTML.includes('Импорт не выполнен'),true);
 a.run('commitLibraryImport()');assert.deepEqual([...a.storage],[...before]);
 const broken=JSON.stringify({format:'izdelie-library',version:2,entries:[{revisions:[{calculation:{...bench(),archive:{version:1,result:{}}}}]}]});a.context.testEvent.target.files[0]={name:'broken-archive.json',size:broken.length,text:async()=>broken};
 await a.run('prepareLibraryImport(testEvent)');assert.equal(a.run('pendingLibraryImport.length'),0);assert.deepEqual([...a.storage],[...before]);
});
scenario('Импорт базы: валидация до записи и откат после отказа хранилища',()=>{
 const key='izdelie-library-v2',companyKey='izdelie-company-v2',oldCompany=JSON.stringify({name:'До импорта'}),memory=new Map([[companyKey,oldCompany]]),messages=[];
 let writes=0,failOnce=false;
 const c={DomainSchema:Schema,CLOUD_KEYS:[key,companyKey],stamp:()=> '2026-11-05',cloudMessage:x=>messages.push(x),applyPreferredSources(){},localWriteJSON:(k,v)=>(memory.set(k,JSON.stringify(v)),true),localStorage:{getItem:k=>memory.get(k)??null,setItem(k,v){writes++;if(failOnce&&k===companyKey){failOnce=false;throw Error('Synthetic quota failure');}memory.set(k,v)},removeItem:k=>memory.delete(k)}};
 vm.createContext(c);const source=fs.readFileSync(path.join(root,'dist/cloud.js'),'utf8'),start=source.indexOf('function installCloudData('),end=source.indexOf('\nfunction mergedCloudData(',start);vm.runInContext(source.slice(start,end),c);
 const invalid={[key]:JSON.stringify([{id:'bad',revisions:[{calculation:{...bench(),qty:0}}]}])};assert.equal(c.installCloudData(invalid),false);assert.equal(writes,0);assert.equal(memory.has('izdelie-cloud-recovery-v4'),false);assert.equal(memory.get(companyKey),oldCompany);
 const data={[key]:JSON.stringify([{id:'bench',revisions:[{id:'v1',calculation:Archive.capture(bench())}]}]),[companyKey]:JSON.stringify({name:'После импорта'})};
 failOnce=true;assert.equal(c.installCloudData(data),false);assert.equal(memory.has(key),false);assert.equal(memory.get(companyKey),oldCompany);
 assert.deepEqual(JSON.parse(memory.get('izdelie-cloud-recovery-v4')).data,{[companyKey]:oldCompany});
 assert.equal(c.installCloudData(data),true);assert.equal(JSON.parse(memory.get(key))[0].revisions[0].calculation.archive.result.total,1740);assert.equal(JSON.parse(memory.get(companyKey)).name,'После импорта');
});
(async()=>{let failed=0;for(const {name,run} of cases){const before=assertions;try{await run();console.log('PASS '+name+' ('+(assertions-before)+' assertions)');}catch(error){failed++;console.error('FAIL '+name+'\n'+error.stack);}}console.log(JSON.stringify({scenarios:cases.length,assertions,passed:cases.length-failed,failed}));if(failed)process.exitCode=1;})().catch(error=>{console.error(error);process.exitCode=1;});
