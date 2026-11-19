(function(root){
const round=v=>Math.round((v+Number.EPSILON)*100)/100;
function quoteTotals(draft,calculate){
 const errors=[];if(!Array.isArray(draft.items)||!draft.items.length)errors.push('Добавьте хотя бы одно изделие');
 if(!Number.isFinite(draft.discount)||draft.discount<0||draft.discount>100)errors.push('Скидка должна быть от 0 до 100%');
 const rows=(draft.items||[]).map((item,i)=>{
  if(!Number.isInteger(item.qty)||item.qty<1)errors.push(`Позиция ${i+1}: количество должно быть целым и положительным`);
  const result=calculate(item.calculation,item.qty);
  result.errors.forEach(e=>errors.push(`Позиция ${i+1}: ${e}`));
  if(item.override!==null&&(!Number.isFinite(item.override)||item.override<0))errors.push(`Позиция ${i+1}: некорректная цена`);
  const unit=round((item.override===null?result.unit:item.override)*(1-(draft.discount||0)/100)),total=round(unit*item.qty),vat=item.calculation.vat,tax=round(total-total/(1+vat/100));
  return {...item,result,unit,total,tax,vat};
 });
 return {rows,errors:[...new Set(errors)],total:round(rows.reduce((s,r)=>s+(Number.isFinite(r.total)?r.total:0),0)),tax:round(rows.reduce((s,r)=>s+(Number.isFinite(r.tax)?r.tax:0),0)),preliminary:!!draft.discount||rows.some(r=>r.override!==null)||rows.some(r=>r.result.preliminary!==false||r.result.partial||r.result.warnings.length>0)};
}
function publicDocument(draft,company,calculate){
 const totals=quoteTotals(draft,calculate);if(totals.errors.length)throw Error(totals.errors.join('\n'));
 // Whitelist client fields. Source calculations and internal comments never enter the issued document.
 return {number:String(draft.number),date:String(draft.date),validUntil:String(draft.validUntil),subject:String(draft.subject),client:String(draft.client),contact:String(draft.contact),company:{name:String(company.name||''),details:String(company.details||''),contacts:String(company.contacts||''),signer:String(company.signer||'')},terms:{payment:String(draft.payment),delivery:String(draft.delivery),leadtime:String(draft.leadtime),warranty:String(draft.warranty),comment:String(draft.comment)},items:totals.rows.map((r,i)=>({position:i+1,...(r.calculation.productImage?{productImage:r.calculation.productImage}:{}),name:String(r.name),code:String(r.calculation.code||''),description:String(r.description||''),qty:r.qty,unit:r.unit,total:r.total,vat:r.vat,tax:r.tax,limitations:String(r.calculation.clientNotes||'')})),total:totals.total,tax:totals.tax,preliminary:totals.preliminary};
}
root.BusinessCore={quoteTotals,publicDocument,round};if(typeof module!=='undefined')module.exports=root.BusinessCore;
})(typeof window!=='undefined'?window:globalThis);
