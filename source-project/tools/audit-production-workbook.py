"""Read-only, independent comparison of the bundled Excel and JSON snapshots."""
import json, pathlib, openpyxl
root = pathlib.Path(__file__).resolve().parents[2]
source = root / 'inputs/production-calculator-handoff'
baseline = json.loads((source / 'reference/Производственная_калькуляция.json').read_text(encoding='utf-8'))
book = openpyxl.load_workbook(source / 'reference/Производственная_калькуляция.xlsx', data_only=True)
formulas = openpyxl.load_workbook(source / 'reference/Производственная_калькуляция.xlsx', data_only=False)
sheet = book['Калькуляция']
comparisons, mismatches = [], []
for op in baseline['operations']:
    for col, key in [('G', 'unit_rate_before_order_markup_rub'), ('K', 'planned_unit_cost_rub')]:
        expected, actual = op.get(key), sheet[f'{col}{op["row"]}'].value
        ok = (expected is None and actual in (None, '')) or (isinstance(expected, (int, float)) and isinstance(actual, (int, float)) and abs(expected-actual) <= 1e-7*max(1, abs(expected)))
        entry = dict(code=op['code'], cell=f'{col}{op["row"]}', json=expected, workbook=actual, matches=ok)
        comparisons.append(entry)
        if not ok:
            mismatches.append(entry)
report = dict(sheets=book.sheetnames, comparisons=len(comparisons), mismatches=mismatches, checked=comparisons,
              installation_rows=len(baseline['reference_schedules']['Монтаж']['cells']),
              formula_example=formulas['Калькуляция']['G10'].value)
support = pathlib.Path('C:/Users/Danil.S/Downloads/Согласование_цехов_постов_и_расчётов(1)(1).xlsx')
if support.exists():
    agreed = openpyxl.load_workbook(support, read_only=True, data_only=True)
    report['supporting_workbook'] = dict(name=support.name, sheets=agreed.sheetnames)
out = root / 'docs/production-migration/workbook-audit.json'
out.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Workbook comparison: {len(comparisons)} values, {len(mismatches)} differences')
if mismatches:
    print(json.dumps(mismatches[:6], ensure_ascii=False))
