// Synthetic arithmetic fixtures. Every price/norm below is invented for testing,
// not a catalogue rate, supplier offer or manufacturing recommendation.
// Run from any directory: node tests/scenarios/product-cost-scenarios.cjs
const assert=require('node:assert/strict');
const schema=require('../../dist/domain-schema.js');
require('../../dist/operations-core.js');
const engine=require('../../dist/engine.js');
require('../../dist/review-core.js').install(engine);
let assertions=0;
function equal(actual,expected,label){assertions++;assert.deepEqual(actual,expected,label);}
function near(actual,expected,label){assertions++;assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-7,`${label}: expected ${expected}, received ${actual}`);}
const material=(id,name,qty,price,extra={})=>({id,name,qty,price,kind:'material',unit:'шт',group:'Тестовые затраты',scope:'unit',reserve:0,pack:1,allocation:'whole',mass:0,date:'2026-11-05',confirmed:true,source:'Условные тестовые данные; не коммерческое предложение',...extra});
const work=(id,name,qty,price,extra={})=>({...material(id,name,qty,price),kind:'work',unit:'ч',costCategory:'production',...extra});
const calculation=(name,qty,lines,extra={})=>({version:1,engineVersion:'cost-review-v1',name,qty,code:'SYNTHETIC',client:'',notes:'Все цены и нормы условные, только для проверки арифметики',type:'Изделие',scope:'Изготовление',requiredServices:{design:false,installation:false,delivery:false},overhead:0,transport:0,markup:0,markupBase:'cost',vat:0,royalty:0,lines,...extra});
const bracketLines=[
 material('steel','Лист для кронштейна',0.4,1000,{unit:'м²',reserve:25,mass:10}),
 work('cut','Лазер кронштейна',1,999999,{unit:'операция',operation:{version:1,type:'laser',mode:'tariff',measure:0.8,rate:100,pierces:2,pierceRate:5,setup:100,minimum:500}}),
 work('bend','Гибка кронштейна',1,999999,{unit:'операция',operation:{version:1,type:'bending',mode:'tariff',measure:3,rate:40,setup:60,minimum:0}})
];
const scenarios=[
 {
  // 0.4*1.25 -> one whole sheet: 1000. Laser max(100+90,500)=500;
  // bending=60+3*40=180. Cost=1000+680+68+50=1798.
  state:calculation('Стальной кронштейн, единичный заказ',1,bracketLines,{overhead:10,transport:5,markup:25,vat:22}),
  expected:{M:1000,W:680,cash:1000,overhead:68,transport:50,productionCost:1798,royalty:0,C:1798,markupBase:1798,P:449.5,net:2247.5,tax:494.45,total:2741.95,unit:2741.95,costUnit:1798,mass:4,fixedGross:0},
  rows:[{need:0.5,purchase:1,amount:1000},{amount:500,operationCost:{unit:90,setup:100,raw:190,total:500,minimumExtra:310}},{amount:180,operationCost:{unit:120,setup:60,raw:180,total:180,minimumExtra:0}}]
 },
 {
  // Ten parts: five sheets=5000; laser=100+90*10=1000;
  // bending=60+120*10=1260. Preparations remain once per batch.
  state:calculation('Стальной кронштейн, партия 10 шт.',10,bracketLines,{overhead:10,transport:5,markup:25,vat:22}),
  expected:{M:5000,W:2260,cash:5000,overhead:226,transport:250,productionCost:7736,royalty:0,C:7736,markupBase:7736,P:1934,net:9670,tax:2127.4,total:11797.4,unit:1179.74,costUnit:773.6,mass:4,fixedGross:0},
  rows:[{need:5,purchase:5,amount:5000},{amount:1000,operationCost:{unit:90,setup:100,raw:1000,total:1000,minimumExtra:0}},{amount:1260,operationCost:{unit:120,setup:60,raw:1260,total:1260,minimumExtra:0}}]
 },
 {
  // Board: .04*3*1.25=.15 m3, buy .2, allocate .15*50000=7500.
  // Lacquer: .4*3=1.2 l, buy 2 l=1000, delivery included.
  // Work=1.5*3*200+2*3*600=4500. Cost=8500+4500+450+450=13900.
  // Royalty=695; direct markup=(8500+4500)*.4=5200.
  state:calculation('Деревянные столешницы с покрытием, 3 шт.',3,[
   material('board','Доска для столешницы',0.04,50000,{unit:'м³',reserve:25,pack:0.1,allocation:'share',mass:650}),
   material('lacquer','Лак',0.4,500,{unit:'л',deliveryIncluded:true,mass:1}),
   work('sand','Шлифовка',1.5,200,{unit:'м²'}),
   work('assembly','Сборка',2,600)
  ],{overhead:10,transport:6,royalty:5,markup:40,markupBase:'direct',vat:22}),
  expected:{M:8500,W:4500,cash:11000,overhead:450,transport:450,productionCost:13900,royalty:695,C:14595,markupBase:13000,P:5200,net:19795,tax:4354.9,total:24149.9,unit:8049.966666666666,costUnit:4865,mass:26.4,fixedGross:0},
  rows:[{need:0.15,purchase:0.2,amount:7500},{need:1.2,purchase:2,amount:1000},{amount:900},{amount:3600}]
 },
 {
  // Tube=6*4*300=7200; concrete=.4*6000=2400 (batch, delivery included).
  // Production=5600, design=2000, installation=6400. Overhead=14000*.07=980.
  // Production royalty base excludes installation and its overhead:
  // 9600+7600+532+432=18164; royalty=908.2. Work markup=4200.
  // Delivery is an agreed gross 3660 for the whole batch, added once after VAT.
  state:calculation('Секции ограждения с монтажом, 4 шт.',4,[
   material('tube','Труба каркаса',6,300,{unit:'м',pack:6,mass:2}),
   material('concrete','Бетон для монтажа',0.4,6000,{unit:'м³',scope:'batch',pack:0.1,deliveryIncluded:true,mass:2400,installation:true}),
   work('welding','Сварка каркаса',2,700),
   work('install','Монтаж секций',8,800,{scope:'batch',costCategory:'installation'}),
   work('design','Проектирование узлов',2,1000,{scope:'batch',costCategory:'design'}),
   work('delivery','Доставка секций',1,3660,{scope:'batch',unit:'рейс',costCategory:'delivery',pricingMode:'client'})
  ],{overhead:7,transport:6,royalty:5,markup:30,markupBase:'work',vat:22,requiredServices:{design:true,installation:true,delivery:true},installationSpec:{reviewed:true,notes:'Тест: четыре секции, условные опоры и бетон'}}),
  expected:{M:9600,W:14000,D:2000,cash:9600,overhead:980,transport:432,productionCost:18164,royalty:908.2,C:25920.2,markupBase:14000,P:4200,net:33120.2,tax:7286.444,total:40406.644,unit:10101.661,costUnit:6480.05,mass:252,fixedGross:3660},
  rows:[{need:24,purchase:24,amount:7200},{need:0.4,purchase:0.4,amount:2400},{amount:5600},{need:8,amount:6400},{need:2,amount:2000},{need:1,amount:3660}]
 },
 {
  // 12 min*(1800/60+5)=420/part; preparation=200 once, total=1040.
  // Material one sheet=1200. Royalty=(1200+1040)*.1=224.
  state:calculation('Фрезерованные таблички из фанеры, 2 шт.',2,[
   material('plywood','Фанера для табличек',0.3,1200,{unit:'м²',mass:6}),
   work('milling','ЧПУ по машинному времени',1,999999,{unit:'операция',operation:{version:1,type:'milling',mode:'machine',minutes:12,hourRate:1800,consumables:5,setup:200,minimum:1000}})
  ],{royalty:10,markup:50,markupBase:'work',vat:22}),
  expected:{M:1200,W:1040,cash:1200,overhead:0,transport:0,productionCost:2240,royalty:224,C:2464,markupBase:1040,P:520,net:2984,tax:656.48,total:3640.48,unit:1820.24,costUnit:1232,mass:1.8,fixedGross:0},
  rows:[{need:0.6,purchase:1,amount:1200},{amount:1040,operationCost:{unit:420,setup:200,raw:1040,total:1040,minimumExtra:0}}]
 },
 {
  // An explicit zero price for customer-owned material is valid but warns.
  // Work 2*1500=3000; overhead=210; markup=3210*.4=1284; no VAT.
  state:calculation('Ремонт скамьи заказчика, 1 шт.',1,[
   material('supplied','Скамья заказчика',1,0,{mass:20}),
   work('repair','Ремонт скамьи',2,1500)
  ],{type:'Сервисные работы',scope:'Сервис',overhead:7,markup:40}),
  expected:{M:0,W:3000,cash:0,overhead:210,transport:0,productionCost:3210,royalty:0,C:3210,markupBase:3210,P:1284,net:4494,tax:0,total:4494,unit:4494,costUnit:3210,mass:20,fixedGross:0},
  warning:'нулевую цену',
  rows:[{need:1,purchase:1,amount:0},{need:2,amount:3000}]
 }
];

function checkFields(actual,expected,prefix){for(const [key,value] of Object.entries(expected)){if(value&&typeof value==='object')checkFields(actual[key],value,`${prefix}.${key}`);else near(actual[key],value,`${prefix}.${key}`);}}
for(const scenario of scenarios){
 const original=structuredClone(scenario.state);
 schema.calculation(scenario.state);
 const result=engine.calculate(scenario.state);
 equal(result.errors,[],`${scenario.state.name}: arithmetic errors`);
 equal(result.scopeIssues,[],`${scenario.state.name}: service composition`);
 equal(result.partial,false,`${scenario.state.name}: complete calculation`);
 equal(result.massMissing,false,`${scenario.state.name}: known material mass`);
 equal(result.profitIncomplete,scenario.expected.fixedGross>0,`${scenario.state.name}: agreed gross service profitability`);
 if(scenario.warning)equal(result.warnings.some(message=>message.includes(scenario.warning)),true,`${scenario.state.name}: expected zero-price warning`);
 else equal(result.warnings,[],`${scenario.state.name}: warnings`);
 checkFields(result,scenario.expected,scenario.state.name);
 scenario.rows.forEach((row,index)=>checkFields(result.rows[index],row,`${scenario.state.name}.rows[${index}]`));
 equal(scenario.state,original,`${scenario.state.name}: input remains unchanged`);
 const restored=engine.calculate(JSON.parse(JSON.stringify(scenario.state)));
 near(restored.total,scenario.expected.total,`${scenario.state.name}: JSON round trip`);
 const repeated=engine.calculate(scenario.state);
 near(repeated.total,scenario.expected.total,`${scenario.state.name}: repeated calculation`);
 console.log(`${scenario.state.name}: cost=${result.C.toFixed(2)}, gross batch=${result.total.toFixed(2)}, gross unit=${result.unit.toFixed(2)}`);
}

// Explicit historical method must retain its own royalty-free arithmetic.
const historical=[
 [0,{C:1798,royalty:0,P:449.5,total:2741.95}],
 [1,{C:7736,royalty:0,P:1934,total:11797.4}],
 [2,{C:13900,royalty:0,P:5200,total:23302}],
 [4,{C:2240,royalty:0,P:520,total:3367.2}]
];
for(const [index,expected] of historical){
 const state={...scenarios[index].state,engineVersion:'cost-v1'};
 const result=engine.calculate(state);
 checkFields(result,expected,`${state.name}.cost-v1`);
 equal(result.partial,false,`${state.name}.cost-v1: complete`);
}
// Cross-quantity reuse must recalculate the batch minimum without changing state.
const tenFromOne=engine.calculate(scenarios[0].state,10);
near(tenFromOne.total,11797.4,'Quantity override: one-off bracket recalculated as ten');
equal(scenarios[0].state.qty,1,'Quantity override leaves original batch untouched');
console.log(`PASS: ${scenarios.length} synthetic products/batches, ${historical.length} historical calculations, ${assertions} assertions. All rates/norms are test fixtures.`);
