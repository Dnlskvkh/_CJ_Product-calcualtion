const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const report=require('./dist/internal-report.js');
const state={name:'Проверка отчёта <script>',code:'QA-REPORT',qty:10,notes:'Первая строка\nВторая строка',overhead:10,transport:5,markup:20,vat:22};
const result={rows:[{kind:'material',name:'Длинное наименование материала & крепежа',group:'Материалы',unit:'шт.',qty:2,need:20,purchase:24,price:0,amount:0,reserve:0,pack:12,source:'Тестовый источник',date:'2026-11-06'},{kind:'work',name:'Работа <контроль>',unit:'ч',qty:null,price:null,amount:null,normNote:'Норма требует проверки',source:'Проверка'}],partial:true,errors:['Неизвестный объём'],M:0,C:0,costUnit:0,markupBase:0,P:0,net:0,tax:0,total:0,unit:0,cash:0,overhead:0,transport:0};
const m=report.model(state,result,'2026-11-06T00:00:00Z'),before=JSON.stringify(m),html=report.html(m);
const withoutWarnings=report.html(m,{includeWarnings:false});
assert.ok(!withoutWarnings.includes('<h3>Замечания'));
assert.ok(!withoutWarnings.includes('Неизвестный объём'));
assert.ok(withoutWarnings.includes('НЕПОЛНЫЙ РАСЧЁТ'));
assert.ok(withoutWarnings.includes('Первая строка'));
assert.ok(withoutWarnings.includes('Параметры расчёта'));
assert.equal(JSON.stringify(m),before);
assert.equal(JSON.stringify(m),before);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.match(html,/MedeoSans-Regular\.ttf/);assert.match(html,/A4 portrait/);assert.ok(html.includes('Норма требует проверки'));assert.ok(html.includes('Тестовый источник'));assert.ok(html.includes('Не определено'));assert.ok(html.includes('известная часть'));assert.ok(!html.includes('font-size:10px'));
const ui=fs.readFileSync('dist/internal-report-ui.js','utf8');
function harness({fontFailure=false,emptyFonts=false,imageFailure=false,loading=false}={}){
 const calls=[],messages=[];let finishFonts;
 const pending=new Promise(resolve=>finishFonts=resolve),doc={readyState:loading?'loading':'complete',body:{textContent:'Отчёт'},fonts:{load:async()=>{calls.push('font');if(fontFailure)throw Error('network');await pending;return emptyFonts?[]:[{}]},ready:Promise.resolve()},images:[{decode:async()=>{calls.push('image');if(imageFailure)throw Error('broken image')}}]};
 const frame={contentDocument:doc,isConnected:true,contentWindow:{focus(){calls.push('focus')},print(){calls.push('print')}}};
 const context={console,Promise,Array,setTimeout,clearTimeout,$:()=>frame,toast:text=>messages.push(text)};vm.createContext(context);vm.runInContext(ui,context);return {calls,messages,frame,finishFonts,context,print:()=>context.printInternalReport()};
}
(async()=>{
 const framePreview={},checkbox={checked:true},previewContext={Promise,Array,setTimeout,clearTimeout,InternalReport:report,internalReportModel:()=>m,modal(){},toast(){},$:id=>id==='internalReportWarnings'?checkbox:framePreview};
 vm.createContext(previewContext);vm.runInContext(ui,previewContext);previewContext.internalReportModel=()=>m;previewContext.previewInternalPDF();assert.ok(framePreview.srcdoc.includes('<h3>Замечания'));checkbox.checked=false;previewContext.updateInternalReportPreview();assert.ok(!framePreview.srcdoc.includes('<h3>Замечания'));checkbox.checked=true;previewContext.updateInternalReportPreview();assert.ok(framePreview.srcdoc.includes('<h3>Замечания'));
 let h=harness(),first=h.print();await h.print();assert.equal(h.calls.filter(x=>x==='font').length,3);assert.ok(!h.calls.includes('print'));h.finishFonts();await first;assert.equal(h.calls.at(-1),'print');assert.ok(h.calls.indexOf('image')<h.calls.indexOf('print'));
 for(const options of [{fontFailure:true},{emptyFonts:true},{imageFailure:true}]){h=harness(options);h.finishFonts();await h.print();assert.ok(!h.calls.includes('print'));assert.ok(h.messages.at(-1).includes('Не удалось подготовить PDF'));}
 h=harness({loading:true});await h.print();assert.deepEqual(h.calls,[]);
 h=harness();first=h.print();h.frame.isConnected=false;h.finishFonts();await first;assert.ok(!h.calls.includes('print'));
 // Native printing may keep the first JS call on the stack while later UI events run.
 h=harness();h.finishFonts();let nextPrint;
 h.frame.contentWindow.print=()=>{h.calls.push('print');if(!nextPrint)nextPrint=h.print();};
 await h.print();await nextPrint;assert.equal(h.calls.filter(x=>x==='print').length,2,'Native print must not retain the preparation lock');
 // A new preview must invalidate preparation even before srcdoc navigation replaces its document.
 h=harness();first=h.print();h.context.updateInternalReportPreview();h.finishFonts();await first;
 assert.ok(!h.calls.includes('print'),'Do not print a superseded preview');
 await h.print();assert.equal(h.calls.filter(x=>x==='print').length,1,'The next preview can print');
 // Completing an obsolete job must not unlock a newer job still loading its assets.
 h=harness();first=h.print();h.context.updateInternalReportPreview();let finishNextFonts;
 const nextFonts=new Promise(resolve=>finishNextFonts=resolve);
 h.frame.contentDocument={...h.frame.contentDocument,fonts:{load:async()=>{h.calls.push('next-font');await nextFonts;return [{}]},ready:Promise.resolve()}};
 const second=h.print();h.finishFonts();await first;await h.print();
 assert.equal(h.calls.filter(x=>x==='next-font').length,3);assert.ok(!h.calls.includes('print'));
 finishNextFonts();await second;assert.equal(h.calls.filter(x=>x==='print').length,1);
 await h.print();assert.equal(h.calls.filter(x=>x==='print').length,2,'Printing remains available after completion');
 console.log('Internal report: escaped content, zero/unknown values, unchanged model, report layout, font/image readiness, failed assets, loading/replaced preview and duplicate print protection passed.');
})().catch(e=>{console.error(e);process.exitCode=1});
