/* Navigation only: existing screens, formulas and saved data remain authoritative. */
var workflowPhases=[{label:'Заказ',pages:[0]},{label:'Материалы и детали',pages:[1]},{label:'Изготовление',pages:[2,20]},{label:'Монтаж',pages:[19]},{label:'Проверка и цена',pages:[3,4]}];
function workflowPhase(n){return workflowPhases.findIndex(x=>x.pages.includes(n));}
steps=function(){return '<div class="steps" aria-label="Этапы расчёта">'+workflowPhases.map((x,i)=>'<button '+(x.pages.includes(page)?'class="active" aria-current="step" ':'')+'onclick="go('+x.pages[0]+')"><b>'+(i+1)+'</b>'+x.label+'</button>').join('')+'</div>';};
nextbar=function(){const order=[0,1,2,19,3,4],index=order.indexOf(page===20?2:page);if(index<0)return '';return '<div class="nextbar"><button onclick="go('+order[Math.max(0,index-1)]+')" '+(index===0?'disabled':'')+'>← Назад</button><span class="small">Этап '+(workflowPhase(page)+1)+' из 5</span><button class="primary" onclick="go('+order[Math.min(5,index+1)]+')">'+(page===3?'Проверить результат':'Продолжить →')+'</button></div>';};
(function(){
 const previous=render;
 render=function(){previous();if(!document.querySelector)return;const main=$('app'),phase=workflowPhase(page);if(phase<0)return;
  if(!main.querySelector('.steps'))main.querySelector('.page-title')?.insertAdjacentHTML('afterend',steps());
  if([19,20].includes(page)&&!main.querySelector('.nextbar'))main.insertAdjacentHTML('beforeend',nextbar());
  const views=[2,20].includes(page)?[[2,'Список работ'],[20,'Схема процессов']]:[3,4].includes(page)?[[3,'Параметры цены'],[4,'Проверка и результат']]:[];
  if(views.length)main.querySelector('.steps')?.insertAdjacentHTML('afterend','<div class="toolbar" role="group" aria-label="Вид этапа">'+views.map(([id,label])=>'<button '+(page===id?'class="primary" aria-current="page" ':'')+'onclick="go('+id+')">'+label+'</button>').join('')+'</div>');
  const target=page===20?2:page===3?4:page;
  if(target!==page){const button=$('nav').querySelector('button[onclick="go('+target+')"]');button?.classList.add('active');button?.setAttribute('aria-current','page');if(button?.closest('details'))button.closest('details').open=true;}
 };
 render();
})();
