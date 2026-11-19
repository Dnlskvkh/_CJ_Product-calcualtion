/* Reproducible fictional product scenarios. All prices, dimensions and norms
 * below are synthetic test inputs, not production recommendations or quotes. */
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');
require(path.join(root, 'dist/operations-core.js'));
const graph = require(path.join(root, 'dist/process-graph-core.js'));
const engine = require(path.join(root, 'dist/engine.js'));
const specCore = require(path.join(root, 'dist/model-spec-core.js'));
const schema = require(path.join(root, 'dist/domain-schema.js'));
let assertions = 0;
const eq = (actual, expected, label) => { assertions++; assert.deepEqual(actual, expected, label); };
const near = (actual, expected, label) => { assertions++; assert(Math.abs(actual - expected) < 1e-8, `${label}: ${actual} != ${expected}`); };
const ok = (actual, label) => { assertions++; assert(actual, label); };
const throws = (fn, pattern, label) => { assertions++; assert.throws(fn, pattern, label); };
const results = [];
function scenario(name, fn) {
  const before = assertions;
  try { fn(); results.push({ name, assertions: assertions - before, result: 'PASS' }); }
  catch (error) { results.push({ name, assertions: assertions - before, result: 'FAIL', error: error.message }); }
}
const copy = value => structuredClone(value);
const line = (key, kind, name, unit, qty, price, extra = {}) => ({
  id: key, processKey: key, kind, name, unit, qty, price, reserve: 0,
  pack: 1, scope: 'unit', allocation: 'share', group: key, confirmed: true,
  date: '2026-11-05', source: 'SYNTHETIC TEST ONLY', mass: null, ...extra
});
const bind = (from, metric, unit, factor = 1, mode = 'direct') => ({
  from, metric, unit, factor, mode, note: 'SYNTHETIC TEST norm/geometry only'
});
const calculation = (name, qty, lines) => ({
  version: 3, engineVersion: 'cost-v1', name, code: '', client: '', notes: '',
  type: 'МАФ', scope: 'Изготовление', qty, overhead: 0, transport: 0,
  markup: 0, vat: 0, lines
});
const shelf = calculation('Искусственный фанерный стеллаж', 4, [
  line('ply', 'material', 'Фанера для стеллажа', 'лист', 0.5, 2000, {
    allocation: 'whole', reserve: 20,
    processMetrics: { unit: 'лист', area: 6, mass: 30, source: 'SYNTHETIC TEST sheet' }
  }),
  line('cut', 'work', 'Раскрой фанеры', 'м.п.', 999, 40, {
    processBinding: { ...bind('ply', 'length', 'м.п.'), mode: 'geometry', geometryBasis: 'parts', amount: 1.6, parts: 5 },
    processOutput: { basis: 'unit', area: 2.5, count: 5, source: 'SYNTHETIC TEST all finished surfaces' }
  }),
  line('sand', 'work', 'Шлифовка стеллажа', 'м²', 999, 100, { processBinding: bind('cut', 'area', 'м²') }),
  line('finish', 'material', 'Состав для покрытия', 'л', 999, 500, {
    allocation: 'whole', pack: 3, processBinding: bind('sand', 'area', 'л', 0.2, 'norm')
  })
]);
Object.assign(shelf, { overhead: 10, transport: 5, markup: 25, vat: 20 });

scenario('Стеллаж: закупка с запасом, контуры, готовая площадь, покрытие, цена', () => {
  schema.calculation(shelf);
  const before = JSON.stringify(shelf), r = engine.calculate(shelf);
  eq(r.errors, [], 'Valid product must calculate');
  eq(r.rows.map(l => l.qty), [0.5, 8, 2.5, 0.5]);
  eq(r.rows.map(l => l.purchase), [3, 32, 10, 3]);
  eq(r.M, 7500); eq(r.W, 2280); eq(r.overhead, 228); eq(r.transport, 375);
  eq(r.C, 10383); eq(r.P, 2595.75); eq(r.total, 15574.5);
  eq(JSON.stringify(shelf), before, 'Calculation must not mutate the source');
});

scenario('Стеллаж: рост тиража 4 → 8 и закупочная кратность', () => {
  const r = engine.calculate(shelf, 8);
  eq(r.errors, []); eq(r.M, 13000); eq(r.W, 4560);
  eq(r.rows.map(l => l.qty), [0.5, 8, 2.5, 0.5]);
  eq(r.rows.map(l => l.purchase), [5, 64, 20, 6]);
  near(r.total, 27999, 'Batch sale amount');
});

scenario('Стеллаж: объём раскроя и готовая геометрия на всю партию', () => {
  const s = copy(shelf);
  Object.assign(s.lines[1].processBinding, { geometryBasis: 'batch', amount: 32, parts: null });
  s.lines[1].processOutput = { basis: 'batch', area: 10, count: 20, source: 'SYNTHETIC batch' };
  const a = engine.calculate(s, 4), b = engine.calculate(s, 8);
  eq(a.W, 2280); eq(b.W, 2280);
  eq(b.rows[1].qty, 4); eq(b.rows[2].qty, 1.25); eq(b.rows[3].qty, 0.25);
  eq(b.rows[3].purchase, 3, 'Batch coating requirement must remain 2 litres');
});

scenario('Стеллаж: неизвестная длина и площадь после раскроя не подменяются', () => {
  const s = copy(shelf);
  s.lines[1].processBinding.amount = null;
  delete s.lines[1].processOutput;
  const r = engine.calculate(s);
  ok(r.partial); eq(r.rows[1].qty, null); eq(r.rows[2].qty, null); eq(r.rows[3].qty, null);
  eq(r.W, 0); eq(r.M, 6000);
  ok(r.errors.some(e => e.includes('длину реза')));
  ok(r.errors.some(e => e.includes('готовых деталей')));
});

const bench = calculation('Искусственная лавка дерево + сталь', 3, [
  line('wood', 'material', 'Доска лавки', 'м', 6, 100, { processMetrics: { unit: 'м', area: 0.8, mass: 1, source: 'SYNTHETIC' } }),
  line('steel', 'material', 'Труба стальная', 'м', 4, 200, { processMetrics: { unit: 'м', area: 0.12, mass: 2, source: 'SYNTHETIC' } }),
  line('wood-sand', 'work', 'Шлифовка доски', 'м²', 999, 150, { processBinding: bind('wood', 'area', 'м²') }),
  line('wood-finish', 'material', 'Покрытие доски', 'л', 999, 600, { processBinding: bind('wood-sand', 'area', 'л', 0.15, 'norm') }),
  line('steel-paint', 'work', 'Окраска каркаса', 'м²', 999, 250, { processBinding: bind('steel', 'area', 'м²') }),
  line('weld', 'work', 'Сварка каркаса', 'н/ч', 999, 1000, { processBinding: bind('steel', 'length', 'н/ч', 0.1, 'norm') }),
  line('steel-cut', 'work', 'Резка трубы', 'м.п.', 999, 50, { processBinding: { ...bind('steel', 'length', 'м.п.'), mode: 'geometry', geometryBasis: 'unit', amount: 2.5, parts: null } })
]);

scenario('Лавка: отдельные ветки дерева и стали с явными нормами', () => {
  schema.calculation(bench);
  const r = engine.calculate(bench);
  eq(r.errors, []); near(r.M, 5496, 'Bench materials'); near(r.W, 4095, 'Bench works');
  near(r.total, 9591, 'Bench total'); near(r.rows[3].qty, 0.72, 'Finish litres/product');
  near(r.rows[4].qty, 0.48, 'Steel surface/product'); near(r.rows[5].qty, 0.4, 'Welding hours/product');
  eq(r.rows[6].qty, 2.5, 'Cutting contour must not become stock length 4');
});

scenario('Лавка: пакетная работа, чистые объёмы без закупочного запаса', () => {
  const s = copy(bench);
  s.lines[0].reserve = 50; s.lines[0].pack = 20; s.lines[0].allocation = 'whole';
  s.lines[2].scope = 'batch';
  const r = engine.calculate(s);
  near(r.rows[2].qty, 14.4, 'All surfaces in batch');
  near(r.rows[2].amount, 2160, 'Batch work must not be multiplied twice');
  eq(r.rows[0].purchase, 40); near(r.rows[3].qty, 0.72, 'Consumption excludes material reserve');
  near(r.W, 4095, 'Scope change preserves work cost');
});

scenario('Лавка: удаление материала, смена единицы и несовместимый прямой перенос', () => {
  const absent = copy(bench); absent.lines = absent.lines.filter(l => l.processKey !== 'wood');
  const missing = graph.resolve(absent);
  eq(missing.state.lines.find(l => l.processKey === 'wood-sand').qty, null);
  eq(missing.state.lines.find(l => l.processKey === 'wood-finish').qty, null);
  ok(missing.errors.some(e => e.includes('удалён')));
  const changed = copy(bench); changed.lines[0].unit = 'м³';
  ok(graph.resolve(changed).errors.some(e => e.includes('Единица материала изменилась')));
  const invalid = copy(bench); invalid.lines[5].processBinding.mode = 'direct';
  eq(graph.resolve(invalid).state.lines[5].qty, null);
  ok(graph.resolve(invalid).errors.some(e => e.includes('явная норма')));
});

const spec = JSON.parse(fs.readFileSync(path.join(root, 'SKETCHUP_SPEC_EXAMPLE.json'), 'utf8'));
spec.source.id = 'synthetic-linked-product'; spec.source.revision = 'test-1';
spec.products[0].name = 'Искусственная полка с крепежом';
spec.parts[0].quantity.value = 5; spec.parts[0].occurrence_refs = [];
for (const m of spec.parts[0].metrics) if (m.key === 'coating_area') Object.assign(m, { value: 1.1, status: 'derived', evidence_refs: ['E2'] });
specCore.validate(spec);
const catalog = [
  { id: 'plywood', name: 'Тестовая фанера', kind: 'material', unit: 'м²', price: 100 },
  { id: 'screw', name: 'Тестовый саморез', kind: 'material', unit: 'шт.', price: 3 },
  { id: 'labor', name: 'Тестовое покрытие', kind: 'work', unit: 'н/ч', price: 500 },
  { id: 'paint', name: 'Тестовый состав', kind: 'material', unit: 'л', price: 200 }
];
let id = 0;
const makeLine = (catalogId, kind) => {
  const c = catalog.find(c => c.id === catalogId);
  return line('spec-' + (++id), kind, c?.name || '', c?.unit || 'шт.', null, c?.price ?? null, { catalogId, allocation: 'share' });
};
const specRows = specCore.rows(spec, 'P1');
const item = (key, catalogId, driver, factor = null) => {
  const row = specRows.find(r => r.key === key), c = catalog.find(c => c.id === catalogId);
  return { row, config: { ...specCore.config(row, catalog), selected: true, catalogId, name: c?.name || row.name, unit: c?.unit || 'кг', driver, factor, note: factor === null ? '' : 'SYNTHETIC TEST norm including all coats', inclusion: 'separate' } };
};
const items = [item('part-D1', 'plywood', 'face_area'), item('part-D2', 'screw', 'count'), item('work-W1', 'labor', 'coating_area', 0.25), item('resource-R1', 'paint', 'coating_area', 0.2)];
const blank = () => calculation('Искусственная полка', 6, []);

scenario('Спецификация: пять панелей, крепёж, труд и расход на тираж 6', () => {
  const input = blank(), before = JSON.stringify(input);
  const applied = specCore.apply(input, spec, 'P1', items, makeLine);
  eq(applied.added, 4); eq(JSON.stringify(input), before); schema.calculation(applied.state);
  const r = engine.calculate(applied.state);
  eq(r.errors, []); eq(r.rows.map(l => l.qty), [2.5, 4, 1.375, 1.1]);
  eq(r.M, 2892); eq(r.W, 4125); eq(r.total, 7017);
  ok(applied.state.lines.every(l => l.modelSpecOrigin?.evidence));
  ok(applied.state.lines.every(l => !l.confirmed), 'Imported quantities require user review');
});

scenario('Спецификация: повторное применение и другая ревизия не дублируют строки', () => {
  const first = specCore.apply(blank(), spec, 'P1', items.slice(0, 1), makeLine).state;
  const second = specCore.apply(first, spec, 'P1', items, makeLine);
  eq(second.added, 3); eq(second.state.lines.length, 4); eq(second.state.modelSpecImports.length, 1);
  const before = JSON.stringify(second.state);
  throws(() => specCore.apply(second.state, spec, 'P1', items, makeLine), /уже добавлены/);
  eq(JSON.stringify(second.state), before);
  const revised = copy(spec); revised.source.revision = 'test-2';
  throws(() => specCore.apply(second.state, revised, 'P1', items, makeLine), /Другая ревизия/);
});

scenario('Спецификация: отсутствующая норма/цена и явный ноль различаются', () => {
  const labor = items[2];
  eq(specCore.amount(spec, labor.row, { ...labor.config, note: '' }).value, null);
  eq(specCore.amount(spec, labor.row, { ...labor.config, factor: null }).value, null);
  eq(specCore.amount(spec, labor.row, { ...labor.config, manual: 0 }).value, 0);
  const unpriced = { ...items[0], config: { ...items[0].config, catalogId: '', unit: 'кг', driver: 'mass' } };
  const applied = specCore.apply(blank(), spec, 'P1', [unpriced], makeLine).state;
  eq(applied.lines[0].qty, null); eq(applied.lines[0].price, null);
  ok(engine.calculate(applied).partial); eq(engine.calculate(applied).M, 0);
  const unknown = copy(spec); Object.assign(unknown.parts[0].metrics.find(m => m.key === 'coating_area'), { value: null, status: 'unknown' });
  eq(specCore.amount(unknown, labor.row, labor.config).value, null);
});

scenario('Спецификация: партия, конфликт баз, включённый ресурс и инструмент', () => {
  const batch = copy(spec); batch.parts.forEach(p => p.quantity.basis = 'batch');
  const applied = specCore.apply(blank(), batch, 'P1', items, makeLine).state;
  eq(applied.lines.map(l => l.scope), ['batch', 'batch', 'batch', 'batch']);
  const a = engine.calculate(applied, 6), b = engine.calculate(applied, 12);
  near(a.M, 482, 'Batch material cost'); near(a.W, 687.5, 'Batch work cost'); eq(a.total, b.total);
  const mixed = copy(spec); mixed.parts[1].quantity.basis = 'batch';
  const assembly = specCore.rows(mixed, 'P1').find(r => r.key === 'work-W2');
  eq(specCore.amount(mixed, assembly, { ...specCore.config(assembly, []), driver: 'count', unit: 'шт.' }).value, null);
  const tool = specRows.find(r => r.role === 'tool'); ok(tool.disabled);
  throws(() => specCore.apply(blank(), spec, 'P1', [{ ...items[3], config: { ...items[3].config, inclusion: 'unknown' } }], makeLine), /включён/);
  const included = copy(spec); included.requirements[0].inclusion = 'included';
  ok(specCore.rows(included, 'P1').find(r => r.key === 'resource-R1').disabled);
});

scenario('Спецификация: взаимоисключающие работы нельзя добавить двумя применениями', () => {
  const routes = copy(spec);
  routes.process_candidates.forEach(w => w.alternative_group = 'synthetic-alternative-route');
  specCore.validate(routes);
  const workItems = specCore.rows(routes, 'P1').filter(r => r.type === 'work').map(row => ({
    row, config: { ...specCore.config(row, catalog), selected: true, catalogId: 'labor', unit: 'н/ч', manual: 1 }
  }));
  throws(() => specCore.apply(blank(), routes, 'P1', workItems, makeLine), /взаимоисключающие/,
    'Control: simultaneous alternative selection is rejected');
  const first = specCore.apply(blank(), routes, 'P1', [workItems[0]], makeLine).state;
  throws(() => specCore.apply(first, routes, 'P1', [workItems[1]], makeLine), /взаимоисключающие/,
    'Sequential application must enforce the same alternative-group rule');
});

const failed = results.filter(r => r.result === 'FAIL').length;
console.log(JSON.stringify({ suite: 'linked-product-scenarios', syntheticInputs: true, scenarios: results.length, passed: results.length - failed, failed, assertions, results }, null, 2));
if (failed) process.exitCode = 1;
