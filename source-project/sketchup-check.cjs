const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('./sketchup/cj_calculator/selection-core.js'),specCore=require('./dist/model-spec-core.js');
const p={id:'p-1',occurrence:'1',name:'Деталь </script> "тест"',kind:'Group',material:null,dimensions_m:[1,.2,.03],surface_area_m2:.472,face_area_m2:null,edge_length_m:4.92,volume_m3:.006,notes:[]};
const packet={format:'cj-sketchup-selection',version:1,model_id:'test-model',model_name:'Тестовое изделие',revision:'geometry-v1',parts:[p,{...structuredClone(p),id:'p-2',occurrence:'2',volume_m3:null}],skipped:0,split:true,include_hidden:false};
for(const choice of Object.keys(core.CHOICES)){const result=core.specification(packet,['p-1','p-2'],choice);specCore.validate(result.spec);assert.equal(result.spec.parts.length,2);assert.equal(result.spec.products[0].batch_qty,null);assert.equal(result.spec.parts[0].quantity.value,1);assert.equal(result.spec.parts[1].metrics.find(m=>m.key==='volume').value,null);assert.equal(result.spec.parts[1].metrics.find(m=>m.key==='volume').status,'unknown');}
let result=core.specification(packet,['p-1'],'volume');let row=specCore.rows(result.spec,'P1')[0],config=specCore.config(row,[],null);Object.assign(config,{unit:result.unit,driver:result.driver});assert.equal(specCore.amount(result.spec,row,config).value,.006);
result=core.specification(packet,['p-2'],'volume');row=specCore.rows(result.spec,'P1')[0];assert.equal(specCore.drive(result.spec,row,'volume').value,null);
assert.equal(core.value(p,'x'),1);assert.equal(core.value(p,'longest'),1);assert.equal(core.value(p,'edges'),4.92);assert.equal(core.value({...p,volume_m3:0},'volume'),0);
assert.equal(core.specification(packet,['p-1'],'review').spec.parts[0].metrics.some(m=>m.key==='part_length'),false);
assert.equal(core.specification(packet,['p-1'],'edges').spec.parts[0].metrics.find(m=>m.key==='part_length').value,4.92);
assert.throws(()=>core.specification(packet,[]));assert.throws(()=>core.specification(packet,['absent']));assert.throws(()=>core.specification(packet,['p-1','p-1']));assert.throws(()=>core.specification(packet,['p-1'],'invented'));
for(const mutate of [x=>x.parts.push(x.parts[0]),x=>x.parts[0].volume_m3=-1,x=>x.parts[0].surface_area_m2=Infinity,x=>x.parts[0].dimensions_m=[1,2],x=>x.parts[0].edge_length_m='1']){const bad=structuredClone(packet);mutate(bad);assert.throws(()=>core.validate(bad));}
// Identical repeated captures have identical document identity, and existing intake
// protection still recognizes them; a changed measured value changes the identity.
const first=core.specification(packet,['p-1'],'volume').spec,again=core.specification(structuredClone(packet),['p-1'],'volume').spec;
assert.deepEqual(specCore.identity(first,'P1'),specCore.identity(again,'P1'));
again.parts[0].metrics[0].value=.007;assert.notEqual(specCore.identity(first,'P1').documentKey,specCore.identity(again,'P1').documentKey);
for(const name of ['bridge.js','selection-core.js','material-match-core.js'])new vm.Script(fs.readFileSync('sketchup/cj_calculator/'+name,'utf8'),{filename:name});
assert.ok(!fs.readFileSync('dist/index.html','utf8').includes('cj-model-bar'),'Host integration must stay isolated from the web version');
console.log('SketchUp: metric mapping, units, unknown/zero, duplicate occurrences, document identity and host script syntax passed.');
const matching=require('./sketchup/cj_calculator/material-match-core.js');
const material=(id,name,unit='м³',extra={})=>({id,name,kind:'material',unit,price:null,...extra});
const fixtures=[material('larch','Доска лиственница 40х100х3000'),material('pine','Доска сосна 40х100х3000'),material('plywood','Фанера берёзовая 18 мм','лист'),material('steel','Труба 09Г2С 40х40х2','м'),material('304','Труба нержавеющая AISI 304 40х40х2','м'),material('316','Труба нержавеющая AISI 316 40х40х2','м'),material('archived','Доска лиственница 40х100х3000','м³',{sheet:'АРХИВ'}),material('unreviewed','Доска лиственница 40х100х3000','м³',{needsReview:true}),{id:'work',kind:'work',name:'Доска лиственница 40х100х3000'}];
const matcher=matching.create(fixtures),suggest=(name,labels=[])=>matcher.suggest({name,labels});
assert.equal(suggest('Деталь', [{source:'tag',text:'Доска_лиственница_40×100×3000'}]).selectedId,'larch');
assert.equal(suggest('Доска', [{source:'parent_tag',text:'Лиственница'}]).candidates[0].id,'larch');
assert.ok(!suggest('Доска', [{source:'parent_tag',text:'Лиственница'}]).candidates.some(c=>c.id==='pine'));
assert.equal(suggest('Доска сосна',[{source:'parent_tag',text:'Лиственница'}]).conflict,false);
assert.equal(suggest('Доска сосна',[{source:'tag',text:'Лиственница'}]).conflict,true);
assert.deepEqual(suggest('Доска сосна',[{source:'tag',text:'Лиственница'}]).candidates,[]);
assert.equal(suggest('Деталь 1').confidence,'unknown');
assert.equal(suggest('Доска лиственница').selectedId,'');
assert.ok(suggest('Доска лиственница').label.includes('Лиственница'));
assert.deepEqual(suggest('Труба AISI 304').candidates.map(c=>c.id),['304']);
assert.deepEqual(suggest('Труба 09G2S').candidates.map(c=>c.id),['steel']);
assert.equal(suggest('Фанера березовая 18 мм').selectedId,'plywood');
assert.equal(matching.describe('washer').family.length,0);
assert.ok(!matching.describe('Доска лиственница').form.includes('sheet'));
const sized=matching.create([material('thin','Фанера берёзовая 3 мм','лист'),material('thick','Фанера берёзовая (18х1220х2440 мм)','лист',{details:{'Толщина, мм':18}}),material('bend','Отвод AISI 304','шт.')]);
assert.deepEqual(sized.suggest({name:'Фанера берёзовая 18мм'}).candidates.map(c=>c.id),['thick']);
assert.deepEqual(sized.suggest({name:'Труба AISI 304'}).candidates,[]);
assert.equal(sized.suggest({name:'Лист',labels:[{source:'parent_tag',text:'Фанера берёзовая 18мм'}]}).candidates[0].id,'thick');
assert.equal(matching.create([fixtures[0],{...fixtures[0],id:'duplicate'}]).suggest({name:fixtures[0].name}).selectedId,'');
assert.equal(matcher.suggest({name:'Сталь'},'Фанера березовая 18 мм').selectedId,'plywood');
const labelsPacket=structuredClone(packet);labelsPacket.parts[0].labels=[{source:'definition',text:'Труба AISI 304'},{source:'tag',text:'Металл'}];
const labelsSpec=core.specification(labelsPacket,['p-1']).spec;specCore.validate(labelsSpec);assert.ok(labelsSpec.parts[0].attributes.some(a=>a.value==='Труба AISI 304'&&a.status==='observed'));assert.ok(labelsSpec.evidence[0].text.includes('definition: Труба AISI 304'));
labelsPacket.parts[0].labels[0].source='invalid';assert.throws(()=>core.validate(labelsPacket));
console.log('SketchUp materials: instance/definition/tags, inherited fallback, species/grade conflicts, exact/ambiguous matches, search override, catalog exclusions and provenance passed.');
