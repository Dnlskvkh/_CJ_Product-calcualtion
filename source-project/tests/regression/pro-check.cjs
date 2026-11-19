const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');const {calculate}=require('./dist/engine.js'),P=require('./dist/pro-core.js');
const base={version:1,name:'Тест',code:'Т',client:'',type:'МАФ и мебель',qty:10,scope:'Изготовление',notes:'',clientNotes:'',overhead:7,transport:0,markup:40,vat:22,lines:[]};
const m={id:'a',catalogId:'mat',name:'Материал',unit:'шт.',group:'А',kind:'material',qty:.4,price:10,reserve:0,pack:6,scope:'unit',allocation:'whole',confirmed:true,deliveryIncluded:false,date:'2026',source:'Тест',mass:1};
const s={...base,lines:[m,{...m,id:'b',qty:.6,group:'Б'}]},key=P.materialKey(m),plan=P.plan(s,{[key]:4},calculate);assert.equal(plan.rows.length,1);assert.equal(plan.rows[0].need,10);assert.equal(plan.rows[0].used,4);assert.equal(plan.rows[0].buy,6);assert.equal(plan.cash,60);assert.equal(s.lines[0].qty,.4);assert.equal(P.plan({...s,lines:[m,{...s.lines[1],price:20}]},{},calculate).partial,true);
const target=P.target({...base,qty:1,lines:[{...m,qty:1,price:10000,pack:1}]},1,17080,calculate);assert.equal(target.profit,4000);assert.ok(Math.abs(target.margin-28.5714285714)<1e-6);assert.equal(target.breakEven,12200);assert.equal(P.target({...base,lines:[{...m,price:null}]},10,10000,calculate).valid,false);
assert.equal(P.unitFactor('кг','т').factor,.001);assert.equal(P.unitFactor('л','мл (см3)').factor,1000);assert.equal(P.unitFactor('шт.','пог. м',{sheet:'Пиломатериалы',name:'Доска 28х90х4000 мм'}).factor,4);assert.equal(P.unitFactor('лист','м2',{name:'Фанера 18х1220х2440 мм'}).factor,2.9768);assert.equal(P.unitFactor('шт.','кг').factor,null);
assert.ok(P.issues({...base,qty:1.5,lines:[{...m,price:null}]}).some(x=>x.field==='price'&&x.index===0));
const elements={},storage=new Map();const ctx={console,Intl,Date,Math,Number,Set,Map,JSON,Blob,crypto:require('node:crypto').webcrypto,structuredClone,requestAnimationFrame:f=>f(),setTimeout:()=>{},clearTimeout(){},location:{protocol:'file:'},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{querySelectorAll:()=>[],getElementById:id=>elements[id]??={style:{},value:'',close(){},showModal(){},focus(){}},createElement:()=>({click(){}})},URL:{createObjectURL:()=>'',revokeObjectURL(){}}};ctx.window=ctx;ctx.scrollTo=()=>{};vm.createContext(ctx);for(const f of ['catalog.js','metal-catalog.js','purchases-data.js','purchases-core.js','purchases.js','material-core.js','engine.js','business-core.js','app.js','business.js','pro-core.js','pro.js','projects-data.js','projects.js','material-tools.js','cloud.js'])vm.runInContext(fs.readFileSync(__dirname+'/dist/'+f,'utf8'),ctx,{filename:f});
ctx.testCalc={...base,lines:[{...m,qty:1,pack:1}],qty:1};vm.runInContext('state=cleanCalculation(testCalc);analysisQty=1;renderVariants();renderTarget();renderStockPlan();renderBreakdown();renderPriceSources();renderCloud();renderAnalytics();',ctx);
const v1={id:'r1',date:'2026-10-19T01:00:00Z',calculation:ctx.testCalc},v2={id:'r2',date:'2026-10-19T02:00:00Z',calculation:{...ctx.testCalc,name:'Новая версия'}};
ctx.l={[ 'izdelie-library-v2']:JSON.stringify([{id:'prod',revisions:[v1]}]),'izdelie-stock-v4':JSON.stringify({x:5})};ctx.r={'izdelie-library-v2':JSON.stringify([{id:'prod',revisions:[v1,v2]}]),'izdelie-stock-v4':JSON.stringify({x:7,y:2})};const merged=vm.runInContext('mergedCloudData(l,r)',ctx);assert.equal(JSON.parse(merged['izdelie-library-v2'])[0].revisions.length,2);assert.equal(JSON.parse(merged['izdelie-stock-v4']).x,7);assert.equal(JSON.parse(merged['izdelie-stock-v4']).y,2);
console.log('PASS: pooled inventory, pack rounding, conflicting rates, target profit and VAT, missing data, unit factors, issue targets, all planning screens and cloud merge preservation.');

vm.runInContext(`
state=blank();state.qty=10;addDesign();
if(pendingNewLine.unit!=='чел·ч')throw Error('New design uses ambiguous hour unit');
if(state.lines.length)throw Error('Design saved before apply');
const designId=pendingNewLine.id;for(const [k,v] of Object.entries({name:'Проектирование',unit:'ч/ч',group:'Проектирование',date:'',qty:'8',price:'1000',reserve:'0',pack:'1',mass:'',scope:'batch',category:'design',allocation:'whole'}))$('l-'+k).value=v;
$('l-confirmed').checked=true;commitLine({preventDefault(){}},designId);
if(state.lines.length!==1)throw Error('Design apply failed');
if(CostEngine.calculate(state).D!==8000||CostEngine.calculate(state,100).D!==8000)throw Error('Design setup multiplied');
state.projectName='25 - MSKV - Мордовцева опалубка - ПОСТ 2';
const cleaned=cleanCalculation(state);if(cleaned.projectName!==state.projectName||cleaned.lines[0].costCategory!=='design')throw Error('New fields lost');
if(CostEngine.calculate(cleaned).C!==8560)throw Error('Design overhead');
go(0);projectOptions();renderProjects();
if(projects().length!==new Set(projects().map(n=>n.toLowerCase())).size)throw Error('Duplicate project');
if(!projects().includes('24 - GRSM - Боларды_ул. Шилкинская, д.36 - ПОСТ+ДОСТАВКА'))throw Error('Second column entry missing');
const mergedProjects=mergedCloudData({[PROJECTS_KEY]:JSON.stringify({'А':{createdAt:'1'}})},{[PROJECTS_KEY]:JSON.stringify({'Б':{createdAt:'2'}})});
if(Object.keys(JSON.parse(mergedProjects[PROJECTS_KEY])).length!==2)throw Error('Projects merge');
`,ctx);
console.log('PASS: project registry, project rendering, design hours once per batch, overhead, clean/export preservation and custom registry merge.');

vm.runInContext(`
const l=MaterialCore.estimate({...state.lines[0],kind:'material',unit:'шт.',price:null,mass:50},50,100,'Углеродистая сталь','Тестовая ставка');
const converted=MaterialCore.convertSheet(l,1.25,2.5,'м²',true);state.lines=[converted];
const saved=cleanCalculation(state);if(saved.lines[0].sheetWidth!==1.25||saved.lines[0].sheetLength!==2.5||saved.lines[0].estimate.rate!==100||saved.lines[0].mass!==16)throw Error('Sheet metadata lost');
if(!CostEngine.calculate(saved).warnings.some(s=>s.includes('предварительная цена')))throw Error('Estimate warning lost');
`,ctx);
console.log('PASS: sheet geometry and estimated rate survive saved library revisions.');

vm.runInContext("state.markupBase='work';if(cleanCalculation(state).markupBase!=='work')throw Error('Markup base lost');go(3);if(!document.getElementById('app').innerHTML.includes('Начислять наценку на'))throw Error('Markup selector missing');",ctx);
