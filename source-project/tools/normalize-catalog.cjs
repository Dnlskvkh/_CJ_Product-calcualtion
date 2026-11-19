// Catalogue formatting only: keep the first source name and every non-name field.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const core=require('../dist/catalog-normalization-core.js'),project=path.resolve(__dirname,'..');
const write=process.argv.includes('--write'),files=['catalog.js','metal-catalog.js'];
const prepared=files.map(file=>{
 const target=path.join(project,'dist',file),source=fs.readFileSync(target,'utf8'),start=source.indexOf('['),end=source.lastIndexOf(']');
 const before=JSON.parse(source.slice(start,end+1)),changes=[];
 const after=before.map(row=>{
  if(row.kind!=='material')return row;
  const name=core.name(row.name);if(name===row.name)return row;
  changes.push({id:row.id,before:row.name,after:name});
  const next={...row,name,sourceName:row.sourceName??row.name};
  const restored={...next,name:row.name};if(!Object.hasOwn(row,'sourceName'))delete restored.sourceName;
  assert.deepEqual(restored,row);assert.equal(core.name(name),name);return next;
 });
 assert.equal(after.length,before.length);assert.deepEqual(after.map(x=>x.id),before.map(x=>x.id));
 return {file,target,source,changes,content:source.slice(0,start)+JSON.stringify(after)+source.slice(end+1)};
});
const report={mode:write?'write':'dry-run',materials:prepared.reduce((n,p)=>n+JSON.parse(p.source.slice(p.source.indexOf('['),p.source.lastIndexOf(']')+1)).filter(x=>x.kind==='material').length,0),changed:prepared.reduce((n,p)=>n+p.changes.length,0),files:prepared.map(p=>({file:p.file,originalSha256:crypto.createHash('sha256').update(p.source).digest('hex'),changes:p.changes}))};
if(write&&report.changed){
 const backup=path.join(project,'outputs/catalog-normalization-backup',new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(backup,{recursive:true});
 for(const p of prepared)fs.writeFileSync(path.join(backup,p.file),p.source);
 try{for(const p of prepared)if(p.changes.length){fs.writeFileSync(p.target,p.content);assert.equal(fs.readFileSync(p.target,'utf8'),p.content);}}
 catch(error){for(const p of prepared)fs.writeFileSync(p.target,p.source);throw error;}
 report.backup=backup;fs.writeFileSync(path.join(project,'outputs/catalog-normalization-report.json'),JSON.stringify(report,null,2));
}
console.log(JSON.stringify({mode:report.mode,materials:report.materials,changed:report.changed,backup:report.backup,examples:report.files.flatMap(p=>p.changes).slice(0,8)},null,2));
