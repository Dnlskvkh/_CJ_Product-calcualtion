const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const material=require('./dist/material-core.js'),pro=require('./dist/pro-core.js'),purchase=require('./dist/purchases-core.js'),work=require('./dist/production-work-core.js'),spec=require('./dist/model-spec-core.js'),production=require('./dist/production-model-core.js');
assert.equal(typeof material.sameUnit,'function','Missing shared unit identity');
for(const text of ['constructor','__proto__','toString']){assert.equal(material.unitLabel(text),text);assert.equal(typeof material.unitKey(text),'string');}
for(const [a,b]of [['мп.','м.п.'],['м.п.','пог. м'],['м²','м2'],['м³','м3'],['л','л (дм3)'],['шт','шт.'],['н/ч','н·ч']]){
 assert.ok(material.sameUnit(a,b),`${a}/${b}`);assert.equal(pro.unitFactor(a,b).factor,1,`Price unit ${a}/${b}`);
}
for(const [a,b]of [['м','м²'],['м²','м³'],['шт','упак'],['рез','проход'],['ч','чел·ч'],['ч','н/ч'],['ч','ч/ч'],['???','???'],['','']]){
 assert.equal(material.sameUnit(a,b),false,`${a} must not equal ${b}`);assert.equal(pro.unitFactor(a,b).factor,null);
}
const input={lines:[{id:'m',catalogId:'c',name:'Материал',unit:'мп.',price:10}]},catalog=[{id:'c',unit:'м.п.',purchaseId:'p',price:20,date:'2026-10-01',purchaseSource:'Источник'}],data={records:[],meta:{reportDate:'2026-11-19'}};
const before=JSON.stringify(input);assert.equal(purchase.candidates(input,catalog,data).length,1);assert.equal(JSON.stringify(input),before);
assert.equal(purchase.candidates({...input,lines:[{...input.lines[0],unit:'м²'}]},catalog,data).length,0);
assert.equal(work.normHours({physicalQuantity:10,productivity:2,physicalUnit:'м2',productivityUnit:'м²',productivityStatus:'approved'}).value,5);
assert.equal(work.normHours({physicalQuantity:10,productivity:2,physicalUnit:'м',productivityUnit:'м²',productivityStatus:'approved'}).enabled,false);
const row={type:'work',entity:{measure:{value:2,unit:'ч',basis:'per_product',status:'observed'}}},config={driver:'measure',manual:null,unit:'н/ч',factor:null,note:''};
assert.equal(spec.amount({},row,config).value,null,'Clock hours cannot become norm-hours without a norm');
assert.equal(spec.amount({},row,{...config,unit:'чел·ч'}).value,null,'Clock hours cannot become person-hours');
assert.equal(spec.amount({},row,{...config,unit:'ч/ч'}).value,null,'Ambiguous source hours cannot become clock hours');
assert.equal(spec.amount({},row,{...config,unit:'час'}).value,2);
assert.equal(spec.amount({}, {...row,entity:{measure:{...row.entity.measure,unit:'???'}}},{...config,unit:'Не указана'}).value,null,'Unknown units cannot justify a direct transfer');
const c={};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync('dist/production-catalog.js','utf8'),c);
const d=structuredClone(c.PRODUCTION_CATALOG.operations.find(x=>x.unit==='м²'));d.calculation_method='output_per_hour';d.productivity={value:2,unit:'м²',basis:'person'};
const original=production.calculateLine(d,{quantity:2});d.productivity.unit='м2';assert.deepEqual(production.calculateLine(d,{quantity:2}),original);
console.log('Units: shared identity, aliases in price matching/conversions/productivity, dimensional separation and safe spec hours passed.');
