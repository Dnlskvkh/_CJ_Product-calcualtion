(function(root){
const TYPES={laser:{name:'Лазерная резка',measure:'Длина реза на изделие, м',rate:'Стоимость реза, ₽/м'},bending:{name:'Гибка',measure:'Количество гибов на изделие',rate:'Стоимость одного гиба, ₽'},waterjet:{name:'Гидроабразивная резка',measure:'Длина реза на изделие, м',rate:'Стоимость реза, ₽/м'},milling:{name:'Фрезерование',measure:'Время обработки изделия, мин',rate:'Стоимость обработки, ₽/мин'}};
function cutting(o,n,errors){const pierces=n('pierces');if(!Number.isInteger(pierces))errors.push('Количество врезок должно быть целым');return n('measure')*n('rate')+(pierces>0?pierces*n('pierceRate'):0)}
const STRATEGIES={laser:cutting,waterjet:cutting,bending(o,n,errors){const measure=n('measure');if(!Number.isInteger(measure))errors.push('Количество гибов должно быть целым');return measure*n('rate')},milling(o,n){return n('measure')*n('rate')}};
function calculate(o,q=1){
 const errors=[];try{o=(root.DomainSchema||(typeof require==='function'?require('./domain-schema.js'):null)).operation(o)}catch(e){return {unit:0,setup:0,raw:0,total:0,minimumExtra:0,errors:[e.message]}}const n=k=>{const v=o[k];if(typeof v!=='number'||!Number.isFinite(v)||v<0){errors.push('Заполните неотрицательное число: '+k);return 0}return v};
 if(!TYPES[o.type])errors.push('Неизвестная технология');
 if(!['manual','tariff','machine'].includes(o.mode))errors.push('Неизвестный способ расчёта');
 if(!Number.isInteger(q)||q<1)errors.push('Некорректный тираж');
 const setup=n('setup'),minimum=n('minimum');let unit=0;
 if(o.mode==='manual')unit=n('manual');
 if(o.mode==='tariff')unit=STRATEGIES[o.type](o,n,errors);
 if(o.mode==='machine')unit=n('minutes')*(n('hourRate')/60+n('consumables'));
 const raw=setup+unit*q,total=Math.max(raw,minimum);
 if(!Number.isFinite(total)){errors.push('Стоимость операции слишком велика')}
 return {unit,setup,raw,total,minimumExtra:total-raw,errors};
}
root.OperationsCore={TYPES,calculate};if(typeof module!=='undefined')module.exports=root.OperationsCore;
})(typeof window!=='undefined'?window:globalThis);
