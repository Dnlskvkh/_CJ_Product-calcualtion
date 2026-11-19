# Production Cost UI Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans task-by-task. User approved implementation with «Давай пробовать».

**Goal:** Выпустить локальный Windows-билд с ресурсной себестоимостью и удобной иерархией операций.
**Architecture:** Сохранить vanilla JS, текущие снимки и протокол данных. Профильное ядро вычисляет состав затрат; интерфейс использует его для таблицы и карточки.
**Tech Stack:** JavaScript/CommonJS, Node 24, существующий PWA/portable pipeline.
**Spec:** docs/superpowers/specs/2026-11-19-production-cost-ui-design.md

## Global Constraints

- Не менять архивные результаты, старые методики, клиентский whitelist и SQL.
- Исходные нормы фиксированы; ноль отличается от неизвестного значения.
- Без новых зависимостей; работа в существующей пользовательской копии, без переноса неотслеживаемых материалов в новый checkout.
- Сохранять тарифную формулу продажи отдельно от ресурсной себестоимости.

## Review Focus

- Пустой объём и ошибка localStorage сохраняют предыдущие данные.
- Группировка и порядок сохраняют назначение поста и скрытые атрибуты.
- У старого снимка цена/единица не заменяются без восстановительной копии и просмотра.
- Оператор зависит от работ, не от денежной суммы; наладка не тиражируется.
- Новая карточка не теряет специальные входы карты/бригады/подготовки.

### Task 1: Расчёт и исходные названия

Files: dist/production-model-core.js, tools/build-production-model.cjs, tools/production-post-names.json, production-model-check.cjs.
Interfaces: resourceUnitCost(definition) returns number|null; resourceBreakdown(definition) returns Russian resource rows; existing calculateLine/calculate remain compatible.
- [ ] Добавить проверки цинкования из параметров, неизвестного ресурса, явного нуля и сохранения старого снимка; увидеть отказ.
- [ ] Реализовать ресурсное вычисление для новых определений с явной отметкой, сохраняя старую семантику снимков.
- [ ] Добавить проверенный справочник словесных постов и обычное определение карты форматника в генератор.
- [ ] Прогнать production-model-check.cjs.

### Task 2: Рабочие экраны и безопасное применение методики

Files: dist/production-model-ui.js, dist/production-model.css, production-ui-check.cjs.
Interfaces: productionSetQuantity(id,value), productionMove(id,direction), productionReorder(id,targetId); productionReadDraft preserves omitted fields; productionSourceChoices/productionUseSource replace only reviewed draft.
- [ ] Проверки иерархии, именований, inline-объёма, порядка/запрета смены поста, fixed fields, сохранности скрытых атрибутов, восстановления и выбора форматника; увидеть отказ.
- [ ] Реализовать группы/подытоги, сокращённую карточку, состав расчёта, именованный каталог, обычный выбор форматника и просмотр применения исходной методики.
- [ ] Разделить себестоимость и коммерческие суммы в итогах, скрыть служебные статусы.
- [ ] Прогнать UI и модельные проверки.

### Task 3: Проверка и выпуск

Files: README.txt, ARCHITECTURE.txt, generated sw/server, outputs/portable zip; this progress ledger.
- [ ] Независимый финальный review по навыку executing-plans; устранить существенные находки.
- [ ] node run-checks.cjs; node build-portable.cjs.
- [ ] Браузер: каталог, группировка, изменение объёма, карточка, узкий экран; сохранить скриншот.
- [ ] Сверить SHA256 готового ZIP и передать ссылку пользователю.

## Progress / rulings

- Implementation authorized. No further process approval needed.
- Ruling: исходная папка содержит неотслеживаемый проект; сохраняем её, без массового git commit. Исправления ограничены перечисленными модулями.
- Ruling: новые определения явно включают ресурсное вычисление; старые снимки продолжают старую семантику до просмотра/применения исходной методики.
- Task 1: complete — resource-cost checks RED→GREEN, generated named posts and ordinary panel-saw definition. Existing migration explicitly retains old cached-cost semantics.
- Task 2: complete — hierarchy/editor/quantity checks RED→GREEN; same-post order, unknown/zero, quota rollback, hidden fields and source preview tested. Additional RED→GREEN fixed unit cost division for program/crew metrics. Common post assignments can be displayed automatically only when every source variant agrees; stored snapshots are unchanged.
- Review: independent agent dispatch failed because the workspace service reported insufficient credits. No review result claimed. Self-review found and fixed the metric denominator issue; full regression suite rerun afterward.
- Task 3: complete — node run-checks.cjs PASS; node build-portable.cjs PASS, including SQLite/API/asset/restart/recovery checks. Browser 1440×1000 and 390×844 checked; screenshot files in docs/production-migration. Wide full-page capture was malformed by the browser capture tool; normal viewport screenshot verified and retained.
- Release: source-project/outputs/Calculator-Windows-x64-2026-11-19T07-18-43-132Z.zip; SHA256 0f923e702a57d14cde6e182faf717cc217be3df5d2df7cf3581a0d123267fbb1. No installation or publishing performed. Unchanged React Flow bundle reused because esbuild is unavailable.
