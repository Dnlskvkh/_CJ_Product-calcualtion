/* Explicit mapping of a read-only model snapshot to the existing intake format. */
(function(root){
'use strict';
const finite=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const CHOICES={review:['Выбрать в помощнике',null,null],volume:['Объём тела','м³','volume'],surface:['Все поверхности (одна сторона каждой грани)','м²','surface_area'],face:['Площадь выделенной грани','м²','face_area'],x:['Габарит по локальной оси X','м','part_length'],y:['Габарит по локальной оси Y','м','part_length'],z:['Габарит по локальной оси Z','м','part_length'],longest:['Наибольший локальный габарит','м','part_length'],edges:['Сумма длин рёбер (все рёбра)','м','part_length']};
function check(ok,message){if(!ok)throw Error(message);}
function validate(packet){
 check(packet&&packet.format==='cj-sketchup-selection'&&packet.version===1&&typeof packet.model_id==='string'&&typeof packet.model_name==='string'&&typeof packet.revision==='string','Некорректный ответ SketchUp');
 check(Array.isArray(packet.parts)&&packet.parts.length>0&&packet.parts.length<=1000,'Нет деталей или превышен предел 1000 деталей');
 const ids=new Set(),occurrences=new Set();for(const p of packet.parts){check(p&&typeof p.id==='string'&&/^[a-zA-Z0-9_-]+$/.test(p.id)&&!ids.has(p.id)&&typeof p.occurrence==='string'&&!occurrences.has(p.occurrence)&&typeof p.name==='string'&&p.name.trim(),'Некорректная или повторная деталь');ids.add(p.id);occurrences.add(p.occurrence);
 check(Array.isArray(p.dimensions_m)&&p.dimensions_m.length===3&&p.dimensions_m.every(x=>x===null||finite(x)),'Некорректные размеры');
 for(const k of ['surface_area_m2','face_area_m2','edge_length_m','volume_m3'])check(p[k]===null||finite(p[k]),'Некорректное измерение '+k);
 check(Array.isArray(p.notes)&&p.notes.every(x=>typeof x==='string'),'Некорректные замечания');
 if(p.labels!==undefined)check(Array.isArray(p.labels)&&p.labels.length<=20&&p.labels.every(l=>l&&['instance','definition','tag','parent_tag','material'].includes(l.source)&&typeof l.text==='string'&&l.text.length<=500),'Некорректные названия для подбора материала');}return packet;
}
function value(part,key){switch(key){case 'volume':return part.volume_m3;case 'surface':return part.surface_area_m2;case 'face':return part.face_area_m2;case 'edges':return part.edge_length_m;case 'x':case 'y':case 'z':return part.dimensions_m['xyz'.indexOf(key)];case 'longest':return part.dimensions_m.every(finite)?Math.max(...part.dimensions_m):null;default:return null;}}
function specification(packet,ids,choice='review'){
 validate(packet);check(Object.hasOwn(CHOICES,choice),'Выберите измерение');check(Array.isArray(ids)&&ids.length&&new Set(ids).size===ids.length&&ids.every(id=>packet.parts.some(p=>p.id===id)),'Выберите детали');
 const parts=packet.parts.filter(p=>ids.includes(p.id)),limits=['Снимок только выбранной геометрии; полнота изделия не подтверждена.','Площадь — сумма граней с одной стороны; соприкасающиеся и внутренние поверхности не исключаются.','Габариты по локальным осям не являются длиной реза или заготовки. Сумма рёбер не является длиной шва.','Материал SketchUp — название оформления, без подтверждения марки, плотности, закупочной единицы и цены.','Объёмы относятся к одному изделию в текущем расчёте. Проверьте, не выбрана ли уже вся партия.'];
 if(packet.skipped)limits.push('Пропущено объектов без доступной геометрии или невидимых: '+packet.skipped);
 limits.push(packet.include_hidden?'Скрытые объекты и выключенные теги включены.':'Скрытые объекты и выключенные теги исключены.');
 const evidence=parts.map((p,i)=>({id:'E'+i,type:'measurement',reference:packet.model_id+':'+p.occurrence,text:'SketchUp · '+p.name+' · '+p.occurrence+'; метры, м² и м³ с учётом преобразований экземпляра. '+p.notes.join(' ')+' '+(p.labels||[]).map(l=>l.source+': '+l.text).join('; ')}));
 const spec={format:'cj-model-spec',version:1,source:{access:'live_model',completeness:'partial',id:packet.model_id,model_name:packet.model_name,revision:packet.revision,scope:'Выделенные детали; '+(packet.split?'разложение вложенных узлов':'выбранные объекты целиком')+'; '+CHOICES[choice][0],original_units:'SketchUp internal inches → m/m²/m³',limitations:limits},products:[{id:'P1',name:packet.model_name,batch_qty:null,evidence_refs:evidence.map(e=>e.id)}],assemblies:[],parts:[],process_candidates:[],requirements:[],evidence,questions:[]};
 spec.parts=parts.map((p,i)=>{const refs=['E'+i],metric=(key,v,unit)=>({key,value:v,unit,basis:'per_part',status:v===null?'unknown':'derived',evidence_refs:refs});const metrics=[metric('volume',p.volume_m3,'м³'),metric('surface_area',p.surface_area_m2,'м²'),metric('face_area',p.face_area_m2,'м²')];if(CHOICES[choice][2]==='part_length')metrics.push(metric('part_length',value(p,choice),'м'));
 return {id:p.id,product_id:'P1',assembly_id:null,name:p.name,role:'fabricated_part',quantity:{value:1,unit:'шт.',basis:'per_product',status:'observed',evidence_refs:refs},attributes:[...(p.material?[{key:'SketchUp material',value:p.material,unit:null,status:'observed',evidence_refs:refs}]:[]),...(p.labels||[]).map((l,j)=>({key:'SketchUp '+l.source+' '+(j+1),value:l.text,unit:null,status:'observed',evidence_refs:refs})),{key:'Выбранное измерение',value:CHOICES[choice][0],unit:null,status:'observed',evidence_refs:refs}],occurrence_refs:[p.occurrence],metrics,evidence_refs:refs};});
 return {spec,unit:CHOICES[choice][1],driver:CHOICES[choice][2]};
}
root.CJSelectionCore={CHOICES,validate,value,specification};if(typeof module!=='undefined')module.exports=root.CJSelectionCore;
})(typeof window!=='undefined'?window:globalThis);
