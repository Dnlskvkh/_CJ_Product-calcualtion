const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {mergeCatalog,writeReports}=require('./production-works-core.cjs');
const args=new Map();for(let i=2;i<process.argv.length;i+=2)args.set(process.argv[i],process.argv[i+1]);
const primary=args.get('--primary')||path.resolve(__dirname,'../../calculation data/Данные.xlsx');
const secondary=args.get('--secondary')||path.resolve(__dirname,'../../calculation data/Сметный калькулятор СК-V-3.06.xlsx');
const catalogFile=args.get('--catalog')||path.join(__dirname,'../dist/catalog.js');
const reportDir=args.get('--reports')||path.join(__dirname,'../reports/production-works');
const sourceJson=args.get('--source-json');const json=sourceJson?fs.readFileSync(sourceJson,'utf8'):execFileSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',path.join(__dirname,'read-production-workbooks.ps1'),'-Primary',primary,'-Secondary',secondary],{encoding:'utf8'});
function arrayBounds(text,start=text.indexOf('[')){let depth=0,inString=false,escaped=false;for(let i=start;i<text.length;i++){const c=text[i];if(inString){if(escaped){escaped=false;continue}if(c==='\\'){escaped=true;continue}if(c==='"')inString=false;continue}if(c==='"'){inString=true;continue}if(c==='[')depth++;else if(c===']'&&--depth===0)return [start,i+1]}throw Error('Не найден конец массива')}
const source=JSON.parse(json),text=fs.readFileSync(catalogFile,'utf8'),[start,end]=arrayBounds(text);const catalog=JSON.parse(text.slice(start,end));
const result=mergeCatalog(catalog,source.records);fs.writeFileSync(catalogFile,text.slice(0,start)+JSON.stringify(result.catalog)+';\n');writeReports(result.reports,reportDir);fs.writeFileSync(path.join(reportDir,'_summary.json'),JSON.stringify({records:source.records.length,secondarySheets:source.secondarySheets,workshops:result.catalog.filter(x=>x.kind==='work').reduce((a,x)=>(a[x.workshop]=(a[x.workshop]||0)+1,a),{})},null,2)+'\n');console.log(`Imported ${source.records.length} production works; reports: ${Object.keys(result.reports).length}`);
