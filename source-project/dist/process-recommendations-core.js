(function(root){
const materialCore=root.MaterialSuggestionsCore||(typeof require==='function'?require('./material-suggestions-core.js'):null);
function materialFor(line,lines){const seen=new Set();let l=line;while(l?.processBinding&&!seen.has(l.processKey)){seen.add(l.processKey);l=lines.find(x=>x.processKey===l.processBinding.from);}return l?.kind==='material'?l:null;}
function rules(line,lines,catalog){if(line.kind==='material'&&line.processBinding&&!materialCore.family(line,catalog))return [];const material=materialFor(line,lines);if(!material)return [];const family=materialCore.family(material,catalog),ply=/фанер/i.test(material.name);let out=[];
 if(family==='wood'){out=[...(line.kind==='material'&&!line.processBinding?[ply?{key:'cut',label:'Раскрой фанеры на ЧПУ',ids:['Перечень_работ:146','Перечень_работ:147']}:{...materialCore.RULES.wood.find(r=>r.key==='crosscut'),key:'cut'}]:[]),{key:'chamfer',label:'Снятие фаски',ids:ply?['Перечень_работ:158']:['Перечень_работ:185','Перечень_работ:186']},{key:'sanding',label:'Шлифовка поверхности',ids:ply?['Перечень_работ:188']:['Перечень_работ:187']},{key:'primer-work',label:'Нанесение грунта-антисептика',ids:['Перечень_работ:3']},{key:'finish-work',label:'Нанесение финишного покрытия',ids:['Перечень_работ:42']},...materialCore.RULES.wood.filter(r=>['primer','finish'].includes(r.key))];}
 if(family==='steel'){out=[...(line.kind==='material'&&/труба/i.test(material.name)?[{key:'cut',label:'Раскрой профильного металла',ids:['Перечень_работ:144']}]:[]),...materialCore.RULES.steel];}
 return out.map(r=>({...r,options:materialCore.options(r,catalog)})).filter(r=>r.options.length);
}
function linked(lines,source,candidate){return lines.find(l=>l.processBinding?.from===source.processKey&&l.kind===candidate.kind&&(l.catalogId===candidate.id||l.name.trim()===candidate.name.trim()));}
root.ProcessRecommendationsCore={materialFor,rules,linked};if(typeof module!=='undefined')module.exports=root.ProcessRecommendationsCore;
})(typeof window!=='undefined'?window:globalThis);
