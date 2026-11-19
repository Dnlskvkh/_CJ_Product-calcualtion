// Install beside previous releases, preserving the complete current SQLite database.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process'),{DatabaseSync,backup}=require('node:sqlite');
const workspace=path.resolve(__dirname,'../..'),base='C:/Users/Danil.S/Desktop/Личная папка ДАНИЛ.С/1. - Рассчеты/Рассчеты изделий';
const build='Calculator-Windows-x64-2026-11-19T16-06-43-366Z',zip=path.join(__dirname,'../outputs',build+'.zip');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(hash(zip),'c6ba49f704fe31952d6d10524182a11e5dde9fbf2813e7237768b6d95640b6dc');
const time=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Vladivostok',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
const release=path.join(base,`Калькулятор стоимости ${time.day}.${time.month}.${time.year}_${time.hour}${time.minute}${time.second}`),root=path.join(release,build);
assert.equal(path.dirname(release),path.resolve(base));assert.ok(!fs.existsSync(release),'Refusing to overwrite an existing release');
const oldDb=JSON.parse(fs.readFileSync(path.join(workspace,'outputs/installed-latest-portable.json'),'utf8')).database;
assert.ok(path.resolve(oldDb).startsWith(path.resolve(base)+path.sep));
(async()=>{
 fs.mkdirSync(release);const copiedZip=path.join(release,build+'.zip');fs.copyFileSync(zip,copiedZip);assert.equal(hash(copiedZip),hash(zip));
 execFileSync('powershell.exe',['-NoProfile','-Command','Expand-Archive -LiteralPath $env:CALC_INSTALL_ZIP -DestinationPath $env:CALC_INSTALL_RELEASE'],{env:{...process.env,CALC_INSTALL_ZIP:copiedZip,CALC_INSTALL_RELEASE:release},stdio:'inherit'});
 for(const line of fs.readFileSync(path.join(root,'SHA256SUMS.txt'),'utf8').trim().split(/\r?\n/)){
  const [expected,relative]=line.split('  '),file=path.resolve(root,relative);assert.ok(file.startsWith(root+path.sep));assert.equal(hash(file),expected,relative);
 }
 const data=path.join(root,'data'),newDb=path.join(data,'calculator.sqlite');assert.ok(!fs.existsSync(newDb));
 for(const item of fs.readdirSync(path.dirname(oldDb)))if(!['calculator.sqlite','calculator.sqlite-wal','calculator.sqlite-shm'].includes(item))fs.cpSync(path.join(path.dirname(oldDb),item),path.join(data,item),{recursive:true,errorOnExist:true,force:false});
 const source=new DatabaseSync(oldDb,{readOnly:true});await backup(source,newDb);
 const copy=new DatabaseSync(newDb,{readOnly:true}),select='SELECT collection,entity_id,payload,rev FROM entity_records ORDER BY collection,entity_id';
 assert.deepEqual(copy.prepare(select).all(),source.prepare(select).all());assert.equal(copy.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
 const project=copy.prepare("SELECT payload FROM entity_records WHERE collection='izdelie-working-drafts-v1'").all().map(r=>JSON.parse(r.payload)).find(x=>x.calculation?.name==='Навес ТПУ');assert.ok(project);
 const rows=copy.prepare('SELECT COUNT(*) AS n FROM entity_records').get().n;copy.close();source.close();
 const result={release,root,database:newDb,sourceDatabase:oldDb,records:rows,verified:true,zipSha256:hash(copiedZip)};
 fs.writeFileSync(path.join(workspace,'outputs/installed-latest-portable.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
