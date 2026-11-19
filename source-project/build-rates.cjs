const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=__dirname,file=path.join(root,'dist/operation-rates.json');
if(!fs.existsSync(file)){
 const context={window:{}};vm.createContext(context);try{vm.runInContext(fs.readFileSync(path.join(root,'dist/catalog.js'),'utf8'),context)}catch(e){throw Error('Не удалось прочитать каталог: '+e.message)}
 const rates=context.window.CATALOG.filter(c=>c.kind==='work'&&c.unit==='м.п.'&&/^Раскрой /i.test(c.name)&&/лазер|гидроабраз/i.test(c.name)&&! /Подрядчик/.test(c.details?.['Тип работ']||'')&&Number.isFinite(c.price)&&c.price>0).map(c=>({id:'internal-'+c.row,type:/гидроабраз/i.test(c.name)?'waterjet':'laser',mode:'tariff',name:c.name,material:c.name,rate:c.price,pierceRate:null,setup:0,minimum:0,hourRate:null,consumables:0,manual:null,source:c.book+' · '+c.sheet+'!'+c.priceCell+' · внутренняя ставка; подготовка и минимум не включены',date:c.date||''}));
 fs.writeFileSync(file,JSON.stringify({format:'izdelie-operation-rates',version:1,rates},null,2));
}
const core=require('./dist/operation-rates-core.js'),doc=JSON.parse(fs.readFileSync(file,'utf8'));doc.rates=core.validate(doc);
fs.writeFileSync(path.join(root,'dist/operation-rates-data.js'),'const OPERATION_RATE_SEED='+JSON.stringify(doc)+';\n');
console.log('Internal operation rate profiles: '+doc.rates.length);
