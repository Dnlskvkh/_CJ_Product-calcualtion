(function(root){
const KEY='izdelie-operation-rates-v2',LEGACY_KEY='izdelie-operation-rates-v1';
function create({read,write,seed}){
 function list(){const current=read(KEY,null),saved=current??read(LEGACY_KEY,null),out={};for(const r of seed.rates.filter(r=>current===null||r.id.startsWith('internal-bending-')))out[r.id]=root.DomainSchema.rate(r);if(saved){if(typeof saved!=='object'||Array.isArray(saved))throw Error('Повреждён справочник ставок');for(const [id,r] of Object.entries(saved)){const valid=root.DomainSchema.rate(r);if(id!==valid.id)throw Error('Код ставки не совпадает');out[id]=valid}}return Object.values(out)}
 function materialize(){return Object.fromEntries(list().map(r=>[r.id,r]))}
 function save(r){const valid=root.DomainSchema.rate(r),data=materialize(),prior=data[valid.id];valid.revision=(prior?.revision||0)+1;valid.updatedAt=new Date().toISOString();data[valid.id]=valid;return write(KEY,data)}
 function importAll(rates){const data=materialize();for(const r of rates){const valid=root.DomainSchema.rate(r),prior=data[valid.id];valid.revision=(prior?.revision||0)+1;valid.updatedAt=new Date().toISOString();data[valid.id]=valid}return write(KEY,data)}
 return {list,materialize,save,importAll};
}
function merge(local,remote){const stable=x=>x&&typeof x==='object'?Object.fromEntries(Object.keys(x).filter(k=>!['revision','updatedAt'].includes(k)).sort().map(k=>[k,stable(x[k])])):x;const result=structuredClone(remote);for(const [id,r] of Object.entries(local)){if(!result[id]){result[id]=r;continue}if(JSON.stringify(stable(r))===JSON.stringify(stable(result[id]))){if((r.revision||1)>(result[id].revision||1))result[id]=r;continue}const copy=structuredClone(r),conflict=id.slice(0,75)+'-conflict-'+root.crypto.randomUUID().slice(0,8);copy.id=conflict;copy.name=copy.name.slice(0,430)+' — локальная версия при конфликте';copy.source=(copy.source||'').slice(0,1800)+'; конфликт с '+id;result[conflict]=copy}return result}
root.RateRepository={KEY,LEGACY_KEY,create,merge};if(typeof module!=='undefined')module.exports=root.RateRepository;
})(typeof window!=='undefined'?window:globalThis);
