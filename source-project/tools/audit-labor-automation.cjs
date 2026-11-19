// Read-only application audit: write reports, never saved orders or databases.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module'),crypto=require('node:crypto');
const project=path.resolve(__dirname,'..'),workspace=path.resolve(project,'..');process.chdir(project);
const core=require('../dist/production-model-core.js'),catalog=require('../dist/production-catalog.js');
const source=path.join(workspace,'inputs/production-calculator-handoff/CALCULATION_MODEL.json');
const model=JSON.parse(fs.readFileSync(source,'utf8'));
// Reuse the checked browser harness and real script loading, without running its test scenarios.
const harnessPath=path.join(project,'production-ui-check.cjs'),harnessSource=fs.readFileSync(harnessPath,'utf8'),boundary=harnessSource.indexOf('\nrun(`');
assert.ok(boundary>0,'UI harness bootstrap boundary missing');
const harness=new Module(harnessPath,module);harness.filename=harnessPath;harness.paths=module.paths;
harness._compile(harnessSource.slice(0,boundary)+'\nmodule.exports={run};',harnessPath);
const {run}=harness.exports,near=(a,b)=>typeof a==='number'&&Math.abs(a-b)<1e-8;
const state=lines=>({version:1,engineVersion:core.VERSION,name:'Аудит',code:'',client:'',notes:'',type:'МАФ и мебель',scope:'Изготовление',qty:1,overhead:0,transport:0,markup:40,markupBase:'cost',vat:0,lines});
const machineCases=[],posts=[];
for(const support of catalog.operations.filter(d=>d.calculation_method==='operator_support')){
 const post=support.post_id,machines=catalog.operations.filter(d=>d.post_id===post&&d.resource_type==='machine'&&d.calculation_method!=='panel_saw'&&!['inactive','out_of_scope'].includes(d.status));
 assert.ok(machines.length,'No machine fixtures for '+post);
 for(const machine of machines){
  const hoursPerUnit=machine.parameters?.machine_hours_per_unit?.value;assert.ok(hoursPerUnit>0,machine.code+' needs an explicit time norm');
  const quantity=1/hoursPerUnit,minutesKey=post==='P08'?(machine.parameters.operator_minutes_per_machine_hour.value===40?'P08_3d':'P08_flat'):post;
  const minutes=model.cnc_operator_support.minutes_per_machine_hour[minutesKey];assert.ok(minutes>0,'No agreed occupancy for '+machine.code);
  const expectedHours=minutes/60;
  const created=JSON.parse(run(`JSON.stringify((()=>{state=blank();Object.assign(state,{engineVersion:'production-v1',markup:40,vat:0,overhead:0,transport:0});const d=PRODUCTION_CATALOG.operations.find(x=>x.code===${JSON.stringify(machine.code)});if(!productionStore({...state,lines:[ProductionModelCore.makeLine(d,'audit-machine',{quantity:${quantity}})]}))throw Error('Store failed');const result=CostEngine.calculate(state);return {supportRows:state.lines.filter(l=>l.production.definition.calculation_method==='operator_support').length,hours:result.rows.find(l=>l.production.definition.calculation_method==='operator_support')?.personHours??null,errors:result.errors};})())`));
  const linkedInputs={quantity:null,...(minutesKey==='P08_3d'?{mode:'3d'}:{})};
  const linked=core.calculate(state([core.makeLine(machine,'machine',{quantity}),core.makeLine(support,'support',linkedInputs)]));
  const doubled=core.calculate(state([core.makeLine(machine,'machine',{quantity:quantity*2}),core.makeLine(support,'support',linkedInputs)]));
  const row=linked.rows.find(l=>l.id==='support'),doubleRow=doubled.rows.find(l=>l.id==='support');
  machineCases.push({post,code:machine.code,name:machine.name,unit:machine.unit,quantityForOneMachineHour:quantity,expectedOperatorHours:expectedHours,automaticSupportRows:created.supportRows,automaticHours:created.hours,automaticErrors:created.errors,configuredLinkHours:row.personHours??null,configuredLinkErrors:linked.errors,configuredCalculationMatches:near(row.personHours,expectedHours)&&near(doubleRow.personHours,expectedHours*2),mode:linkedInputs.mode||'default'});
 }
 const cases=machineCases.filter(c=>c.post===post);
 posts.push({post,name:catalog.postNames[post],machineVariants:cases.length,autoAddedVariants:cases.filter(c=>c.automaticSupportRows===1).length,configuredCalculationPasses:cases.filter(c=>c.configuredCalculationMatches).length,minutes:post==='P08'?'30 / 40':model.cnc_operator_support.minutes_per_machine_hour[post]});
}
// Mixed flat and 3D milling must use each operation's own occupancy.
const flat=catalog.operations.find(d=>d.code==='Р128.П'),threeD=catalog.operations.find(d=>d.code==='Р128.3D'),foamSupport=catalog.operations.find(d=>d.code==='Р103.P08');
const mixedInputs=[core.makeLine(flat,'flat',{quantity:1/flat.parameters.machine_hours_per_unit.value}),core.makeLine(threeD,'3d',{quantity:1/threeD.parameters.machine_hours_per_unit.value})];
const mixed={expectedHours:(model.cnc_operator_support.minutes_per_machine_hour.P08_flat+model.cnc_operator_support.minutes_per_machine_hour.P08_3d)/60};
for(const mode of ['flat','3d']){const result=core.calculate(state([...mixedInputs,core.makeLine(foamSupport,'support',{quantity:null,mode})]));mixed[mode]={hours:result.rows.find(l=>l.id==='support').personHours,errors:result.errors};}
mixed.matches=near(mixed.flat.hours,mixed.expectedHours)||near(mixed['3d'].hours,mixed.expectedHours);
const comparisonCodes=['Р133','Р129','Р130','Р69','Р67','Р146.6','Р146.18','Р128.3D','Р10','Р17','ФРС.1','ФРС.2','ФРС.3'];
assert.equal(comparisonCodes.length,catalog.comparisons.length,'Every saved market comparison needs an explicit matching operation');
const marketComparisons=catalog.comparisons.map((reference,index)=>{
 const code=comparisonCodes[index];
 const result=JSON.parse(run(`JSON.stringify((()=>{state=blank();Object.assign(state,{engineVersion:'production-v1',markup:40,vat:0,overhead:0,transport:0});const d=PRODUCTION_CATALOG.operations.find(x=>x.code===${JSON.stringify(code)});productionStore({...state,lines:[ProductionModelCore.makeLine(d,'comparison',{quantity:1})]});const r=CostEngine.calculate(state);return {base:r.preMarkupBase,quote:r.total,plannedCost:r.plannedCost,operatorHours:r.rows.find(l=>l.production.autoSupport)?.personHours??null,operatorBase:r.rows.find(l=>l.production.autoSupport)?.amount??null,errors:r.errors};})())`));
 assert.equal(result.errors.length,0,code+' market comparison must include valid labor');
 assert.ok(near(result.base,reference.basis_before_final_markup),code+' full station base must match the saved analysis');
 return {code,work:reference.work,unit:reference.unit,market_ref:reference.market_ref,publishedBenchmark:reference.published_benchmark_rub,sourceFullBase:reference.basis_before_final_markup,...result,terms:reference.terms};
});
const laborCases=[];
for(const d of catalog.operations.filter(d=>d.calculation_method==='crew_cycle'||d.calculation_method==='unique_program_prep'||d.calculation_method==='direct_unit_rate'&&d.parameters?.person_hours_per_unit?.value>0)){
 const quantity=7,excluded=['inactive','out_of_scope'].includes(d.status)||[37,139,175].includes(d.source_work_id);
 if(excluded){assert.throws(()=>core.calculateLine(d,{quantity}),/вне активной сметы/);laborCases.push({code:d.code,method:d.calculation_method,status:'excluded_as_agreed'});continue;}
 const expected=d.calculation_method==='crew_cycle'?quantity*d.cycle.workers*d.cycle.minutes_per_unit/60:d.calculation_method==='unique_program_prep'?quantity/model.program_preparation['work_'+d.source_work_id].productivity_m_per_hour:quantity*d.parameters.person_hours_per_unit.value;
 const actual=core.calculateLine(d,{quantity});laborCases.push({code:d.code,name:d.name,method:d.calculation_method,unit:d.unit,quantity,expectedHours:expected,actualHours:actual.personHours,status:near(actual.personHours,expected)?'matches':'mismatch'});
}
const programCases=[112,113].map(id=>{const d=catalog.operations.find(d=>d.source_work_id===id),s=state([core.makeLine(d,'program',{quantity:240})]);s.qty=10;s.lines[0].scope='unit';const result=core.calculate(s);return {code:d.code,uniqueLength:240,batchQuantity:10,expectedHours:240/model.program_preparation['work_'+id].productivity_m_per_hour,actualHours:result.rows[0].personHours};});
const sawCard={rows:[{thickness_mm:6,length_m:10,strokes:2,sheets:1,measured_cycle_hours:.5}],setups:0,helper_hours:0,map_hours:0};
const sawResult=core.panelSaw(sawCard,catalog.panelSaw),saw={expectedOperatorHours:.5+catalog.panelSaw.sheet_minutes/60,actualOperatorHours:sawResult.operatorHours,hasSeparateOperatorComponent:sawResult.components.some(c=>c.code==='ФРС.ОП'),requiresAdditional103:sawResult.components.some(c=>c.code==='Р103')};
const panelSawStandalone=catalog.panelSaw.bands.map(band=>{
 const d=catalog.operations.find(d=>d.code===band.id),h=1/band.output_m_per_hour;
 const created=JSON.parse(run(`JSON.stringify((()=>{state=blank();Object.assign(state,{engineVersion:'production-v1',markup:40,vat:0,overhead:0,transport:0});const d=PRODUCTION_CATALOG.operations.find(x=>x.code===${JSON.stringify(d.code)});productionStore({...state,lines:[ProductionModelCore.makeLine(d,'saw',{quantity:1})]});return {supportRows:state.lines.filter(l=>l.production.definition.code==='ФРС.ОП').length,base:CostEngine.calculate(state).preMarkupBase};})())`));
 const fullTariff=h*(catalog.panelSaw.machine_rate+catalog.panelSaw.operator_rate)+catalog.panelSaw.blade_per_m;
 assert.ok(near(fullTariff,band.cut_total_before_setup_and_markup_rub_per_m));
 return {code:d.code,outputMetersPerHour:band.output_m_per_hour,machineAndBladesBase:d.pricing.current_unit_price,operatorBasePerMeter:h*catalog.panelSaw.operator_rate,fullCutBase:fullTariff,fullResourceCostPerMeter:h*(catalog.panelSaw.machine_rate+catalog.panelSaw.operator_cost)+catalog.panelSaw.blade_per_m,standaloneAutoSupportRows:created.supportRows,standaloneBase:created.base};
});
assert.deepEqual(panelSawStandalone.map(c=>Math.round(c.fullCutBase*100)/100),[29.32,34.4,42.29],'User screenshot must match the complete panel-saw tariff');
const manualIds=[81,94,108,97],manualExceptions=manualIds.map(id=>{const d=catalog.operations.find(d=>d.source_work_id===id);assert.ok(d,'Missing manual exception '+id);return {source_work_id:id,code:d.code,name:d.name,unit:d.unit,enteredQuantityIsHours:d.parameters?.person_hours_per_unit?.value===1};});
const summary={posts:posts.length,machineVariants:machineCases.length,autoAddedPosts:posts.filter(p=>p.autoAddedVariants===p.machineVariants).length,missingAutoAddPosts:posts.filter(p=>p.autoAddedVariants===0).map(p=>p.post),configuredMachineCalculationMismatches:machineCases.filter(c=>!c.configuredCalculationMatches).map(c=>c.code),laborVariants: laborCases.length,laborCalculationMismatches:laborCases.filter(c=>c.status==='mismatch').map(c=>c.code),mixedP08Matches:mixed.matches};
assert.equal(posts.length,Object.keys(model.cnc_operator_support.minutes_per_machine_hour).length-1,'Audit must cover every agreed post and both P08 modes');
assert.equal(new Set(machineCases.map(c=>c.code)).size,machineCases.length);
assert.ok(machineCases.some(c=>c.automaticSupportRows===1),'Positive control: actual UI must be capable of adding support');
assert.ok(machineCases.every(c=>c.automaticSupportRows===0||c.automaticSupportRows===1),'Duplicate companion rows');
assert.ok(machineCases.every(c=>c.automaticSupportRows===1&&near(c.automaticHours,c.expectedOperatorHours)&&c.automaticErrors.length===0),'Every agreed station must automatically include the correct operator time');
assert.ok(panelSawStandalone.every(c=>c.standaloneAutoSupportRows===1&&near(c.standaloneBase,c.fullCutBase)),'Standalone panel-saw rates must include operator labor exactly once');
assert.ok(mixed.matches,'Mixed machining modes must keep their own occupancy norms');
assert.ok(programCases.every(c=>near(c.actualHours,c.expectedHours)));
assert.ok(near(saw.actualOperatorHours,saw.expectedOperatorHours)&&saw.hasSeparateOperatorComponent&&!saw.requiresAdditional103);
assert.ok(manualExceptions.every(c=>c.enteredQuantityIsHours));
const report={source:'inputs/production-calculator-handoff/CALCULATION_MODEL.json',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(source)).digest('hex'),summary,posts,machineCases,mixedP08:mixed,laborCases,programCases,panelSaw:saw,panelSawStandalone,marketComparisons,manualExceptions};
const target=path.join(workspace,'docs/research/2026-11-20-labor-automation-audit');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target+'.json',JSON.stringify(report,null,2)+'\n');
const md=[
'# Аудит автоматического расчёта человеко-часов — 20.11.2026',
'',
'Проверена действующая реализация: настоящий productionStore с браузерными модулями в тестовом окружении и расчётное ядро. После замечания пользователя исправлены только станочные позиции и связанное сопровождение: 11 постов ЧПУ, отдельные строки форматника, смешанные режимы. Ручные работы, монтаж и УП не изменялись. Скрипт проверки не пишет рабочие заказы и базы.',
'',
'## Согласованное сопровождение станков',
'',
'Основание: [HANDOFF OP-002](../../inputs/production-calculator-handoff/HANDOFF.json), [cnc_operator_support](../../inputs/production-calculator-handoff/CALCULATION_MODEL.json), [прежнее уточнение по метрам и листам](../HANDOFF_2026-11-18_POSTS.md). На каждом посту человеко-часы считаются из времени обработки с нормой занятости. Наличие формулы в ядре отдельно от появления трудовой строки при добавлении обработки.',
'',
'| Пост | Название | Мин/маш·ч | Проверено вариантов | Автодобавление | Расчёт при явно добавленном сопровождении |',
'|---|---|---:|---:|---|---|',
...posts.map(p=>`| ${p.post} | ${p.name} | ${p.minutes} | ${p.machineVariants} | ${p.autoAddedVariants}/${p.machineVariants} | ${p.configuredCalculationPasses}/${p.machineVariants} |`),
'',
`Покрыто ${summary.posts} постов и ${summary.machineVariants} станочных вариантов. Автодобавление полностью работает на ${summary.autoAddedPosts} постах. Отсутствует на: ${summary.missingAutoAddPosts.join(', ')||'нет'}. До исправления автоматически работал только P07, остальные 10 постов оставляли труд вне сметы. Теперь физический объём переводится в машино-часы, затем в занятость исполнителя и его стоимость.`,
'',
'## Смешанная плоская и 3D-фрезеровка P08',
'',
`Контроль: 213 м плоской резки + 0,75 м² 3D, по одному машино-часу каждого режима. Требуется 30/60 + 40/60 = ${mixed.expectedHours} чел·ч. Связанное сопровождение даёт ${mixed.flat.hours} при поле режима «Плоская» и ${mixed['3d'].hours} при «3D»: использована собственная занятость каждой станочной строки. До исправления получалось 1 либо 4/3 чел·ч. Поле режима сохраняет смысл для отдельно введённых машино-часов; ручные человеко-часы и интервалы сохраняют приоритет.`,
'',
'## Остальные трудовые расчёты',
'',
`Проверено ${laborCases.length} вариантов с трудовой нормой: ${laborCases.filter(c=>c.method==='crew_cycle').length} циклов бригады, ${laborCases.filter(c=>c.method==='direct_unit_rate').length} прямых ресурсных норм и ${programCases.length} специальных подготовок УП. Числовых расхождений в расчёте часов этих выбранных строк: ${summary.laborCalculationMismatches.length}. Исключённые исходные работы проверены как недоступные. Самостоятельное создание всех этих строк из материалов/геометрии не объявлялось реализованным: для них требуется выбрать операцию и задать её физический объём.`,
'',
`УП Р112/Р113: уникальная длина 240 м при тираже 10 даёт ${programCases.map(c=>c.code+' = '+c.actualHours+' ч').join('; ')}. Тираж не увеличивает часы.`,
'',
`Карта P43: измеренный цикл 0,5 ч + подача листа = ${saw.actualOperatorHours} чел·ч; ФРС.ОП включён отдельно в состав карты. Второй Р103 не требуется. Помощник и новая карта остаются явным вводом часов, оснований автоматически придумывать их занятость нет.`,
'',
'## Форматник: подтверждённая таблица пользователя',
'',
'Пользователь подтвердил, что таблица 29,32 / 34,40 / 42,29 ₽/м относится к форматнику. Она точно совпадает с Форматник!L24:L26 в переданной калькуляции. Это тарифная база станка + пил + полного труда станочника до наладки и наценки, а не ресурсная себестоимость и не рыночное предложение.',
'',
'| Диапазон | м/ч | Станок и пилы, ₽/м | Станочник, ₽/м | Полный базовый раскрой, ₽/м | Автодобавление ФРС.ОП при отдельной строке |',
'|---|---:|---:|---:|---:|---|',
...panelSawStandalone.map((c,i)=>`| ${['3–6 мм','свыше 6–18 мм','свыше 18–30 мм'][i]} | ${c.outputMetersPerHour.toFixed(1)} | ${c.machineAndBladesBase.toFixed(2)} | ${c.operatorBasePerMeter.toFixed(2)} | ${c.fullCutBase.toFixed(2)} | ${c.standaloneAutoSupportRows?'есть':'нет'} |`),
'',
'При выборе отдельных ФРС.1/ФРС.2/ФРС.3 без карты автоматически добавляется ФРС.ОП: полный труд по машино-часам реза и выбранной наладки/подачи. Полная карта уже включает труд и второй оператор к ней не добавляется. Ставки 4,35/4,73/5,33 остаются только компонентами станка/пил; вместе с трудом полная база составляет именно 29,32/34,40/42,29. Замена станочного компонента полной ценой с повторным трудом не применяется.',
'',
'## Полные станочные цены и сохранённый конъюнктурный анализ',
'',
'Проверены все 13 существующих сравнений source.price_comparisons: полная внутренняя база станок + исполнитель после автоматического добавления совпала с сохранённой базой анализа. Сравнивать одну станочную составляющую с полной услугой неправильно. Подготовка, материалы, минимальный заказ и налоги внешних предложений могут отличаться; опубликованный ориентир не назначался новой ставкой автоматически.',
'',
'| Позиция | Единица | Полная база до наценки | Продажа ×1,40 | Ресурсная себестоимость | Рыночный ориентир |',
'|---|---|---:|---:|---:|---:|',
...marketComparisons.map(c=>`| ${c.code}: ${c.work} | ${c.unit} | ${c.base.toFixed(2)} | ${c.quote.toFixed(2)} | ${c.plannedCost===null?'неизвестна':c.plannedCost.toFixed(2)} | ${c.publishedBenchmark===null?'нет сопоставимой единицы':c.publishedBenchmark+' ('+c.market_ref+')'} |`),
'',
'Ручные исключения из предыдущего согласования: '+manualExceptions.map(c=>`${c.code} (${c.name})`).join('; ')+'. Их количество уже является часами; физический норматив для автоматического пересчёта не согласован.',
'',
'## Статус и воспроизведение',
'',
'- Пробелы автодобавления на 10 постах, смешанный режим P08 и отдельный форматник исправлены; текущие результаты приведены выше. Ограничение пользователя: изменения только станочных позиций.',
'- Старая запись 18.11 про оператора по закупленным листам (103/P11) относится к предыдущему согласованию. Новая переданная модель 19.11 явно задаёт сопровождение по машино-часам на 11 постах. Не переносить старую норму 10 листов/ч на новые посты без отдельного решения.',
'- Ручные часы оператора имеют приоритет, очистка возвращает автоматический расчёт; существующие архивы сохраняют снимки норм.',
'- Проверка: `node source-project/tools/audit-labor-automation.cjs`. Полные измерения всех вариантов — [JSON](2026-11-20-labor-automation-audit.json).',
'- Код: [добавление сопровождения](../../source-project/dist/production-model-ui.js), [расчёт и контроль дублирования](../../source-project/dist/production-model-core.js).',
''
];fs.writeFileSync(target+'.md',md.join('\n'));
console.log('Labor automation audit verified: '+JSON.stringify(summary));
