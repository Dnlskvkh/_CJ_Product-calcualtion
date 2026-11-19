(function(root){
const materialUnits=root.MaterialCore||(typeof require==='function'?require('./material-core.js'):null);
function sourceText(p){const refs=p.excelRows.length>180?p.excelRows.slice(0,180)+'…':p.excelRows;return `Историческая цена заказа · ${p.id} · Все что из заказов.xlsx · Лист_1 · исходные строки ${refs} · ${p.date} · последняя ${p.price} ₽/${p.unit}`}
function toCatalog(p){return {id:'procurement:'+p.id,name:p.name,unit:p.unit,price:p.price,kind:p.kind,mass:null,date:p.date,book:'Все что из заказов.xlsx',sheet:'Лист_1',priceCell:'исходные строки '+p.excelRows,purchaseSource:sourceText(p)}}
function applyUpdates(catalog,data){for(const u of data.updates){const c=catalog.find(x=>x.id===u.catalogId),p=data.records.find(x=>x.id===u.purchaseId);if(!c||!p?.eligible||p.date>data.meta.reportDate)continue;c.previousPrice=u.oldPrice;c.previousDate=u.oldDate;c.price=u.newPrice;c.date=p.date;c.purchaseId=p.id;c.purchaseSource=sourceText(p)+' · '+u.reason;c.updateReason=u.reason;c.priceFactor=u.factor;}return catalog}
function candidates(state,catalog,data){return state.lines.flatMap(l=>{
 if(/изменено вручную/.test(l.source||''))return [];
 const c=catalog.find(c=>c.id===l.catalogId),direct=l.catalogId?.startsWith('procurement:')?data.records.find(p=>'procurement:'+p.id===l.catalogId):null;
 const price=c?.purchaseId?c.price:direct?.eligible?direct.price:null,unit=c?.unit||direct?.unit,source=c?.purchaseSource||(direct&&sourceText(direct)),date=c?.date||direct?.date;
 if(price===null||price===undefined||!materialUnits.sameUnit(unit,l.unit)||!source||date>data.meta.reportDate||l.price===price&&l.source===source)return [];
 return [{id:l.id,name:l.name,unit:l.unit,oldPrice:l.price,newPrice:price,date,source,reason:c?.updateReason||'Цена в единице хранения исходного заказа'}];
 });}
root.PurchaseCore={sourceText,toCatalog,applyUpdates,candidates};if(typeof module!=='undefined')module.exports=root.PurchaseCore;
})(typeof window!=='undefined'?window:globalThis);
