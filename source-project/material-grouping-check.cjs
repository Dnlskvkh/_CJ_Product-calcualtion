const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('./dist/material-grouping-core.js');
const context={};context.window=context;vm.createContext(context);for(const file of ['catalog.js','metal-catalog.js'])vm.runInContext(fs.readFileSync('dist/'+file,'utf8'),context,{filename:file});
const catalog=context.CATALOG,material=(name,extra={})=>({id:name,kind:'material',name,amount:10,...extra}),type=(name,extra={})=>G.resolve(material(name,extra),catalog).id;
assert.equal(type('Труба профильная 80х60х3,0 12,05 м'),'metal.profile_pipe');
assert.equal(type('Лист г/к по ГОСТ 19903-2015 4х1500х6000 мм'),'metal.sheet');
assert.equal(type('Профнастил / профлист С-44 0,65мм*1000мм'),'metal.profile_sheet');
assert.equal(type('Палубная доска, лиственница, сорт Экстра'),'wood.board');
assert.equal(type('Краска для дерева Sikkens RUBBOL WF340'),'coatings.wood');
assert.equal(type('Цепь нержавеющая короткозвенная DIN 766'),'hardware.rigging');assert.equal(type('Шнур яхтенный 10мм из Полиэфира'),'hardware.rigging');
assert.equal(type('ДПК террасный'),'plastics.composite');assert.equal(type('Клей полиуретановый'),'coatings.sealant');
for(const [id,expected]of [['Сопутствующие_материалы:4','supplies.abrasive'],['Сопутствующие_материалы:8','building.brick'],['Сопутствующие_материалы:24','other.unassigned'],['Сопутствующие_материалы:34','plastics.composite'],['Сопутствующие_материалы:38','supplies.welding'],['Сопутствующие_материалы:23','metal.wire'],['Сопутствующие_материалы:45','supplies.packaging'],['Сопутствующие_материалы:68','components.system']]){
 const c=catalog.find(c=>c.id===id);assert.equal(type(c.name,{catalogId:id}),expected,id);
}
const hdpe=catalog.filter(c=>c.category==='HDPE и соединители');assert.equal(hdpe.filter(c=>G.resolve(c,catalog).id==='plastics.hdpe').length,53);assert.equal(hdpe.filter(c=>G.resolve(c,catalog).id==='hardware.connector').length,115);
assert.equal(type('Непонятный комплект'),'other.unassigned');assert.equal(type('Труба профильная',{materialType:'wood.plywood'}),'wood.plywood');assert.equal(type('Труба профильная',{materialType:''}),'metal.profile_pipe');
assert.ok(G.validType(undefined));assert.ok(G.validType(''));assert.ok(G.validType('other.unassigned'));for(const bad of [null,{},'metal.invented','<script>'])assert.equal(G.validType(bad),false);
assert.equal(G.resolve({kind:'work',name:'Работа'},catalog),null);
const names=['Труба профильная 120х80х4','Труба профильная 80х60х3','Труба профильная 80х80х3','Лист г/к 4мм','Лист г/к 5мм','Лист г/к 6мм','Лист г/к 12мм','Палубная доска Экстра','Краска для дерева Sikkens','Труба профильная 150х100х5','Палубная доска сорт В','Профнастил С-44','Лист г/к 10мм'];
const lines=names.map((n,i)=>material(n,{id:'m'+i,amount:i===0?null:i===1?0:10,group:'Общее изделие'}));lines.push({kind:'work',name:'Сварка',amount:100});
const before=JSON.stringify(lines),groups=G.group(lines,catalog);assert.deepEqual(groups.map(g=>[g.id,g.count]),[['metal',10],['wood',2],['coatings',1]]);assert.equal(groups[0].knownCost,80);assert.equal(groups[0].unknownCount,1);
assert.deepEqual(groups[0].types.map(t=>[t.id,t.count]),[['metal.profile_pipe',4],['metal.sheet',5],['metal.profile_sheet',1]]);
const ids=groups.flatMap(g=>g.types.flatMap(t=>t.rows.map(l=>l.id)));assert.equal(ids.length,13);assert.equal(new Set(ids).size,13);assert.equal(JSON.stringify(lines),before);assert.deepEqual(groups[0].types[0].rows.map(l=>l.id),['m0','m1','m2','m9']);
const unknown=G.group([material('Одна',{amount:undefined}),material('Другая',{amount:NaN})],[])[0];assert.equal(unknown.knownCost,0);assert.equal(unknown.unknownCount,2);
console.log('Material grouping: manual/catalog classification, mixed categories, 13-row composition, unknown/zero costs, stable order and read-only rendering passed.');
const schema=require('./dist/domain-schema.js');
const calculation={version:1,name:'Тип материала',code:'',client:'',type:'Тест',qty:1,scope:'Изготовление',notes:'',overhead:0,transport:0,markup:0,vat:0,lines:[{id:'typed',kind:'material',name:'Материал',group:'Узел',unit:'шт.',scope:'unit',allocation:'whole',qty:1,price:0,reserve:0,pack:1,materialType:'wood.plywood'}]};
assert.doesNotThrow(()=>schema.calculation(calculation));
for(const bad of [null,'bad-type',{},'__proto__'])assert.throws(()=>schema.calculation({...calculation,lines:[{...calculation.lines[0],materialType:bad}]}),/тип материала/i);
