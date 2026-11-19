/* Suggestions use catalog prices; quantities are deliberately left for review. */
const InputAssistant={
 welding:l=>l?.kind==='work'&&/сварочн|сварк/i.test(l.name),
 candidates:(catalog)=>catalog.filter(x=>x.kind==='material'&&/электрод|сварочная проволока/i.test(x.name)),
 exists:(lines,c,group)=>lines.some(l=>l.kind==='material'&&l.group===group&&(l.catalogId===c.id||l.name.trim().toLowerCase()===c.name.trim().toLowerCase()))
};
(function(){
 const previousEdit=editLine;
 editLine=function(id){previousEdit(id);const l=editableLine(id),form=$('lineForm');if(!form)return;
  for(const [key,values] of [['group',[...new Set(['Общее изделие',...state.lines.map(x=>x.group)].filter(Boolean))]],['unit',['шт.','н·ч','ч','чел·ч','м.п.','м²','м³','кг','гиб']]]){
   const input=$('l-'+key);if(!input)continue;input.setAttribute('list','suggest-'+key);input.insertAdjacentHTML('afterend',`<datalist id="suggest-${key}">${values.map(x=>`<option value="${esc(x)}"></option>`).join('')}</datalist>`);
  }
  if(!InputAssistant.welding(l))return;
  const candidates=InputAssistant.candidates(CATALOG);
  const panel=document.createElement('section');panel.className='card';panel.id='welding-suggestions';
  panel.innerHTML=`<h3>Расходники для сварки</h3><p class="small">Выберите по технологии: электроды для ручной дуговой сварки, проволоку для полуавтомата. Добавляйте только расходники сверх стоимости работ. Для AISI-304 и других специальных материалов проверьте совместимость марки.</p>${candidates.map((c,i)=>`<label class="checkrow"><input type="checkbox" id="weld-material-${i}" value="${esc(c.id)}">${esc(c.name)} · ${money(c.price)} / ${esc(MaterialCore.unitLabel(c.unit))}</label>`).join('')}<p class="small">Уже добавленные в эту группу позиции не дублируются. Количество нужно указать после добавления; «шт.» проволоки означает кассету 5 кг. Газ отсутствует в справочнике — добавьте нужный отдельной позицией.</p>`;
  form.insertBefore(panel,form.querySelector('.mini-actions'));
 };
 const previousCommit=commitLine;
 commitLine=function(e,id){const selected=InputAssistant.candidates(CATALOG).filter((c,i)=>$('weld-material-'+i)?.checked);const result=previousCommit(e,id);if(result===false||$('modal').open)return result;const l=editableLine(id);if(!InputAssistant.welding(l)||!selected.length)return result;
  let count=0;for(const c of selected){if(InputAssistant.exists(state.lines,c,l.group))continue;const material=lineFrom(c);Object.assign(material,{group:l.group,scope:l.scope,qty:null,confirmed:false});state.lines.push(material);count++;}
  if(count){persist();render();toast('Добавлено расходников: '+count+'. Укажите их количество в материалах.')}else toast('Выбранные расходники уже есть в этой группе');return result;
 };
})();
