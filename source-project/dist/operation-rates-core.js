(function(root){
const FIELDS=['rate','pierceRate','setup','minimum','hourRate','consumables','manual'];
function validate(doc){
 if(!doc||doc.format!=='izdelie-operation-rates'||doc.version!==1||!Array.isArray(doc.rates)||doc.rates.length>1000)throw Error('Нужен файл справочника ставок версии 1');
 const seen=new Set();return doc.rates.map(r=>{
 if(!r||typeof r.id!=='string'||! /^[a-zA-Z0-9_-]{1,100}$/.test(r.id)||seen.has(r.id))throw Error('Некорректный или повторный код ставки');seen.add(r.id);
 if(!['laser','waterjet','bending','milling'].includes(r.type)||!['tariff','machine','manual'].includes(r.mode)||typeof r.name!=='string'||!r.name.trim()||r.name.length>500)throw Error('Проверьте технологию и название ставки');
 r=(root.DomainSchema||(typeof require==='function'?require('./domain-schema.js'):null)).rate(r);const out={...r,id:r.id,type:r.type,mode:r.mode,name:r.name.trim(),material:String(r.material||'').slice(0,500),source:String(r.source||'').slice(0,2000),date:String(r.date||'').slice(0,100)};
 for(const k of FIELDS){const v=r[k]??null;if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0))throw Error(r.name+': некорректное поле '+k);out[k]=v}
 const required=r.mode==='tariff'?['rate']:r.mode==='machine'?['hourRate']:['manual'];if(required.some(k=>out[k]===null))throw Error(r.name+': не заполнена основная ставка');return out;
 });
}
function apply(operation,rate){const o={...operation};for(const k of FIELDS)o[k]=rate[k];return {...o,type:rate.type,mode:rate.mode,materialCode:rate.materialCode||'',thickness:rate.thickness??null,equipment:rate.equipment||'',quality:rate.quality||'',unit:rate.unit||'',material:rate.material,source:rate.source+(rate.date?' · '+rate.date:''),rateProfile:{id:rate.id,name:rate.name,date:rate.date,revision:rate.revision||1,updatedAt:rate.updatedAt||'',values:Object.fromEntries(FIELDS.map(k=>[k,rate[k]]))}}}
root.OperationRatesCore={FIELDS,validate,apply};if(typeof module!=='undefined')module.exports=root.OperationRatesCore;
})(typeof window!=='undefined'?window:globalThis);
