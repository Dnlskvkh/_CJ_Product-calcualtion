// Same source JSON format as read-production-workbooks.ps1; no writes to material catalogs.
const fs=require('node:fs'),path=require('node:path');
const core=require('../dist/production-model-core.js'),seed=require('../dist/production-catalog.js');
if(![4,5].includes(process.argv.length))throw Error('Использование: node tools/sync-production-source.cjs проверенный-источник.json результат-настроек.json [экспорт-текущих-настроек.json]');
const [input,output,settings]=process.argv.slice(2).map(f=>path.resolve(f));if(fs.existsSync(output)||input===output)throw Error('Результат должен иметь новое имя');
const raw=fs.readFileSync(input,'utf8');if(Buffer.byteLength(raw)>5000000)throw Error('Источник больше 5 МБ');const source=JSON.parse(raw);
const current=new Set(seed.sourceMapping.map(x=>x.work_id)),excluded=new Set(seed.outsideActive);
const auditPath=path.resolve(__dirname,'../../docs/production-migration/source-to-app-mapping.json');if(fs.existsSync(auditPath))for(const item of JSON.parse(fs.readFileSync(auditPath)).appOnly){const match=item.id.match(/^Перечень_работ:(\d+)$/);if(match&&!current.has(Number(match[1])))excluded.add(Number(match[1]));}
const currentDefinitions=new Map(seed.operations.map(d=>[d.id,d]));if(settings){const exported=JSON.parse(fs.readFileSync(settings,'utf8'));if(exported.format!=='izdelie-production-catalog'||exported.version!==1)throw Error('Неизвестный формат настроек');for(const [id,d]of Object.entries(core.catalogDefinitions(exported.operations)))currentDefinitions.set(id,d);}
const result=core.synchronizeCatalog([...currentDefinitions.values()],source.records,[...excluded]);
const changed=Object.fromEntries(result.operations.filter(d=>!seed.operations.some(s=>s.id===d.id&&JSON.stringify(s)===JSON.stringify(d))).map(d=>[d.id,d]));core.catalogDefinitions(changed);
fs.writeFileSync(output,JSON.stringify({format:'izdelie-production-catalog',version:1,source_sync:true,operations:changed,report:result.report},null,2),{flag:'wx'});console.log('Source synchronization preview saved:',output,result.report);
