/* Name-based suggestions only. No prices, densities or conversion factors are inferred. */
(function(root){
'use strict';
const SOURCES={instance:'Название детали',definition:'Название компонента',tag:'Тег детали',parent_tag:'Тег родительского узла',material:'Материал оформления'};
const normal=x=>String(x??'').normalize('NFKC').toLowerCase().replaceAll('ё','е').replace(/#\d+\s*$/,'').replace(/(\d)\s*[xх×*]\s*(?=\d)/g,'$1х').replace(/[^\p{L}\p{N}х.,/]+/gu,' ').replace(/\s+/g,' ').trim();
const RULES={
 family:[['stainless','Нержавеющая сталь',/нержав|stainless|\baisi\b/],['steel','Сталь',/сталь|стальн|\bsteel\b|09г2с|09g2s|(?:^|\s)ст[2345](?:\s|$)/],['aluminium','Алюминий',/алюмин|alumin/],['wood','Древесина',/дерев|древес|пиломатериал|\bwood\b|\btimber\b|листвен|сосн|берез|(?:^|\s)дуб(?:ов|а|\s|$)|ясен|кедр|\b(?:larch|pine|birch|oak|ash|cedar)\b/],['concrete','Бетон',/бетон|concrete/],['plastic','Пластик',/пластик|полимер|пвх|polymer|plastic|\bpvc\b/],['glass','Стекло',/стекл|\bglass\b/]],
 species:[['larch','Лиственница',/листвен|\blarch\b/],['pine','Сосна',/сосн|\bpine\b/],['birch','Берёза',/берез|\bbirch\b/],['oak','Дуб',/(?:^|\s)дуб(?:ов|а|\s|$)|\boak\b/],['ash','Ясень',/ясен|\bash\b/],['cedar','Кедр',/кедр|\bcedar\b/]],
 form:[['plywood','Фанера',/фанер|plywood/],['pipe','Труба',/труб|\bpipe\b|\btube\b/],['board','Доска',/доск|\bboard\b|decking/],['timber','Брус',/брус|\bbeam\b/],['sheet','Лист',/(?:^|\s)лист(?:ов|ы|а|у|ом|е|\s|$)|\bsheet\b/],['angle','Уголок',/уголок|\bangle\b/],['channel','Швеллер',/швеллер|\bchannel\b/]]
};
const NAMES=Object.fromEntries(Object.values(RULES).flat().map(([id,name])=>[id,name]));
function describe(value){const text=normal(value),out={text};for(const [key,rules] of Object.entries(RULES))out[key]=rules.filter(([, ,re])=>re.test(text)).map(([id])=>id);
 if(out.family.includes('stainless'))out.family=out.family.filter(x=>x!=='steel');
 if(out.form.includes('plywood')&&!out.family.length)out.family.push('wood');
 if(out.form.includes('plywood'))out.form=out.form.filter(x=>x!=='sheet');
 if(out.species.length&&!out.family.includes('wood'))out.family.push('wood');
 out.grade=[...new Set([...text.matchAll(/(?:\baisi\s*|нержав\S*\s*)(304l?|316l?|321|430)\b/g)].map(m=>'aisi'+m[1]).concat(/09[гg]2[сs]/.test(text)?['09г2с']:[],[...text.matchAll(/(?:^|\s)ст\s*([2345])(?:\s|$)/g)].map(m=>'ст'+m[1])))];
 out.dimensions=[...text.matchAll(/\d+(?:[.,]\d+)?(?:х\d+(?:[.,]\d+)?)+/g)].map(m=>m[0].replaceAll(',','.'));
 out.scalarMM=[...text.matchAll(/(?<![х\d.,])(\d+(?:[.,]\d+)?)\s*мм(?:\s|$)/g)].map(m=>Number(m[1].replace(',','.')));
 return out;
}
function labels(part){const raw=Array.isArray(part.labels)?part.labels:[];const result=raw.filter(l=>l&&Object.hasOwn(SOURCES,l.source)&&typeof l.text==='string'&&l.text.trim()).map(l=>({source:l.source,text:l.text.slice(0,500)}));if(!result.some(l=>l.text===part.name))result.unshift({source:'instance',text:part.name||''});if(part.material&&!result.some(l=>l.source==='material'))result.push({source:'material',text:part.material});return result;}
const words=text=>normal(text).split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>=3&&!/^(?:группа|компонент|деталь|group|component|componentinstance|untagged|layer|default|материал|material|мм|сорт|гост)$/.test(w)&&!/^\d+$/.test(w));
function overlap(a,b){return a.some(x=>b.includes(x));}
function conflictIn(key,a,b){return a.length&&b.length&&!overlap(a,b)&&!(key==='form'&&[...a,...b].every(x=>['sheet','plywood'].includes(x)));}
function create(catalog){
 const index=catalog.filter(c=>c.kind==='material'&&!c.needsReview&&!/архив|заглушк/i.test((c.sheet||'')+' '+c.name)).map(c=>{const name=describe(c.name),signal=describe(c.name+' '+(c.category||'')+' '+(c.details?.['Материал']||'')+' '+(c.details?.['Тип']||''));signal.form=name.form;const raw=c.details?.['Толщина, мм'],thickness=typeof raw==='number'&&Number.isFinite(raw)?raw:name.scalarMM.length===1?name.scalarMM[0]:null;return {item:c,signal,words:words(c.name),thickness};});
 function suggest(part,query=''){
  const all=labels(part),own=all.filter(l=>l.source!=='parent_tag');
  const signals=(query.trim()?[{source:'search',text:query.slice(0,500)}]:own).map(l=>({...l,signal:describe(l.text)}));
  const summary={};for(const key of ['family','species','form','grade'])summary[key]=[...new Set(signals.flatMap(l=>l.signal[key]))];
  if(!query.trim())for(const l of all.filter(l=>l.source==='parent_tag')){const s=describe(l.text);if(['family','species','form','grade'].some(key=>conflictIn(key,summary[key],s[key])))continue;let useful=false;for(const key of ['family','species','form','grade'])if(!summary[key].length&&s[key].length){summary[key]=s[key];useful=true;}if(summary.form.includes('sheet')&&s.form.includes('plywood')){summary.form=['plywood'];useful=true;}if(useful)signals.push({...l,signal:s});}
  if(summary.form.includes('plywood'))summary.form=summary.form.filter(x=>x!=='sheet');
  const thickness=overlap(summary.form,['plywood','sheet'])?[...new Set(signals.flatMap(l=>l.signal.scalarMM))]:[];
  const conflict=['family','species','form','grade'].some(key=>summary[key].length>1)||thickness.length>1;
  const label=[...summary.family,...summary.species,...summary.form,...summary.grade].map(x=>NAMES[x]||x.toUpperCase()).concat(thickness.map(x=>x+' мм')).join(' · ');
  const candidates=[];
  if(!conflict)for(const entry of index){const c=entry.item,s=entry.signal;
   if(['family','species','form','grade'].some(key=>summary[key].length&&s[key].length&&!overlap(summary[key],s[key])))continue;
   if(summary.grade.length&&!overlap(summary.grade,s.grade))continue;
   if(summary.species.length&&!overlap(summary.species,s.species))continue;
   if(summary.form.length&&!overlap(summary.form,s.form))continue;
   if(thickness.length&&entry.thickness!==null&&!thickness.includes(entry.thickness))continue;
   const exact=signals.find(l=>normal(l.text)===normal(c.name));let best=0,reason='';
   for(const l of signals){const terms=words(l.text),common=terms.filter(w=>entry.words.some(v=>v===w||w.length>=5&&v.length>=5&&(v.startsWith(w.slice(0,-1))||w.startsWith(v.slice(0,-1))))).length;let score=common*3;
    for(const key of ['family','species','form','grade'])if(overlap(l.signal[key],s[key]))score+=key==='grade'?12:key==='species'?8:key==='form'?6:4;
    if(l.signal.dimensions.length&&s.dimensions.length){if(overlap(l.signal.dimensions,s.dimensions))score+=12;else score-=15;}
    if(score>best){best=score;reason=(SOURCES[l.source]||'Поиск')+': «'+l.text+'»';}}
   if(thickness.length&&entry.thickness!==null&&thickness.includes(entry.thickness))best+=12;
   if(exact){best+=1000;reason=(SOURCES[exact.source]||'Поиск')+': точное название «'+exact.text+'»';}
   if(best>=4)candidates.push({id:c.id,name:c.name,unit:c.unit,price:c.price,reason,score:best,exact:!!exact});
  }
  candidates.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'ru')||String(a.id).localeCompare(String(b.id)));
  const exact=candidates.filter(c=>c.exact),selectedId=exact.length===1?exact[0].id:'';
  return {label,conflict,confidence:conflict?'conflict':selectedId?'exact':candidates.length||label?'suggested':'unknown',selectedId,sources:signals.map(({source,text})=>({source,text})),candidates:candidates.slice(0,8)};
 }
 return {suggest};
}
root.CJMaterialMatch={SOURCES,normal,describe,labels,create};if(typeof module!=='undefined')module.exports=root.CJMaterialMatch;
})(typeof window!=='undefined'?window:globalThis);
