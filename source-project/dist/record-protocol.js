(function(root){
const ARRAY_KEYS=new Set(['izdelie-library-v2','izdelie-quotes-v2','izdelie-variants-v4']);
const key=(collection,id)=>JSON.stringify([collection,id]);
function flatten(data){const result={};for(const [collection,text] of Object.entries(data)){const value=JSON.parse(text),array=ARRAY_KEYS.has(collection);result[key(collection,'$collection')]={collection,id:'$collection',value:array?'array':'object'};for(const [id,item] of array?value.map(v=>[v.id,v]):Object.entries(value))result[key(collection,id)]={collection,id,value:item}}return result}
function expand(records){const values={};for(const r of records)if(r.id==='$collection'&&r.value!==null)values[r.collection]=r.value==='array'?[]:{};for(const r of records)if(r.id!=='$collection'&&r.value!==null){const v=values[r.collection];if(!v)continue;if(Array.isArray(v))v.push(r.value);else Object.defineProperty(v,r.id,{value:r.value,enumerable:true,configurable:true,writable:true})}return Object.fromEntries(Object.entries(values).map(([k,v])=>[k,JSON.stringify(v)]))}
function diff(before,after,versions){const a=flatten(before),b=flatten(after),changes=[];for(const k of new Set([...Object.keys(a),...Object.keys(b)])){if(JSON.stringify(a[k]?.value)===JSON.stringify(b[k]?.value))continue;const r=b[k]||{...a[k],value:null};changes.push({...r,expectedRevision:versions[k]||0})}return changes}
root.RecordProtocol={key,flatten,expand,diff};if(typeof module!=='undefined')module.exports=root.RecordProtocol;
})(typeof window!=='undefined'?window:globalThis);
