const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const file='./dist/catalog-normalization-core.js';
assert.ok(fs.existsSync(file),'Missing catalog normalization implementation');
const core=require(file);
for(const [input,expected] of [
 ['  Фанера\u00a0хвойная 21мм 2440х1220 ФСФ сорт 3/3,НШ  ','Фанера хвойная 21 мм 2440 × 1220 ФСФ сорт 3/3,НШ'],
 ['Саморез 6.3 x 51','Саморез 6,3 × 51'],
 ['Болт М6х40 A2 DIN 933','Болт М6 × 40 A2 DIN 933'],
 ['Лист 120 X 80 * 2,5 мм','Лист 120 × 80 × 2,5 мм'],
 ['Краска Sikkens 2.5л','Краска Sikkens 2,5 л'],
 ['Покрытие 1м2','Покрытие 1 м²'],
 ['Труба нерж. зеркальная ф108х2х6000','Труба нерж. зеркальная ф108 × 2 × 6000'],
 ['Фреза N2ZX6.25, сталь 09Г2С, RAL 9005','Фреза N2ZX6.25, сталь 09Г2С, RAL 9005']
]){assert.equal(core.name(input),expected);assert.equal(core.name(core.name(input)),expected);}
const matches=(text,q)=>core.matcher(q)(core.search(text));
for(const q of ['ТРУБА 80х60х2,5','труба 80 x 60 x 2.5','труба 80×60×2,5','труба 80 60 2.5','nhe,f 80x60x2.5'])assert.ok(matches('Труба 80 × 60 × 2,5 мм',q),q);
assert.ok(matches('Крепёж м²','крепеж м2'));
assert.ok(matches('Плёнка 10мм','пленка 10 мм'));
assert.ok(matches('Покрытие м³','покрытие m3'));
for(const q of ['мп','мп.','м.п.','пог. м'])assert.ok(matches('Труба м.п.',q));
assert.ok(matches('Лист м²','м2'));
assert.ok(matches('Грунт кг','кг.'));
assert.ok(matches('Гравировка 2 см²','2см2'));
assert.ok(matches('Sikkens','ышллуты'));
assert.ok(matches('Sikkens','sikkens'));
for(const prefix of ['ф','Ф','Ø','⌀'])assert.ok(matches(`Труба ${prefix}108х2х6000`,'108 x 2 x 6000'),prefix+' diameter');
assert.ok(matches('Анкер клиновой М6 × 40','M6x40'));
for(const [text,q] of [['Труба 180х60','80х60'],['Труба 80х60х2,5','80х60х2'],['Труба 80х60','60х80'],['Сталь 09Г2С','09Г2'],['Фанера 21 мм','2 мм'],['Фанера 21 мм сорт 2/4','2мм'],['Сталь A2','A4']])assert.equal(matches(text,q),false,`${text} must not match ${q}`);
assert.ok(matches('Любое название',''));
console.log('Catalog normalization: names, idempotence, units, layout, exact numeric and grade boundaries passed.');
const catalog={};catalog.window=catalog;vm.createContext(catalog);
for(const f of ['catalog.js','metal-catalog.js'])vm.runInContext(fs.readFileSync('dist/'+f,'utf8'),catalog,{filename:f});
for(const row of catalog.CATALOG.filter(x=>x.kind==='material'))assert.equal(row.name,core.name(row.name),row.id+' is not normalized');
const baseline=require('./tests/fixtures/catalog-normalization-baseline.json');let changed=0;
const restored=catalog.CATALOG.map(row=>{
 const next={...row};if(Object.hasOwn(row,'sourceName')){changed++;assert.equal(row.kind,'material');assert.equal(row.name,core.name(row.sourceName));next.name=row.sourceName;delete next.sourceName;}return next;
});
assert.equal(restored.length,baseline.records);assert.equal(changed,baseline.changed);
assert.equal(require('node:crypto').createHash('sha256').update(JSON.stringify(restored)).digest('hex'),baseline.sha256,'Catalog fields changed beyond name/sourceName');
console.log(`Catalog data: ${changed} names normalized; all ${catalog.CATALOG.length} records and every other field unchanged.`);
