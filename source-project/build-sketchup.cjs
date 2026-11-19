/* Local RBZ packaging. No installation, publishing, model data or remote writes. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
if(process.platform!=='win32')throw Error('This packaging script requires Windows PowerShell.');
execFileSync(process.execPath,[path.join(__dirname,'build-worker.cjs')],{stdio:'inherit'});
execFileSync(process.execPath,[path.join(__dirname,'sketchup-check.cjs')],{stdio:'inherit'});
const version='0.2.0',stamp=new Date().toISOString().replace(/[:.]/g,'-');
const stage=path.join(__dirname,'outputs','sketchup','build-'+stamp),extension=path.join(stage,'cj_calculator'),web=path.join(extension,'web');
fs.mkdirSync(web,{recursive:true});
fs.copyFileSync(path.join(__dirname,'sketchup/cj_calculator.rb'),path.join(stage,'cj_calculator.rb'));
for(const f of fs.readdirSync(path.join(__dirname,'sketchup/cj_calculator')))fs.copyFileSync(path.join(__dirname,'sketchup/cj_calculator',f),path.join(extension,f));
const {assets}=require('./build-pwa.cjs');
for(const file of assets){if(file==='/pwa.js')continue;fs.copyFileSync(path.join(__dirname,'dist',file.slice(1)),path.join(web,file.slice(1)));}
for(const name of ['material-match-core.js','selection-core.js','bridge.js','bridge.css'])fs.copyFileSync(path.join(extension,name),path.join(web,name));
fs.writeFileSync(path.join(web,'host-data.js'),'window.CJ_SPEC_PROMPT='+JSON.stringify(fs.readFileSync(path.join(__dirname,'SKETCHUP_SPEC_PROMPT.txt'),'utf8'))+';');
let html=fs.readFileSync(path.join(web,'index.html'),'utf8');
html=html.replace('<script src="pwa.js"></script>','').replace('</head>','<link rel="stylesheet" href="bridge.css"></head>').replace('</body>','<script src="host-data.js"></script><script src="material-match-core.js"></script><script src="selection-core.js"></script><script src="bridge.js"></script></body>');
fs.writeFileSync(path.join(web,'index.html'),html);
// Reports must remain self-contained after saving outside the extension folder.
let report=fs.readFileSync(path.join(web,'internal-report.js'),'utf8');
for(const file of ['MedeoSans-Regular.ttf','MedeoSans-Bold.ttf'])report=report.replaceAll('/'+file,'data:font/ttf;base64,'+fs.readFileSync(path.join(web,file)).toString('base64'));
fs.writeFileSync(path.join(web,'internal-report.js'),report);
fs.copyFileSync(path.join(__dirname,'SKETCHUP.txt'),path.join(extension,'ИНСТРУКЦИЯ.txt'));
fs.copyFileSync(path.join(__dirname,'SKETCHUP_VALIDATION.txt'),path.join(extension,'SKETCHUP_VALIDATION.txt'));
const files=fs.readdirSync(stage,{recursive:true}).filter(f=>fs.statSync(path.join(stage,f)).isFile()).sort();
fs.writeFileSync(path.join(extension,'SHA256SUMS.txt'),files.map(f=>crypto.createHash('sha256').update(fs.readFileSync(path.join(stage,f))).digest('hex')+'  '+f.replaceAll('\\','/')).join('\n')+'\n');
const zip=path.join(__dirname,'outputs','sketchup','CJ-Calculator-SketchUp-'+version+'-'+stamp+'.zip'),archive=zip.replace(/\.zip$/,'.rbz');
execFileSync('powershell.exe',['-NoProfile','-Command','Compress-Archive -Path (Join-Path $env:CJ_SKETCHUP_STAGE "*") -DestinationPath $env:CJ_SKETCHUP_ZIP -CompressionLevel Optimal'],{env:{...process.env,CJ_SKETCHUP_STAGE:stage,CJ_SKETCHUP_ZIP:zip},stdio:'inherit'});
fs.renameSync(zip,archive);
const sha=crypto.createHash('sha256').update(fs.readFileSync(archive)).digest('hex');
fs.writeFileSync(archive+'.sha256',sha+'  '+path.basename(archive)+'\n');
fs.writeFileSync(path.join(__dirname,'outputs/sketchup/latest-build.json'),JSON.stringify({version,stage,web,archive,sha256:sha},null,2));
execFileSync(process.execPath,[path.join(__dirname,'sketchup-package-check.cjs')],{stdio:'inherit'});
console.log('SketchUp package: '+archive+'\nLocal preview folder: '+web);
