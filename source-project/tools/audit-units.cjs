// Read-only inventory of unit spellings, including archived calculations.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{DatabaseSync}=require('node:sqlite');
const project=path.resolve(__dirname,'..'),workspace=path.dirname(project),core=require('../dist/material-core.js');
const c={};c.window=c;vm.createContext(c);
for(const file of ['catalog.js','metal-catalog.js','production-catalog.js','purchases-data.js','operation-rates-data.js'])vm.runInContext(fs.readFileSync(path.join(project,'dist',file),'utf8'),c,{filename:file});
const groups=new Map();let empty=0;
function add(value,source){if(typeof value!=='string')return;if(!value.trim()){empty++;return;}const row=groups.get(value)||{value,label:core.unitLabel(value),count:0,sources:new Set()};row.count++;row.sources.add(source);groups.set(value,row);}
function walk(value,source){if(Array.isArray(value)){value.forEach(v=>walk(v,source));return;}if(value&&typeof value==='object')for(const [key,v]of Object.entries(value)){if((key==='unit'||/Unit$|_unit$/.test(key))&&!/_per_unit$/.test(key))add(v,source+':'+key);if(v&&typeof v==='object')walk(v,source);}}
for(const key of Object.keys(c))if(key!=='window')walk(c[key],key);
const install=JSON.parse(fs.readFileSync(path.join(workspace,'outputs/installed-latest-portable.json'),'utf8')),db=new DatabaseSync(install.database,{readOnly:true});
const records=db.prepare('SELECT collection,payload FROM entity_records').all();for(const r of records)walk(JSON.parse(r.payload),r.collection);db.close();
const values=[...groups.values()].map(r=>({...r,sources:[...r.sources].sort()})).sort((a,b)=>b.count-a.count);
const unresolved=c.CATALOG.filter(r=>['???','ч/ч'].includes(r.unit)).map(r=>({id:r.id,name:r.name,unit:r.unit,reason:r.unit==='???'?'Единица отсутствует в источнике':'Неоднозначное обозначение: без подтверждения не переводится в чел·ч'}));
const report={date:'2026-11-19',savedRecords:records.length,distinctSpellings:values.length,changedSpellings:values.filter(r=>r.value!==r.label).length,emptyFields:empty,values,unresolved};
fs.writeFileSync(path.join(workspace,'docs/research/2026-11-19-unit-audit.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({savedRecords:report.savedRecords,distinctSpellings:report.distinctSpellings,changedSpellings:report.changedSpellings,emptyFields:empty,unresolved},null,2));
