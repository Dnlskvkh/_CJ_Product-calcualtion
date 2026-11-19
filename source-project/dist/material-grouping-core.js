(function(root){
const sections=[['metal','Металл'],['wood','Древесина и фанера'],['plastics','Пластики и композиты'],['hardware','Крепёж и фурнитура'],['components','Готовые комплектующие'],['coatings','ЛКМ и химия'],['building','Строительные материалы и покрытия'],['supplies','Производственные расходники и упаковка'],['other','Без группы']].map(([id,label])=>({id,label}));
const definitions={
 metal:{profile_pipe:'Профильные трубы',pipe:'Круглые трубы',sheet:'Листовой металл',profile_sheet:'Профнастил',structural:'Уголки, швеллеры и балки',bar:'Круг, полоса и квадрат',rebar:'Арматура',mesh:'Сетки',wire:'Проволока'},
 wood:{board:'Доски',beam:'Брус и бруски',plywood:'Фанера',planken:'Планкен',log:'Брёвна'},
 plastics:{hdpe:'ПНД / HDPE',polycarbonate:'Поликарбонат',fluoroplastic:'Фторопласт',composite:'Композитные панели',other:'Другие пластики'},
 hardware:{bolt:'Болты',screw:'Винты',self_tapping:'Саморезы',nut:'Гайки',washer:'Шайбы и гроверы',anchor:'Анкеры и шпильки',connector:'Хомуты и соединители',furniture:'Петли, ручки и фурнитура',rigging:'Цепи и такелаж',cap:'Заглушки и крышки',dowel:'Шканты',kit:'Комплекты крепежа'},
 components:{slide:'Горки',swing:'Качели, сиденья и подвесы',climbing:'Кольца и зацепы',fitness:'Элементы тренажёров',lighting:'Освещение и электрика',system:'Готовые системы и узлы'},
 coatings:{wood:'Покрытия для дерева',metal:'Покрытия для металла',primer:'Грунты и антисептики',solvent:'Растворители и отвердители',sealant:'Герметики и клеи',preparation:'Подготовка поверхности',other:'Другие покрытия и химия'},
 building:{concrete:'Бетон и растворы',brick:'Кирпич',bulk:'Сыпучие материалы',asphalt:'Асфальтобетон',paving:'Бордюры и плитка',rubber:'Резиновые покрытия',insulation:'Геотекстиль и изоляция',sheet:'Строительные листовые материалы'},
 supplies:{abrasive:'Абразивы и режущий инструмент',welding:'Сварочные расходники',blasting:'Дробь',packaging:'Упаковка',ppe:'Средства защиты',other:'Другие расходники'},
 other:{unassigned:'Без группы'}
};
const types=sections.flatMap(s=>Object.entries(definitions[s.id]).map(([key,label])=>({id:s.id+'.'+key,label,sectionId:s.id,sectionLabel:s.label}))),byId=new Map(types.map(t=>[t.id,t]));
const normal=s=>String(s||'').toLowerCase().replaceAll('ё','е').replace(/\s+/g,' ').trim();
const categoryTypes=new Map();
function bind(id,names){for(const name of names.split('|'))categoryTypes.set(normal(name),id)}
bind('wood.board','Доска|Доска палубная');bind('wood.beam','Брус|Брусок|Брусок строганный');bind('wood.plywood','Фанера');bind('wood.planken','Планкен');bind('wood.log','Бревно');
bind('hardware.bolt','Болт');bind('hardware.screw','Винт|Петля-Винт');bind('hardware.self_tapping','Саморез');bind('hardware.nut','Гайка');bind('hardware.washer','Шайба|Гровер');bind('hardware.anchor','Анкер|Шпилька');bind('hardware.dowel','Шкант');bind('hardware.rigging','Цепь|Трос|Карабин|Скоба|Рым-гайка');bind('hardware.connector','Хомуты|Трубопроводная арматура из нержавеющей стали');bind('hardware.furniture','Петли');bind('hardware.cap','Колпачки и крышки для столбов');
bind('components.slide','Горки');bind('components.swing','Качели-гнездо|Сиденье для качелей и подвесы|Крепеж для качелей');bind('components.climbing','Гимнастические кольца|Зацепы и ручки');bind('components.fitness','Тренажеры и уголки');
bind('coatings.wood','Лакокрасочная продукция (Дерево)');bind('coatings.metal','Лакокрасочная продукция (Металл)');bind('coatings.primer','Антисептик');bind('coatings.solvent','Растворитель|Уайт-спирит|Отвердитель');bind('coatings.sealant','Герметик');bind('coatings.other','Лакокрасочная продукция|Битум|Компаунд');
bind('building.concrete','Бетон');bind('building.bulk','Насыпные материалы');bind('building.asphalt','Асфальтобетонная смесь');bind('building.rubber','Резиновое покрытие');bind('building.paving','Тротуарная плитка');
const nameRules=[
 ['plastics.hdpe',/^(?:листовой полиэтилен|пнд\s*\d|hdpe\s*\d)/],['plastics.polycarbonate',/^(?:профилированный )?поликарбонат/],['plastics.fluoroplastic',/^фторопласт/],['plastics.composite',/^(?:алюкобонд|алюминиев.*композит|дпк(?:\s|$))/],
 ['coatings.wood',/^краска для дерева/],['coatings.metal',/^краска для металла/],['coatings.primer',/^(?:грунт|антисептик|пропитка|гидрофобизатор)/],['coatings.sealant',/^(?:.*полиуретановый герметик|герметик|клей(?:\s|$))/],['coatings.preparation',/^(?:обезжириватель|ортофосфорн|лимонная кислота)/],['coatings.solvent',/^(?:растворитель|уайт-спирит|отвердитель)/],
 ['supplies.welding',/^(?:сварочная проволока|проволока сварочн|электрод)/],['supplies.blasting',/^(?:дробь|стеклянная дробь)/],['supplies.abrasive',/^(?:фреза|губка абразивная|круг (?:абразивный|лепестковый|отрезной)|диск(?:овая|овые)? (?:отрезной|лепестковый|алмазный|щетка)|гибкий алмазный|абразивные диски|набор малярного инструмента)/],['supplies.packaging',/^(?:стретч|пленка полиэтиленовая|картон для транспортировки)/],['supplies.ppe',/^средства индивидуальной защиты/],
 ['hardware.kit',/^комплект крепежа/],['hardware.rigging',/^(?:цепь|трос|шнур яхтенный)(?:\s|$)/],['hardware.cap',/^(?:заглушка|колпачок|наружная .*заглушка)/],
 ['metal.profile_sheet',/^(?:профнастил|профлист|кровельный профилированный лист)/],['metal.profile_pipe',/^(?:труб[аы].*(?:профильн|квадратн|прямоугольн)|профильн.*труб)/],['metal.sheet',/^(?:лист\s*(?:г\s*\/\s*к|х\s*\/\s*к|сталь|металл|регист|рифлен|нержав|09г2с)|прокат листовой)/],['metal.wire',/^(?:проволока вязальная|вязальная проволока)/],
 ['wood.board',/^(?:(?:палубная|террасная) доска|доска(?:\s|$))/],['wood.beam',/^брус(?:ок)?(?:\s|$)/],['wood.plywood',/^фанера/],['wood.planken',/^планкен/],['wood.log',/^бревно/],
 ['building.brick',/^кирпич/],['building.concrete',/^(?:цементно-песчаная смесь|плита бетонная|бетон(?:\s|$))/],['building.paving',/^(?:бордюр|тротуарная плитка)/],['building.insulation',/^(?:геотекстиль|изопинк|демпферная лента)/],['building.sheet',/^(?:шифер|стекло под)/],['components.system',/^(?:маркиза|водосточная система|бочка стальная)/]
];
const materialHints={'фурнитура':'hardware.furniture','электроника':'components.lighting','освещение':'components.lighting','паронит':'building.insulation','резина':'building.insulation','битум':'coatings.other','цинк':'coatings.other'};
function validType(value){return value===undefined||value===''||typeof value==='string'&&byId.has(value)}
function resolve(line,catalog=[]){
 if(line.kind!=='material')return null;
 if(line.materialType)return byId.get(line.materialType)||byId.get('other.unassigned');
 const c=line.catalogId?catalog.find(c=>c.id===line.catalogId):line,category=normal(c?.category),name=normal(line.name),hint=normal(c?.details?.['Материал']);
 // This source category mixes raw sheets with purchased connectors.
 if(category==='hdpe и соединители')return byId.get(/^листовой полиэтилен/.test(hint)?'plastics.hdpe':'hardware.connector');
 for(const [id,pattern]of nameRules)if(pattern.test(name))return byId.get(id);
 let id=categoryTypes.get(category)||materialHints[hint];
 if(!id&&c?.sheet==='Металлопрокат'){
  if(/труб/.test(category))id=/профильн/.test(category)?'metal.profile_pipe':'metal.pipe';
  else if(/пвл|сетк/.test(category))id='metal.mesh';
  else if(/лист/.test(category))id='metal.sheet';
  else if(/проволок/.test(category))id='metal.wire';
  else if(/арматур/.test(category))id='metal.rebar';
  else if(/балк|двутавр|швеллер|уголок/.test(category))id='metal.structural';
  else if(/круг|полос|квадрат|шестигран/.test(category))id='metal.bar';
 }
 return byId.get(id)||byId.get('other.unassigned');
}
function group(rows,catalog=[]){
 const buckets=new Map();
 for(const row of rows){const t=resolve(row,catalog);if(!t)continue;if(!buckets.has(t.id))buckets.set(t.id,[]);buckets.get(t.id).push(row)}
 const summarize=rows=>({count:rows.length,knownCost:rows.reduce((s,r)=>s+(Number.isFinite(r.amount)?r.amount:0),0),unknownCount:rows.filter(r=>!Number.isFinite(r.amount)).length});
 return sections.flatMap(s=>{const children=types.filter(t=>t.sectionId===s.id&&buckets.has(t.id)).map(t=>({...t,rows:buckets.get(t.id),...summarize(buckets.get(t.id))}));return children.length?[{...s,types:children,...summarize(children.flatMap(t=>t.rows))}]:[]});
}
root.MaterialGroupingCore={sections,types,resolve,group,validType};if(typeof module!=='undefined')module.exports=root.MaterialGroupingCore;
})(typeof window!=='undefined'?window:globalThis);
