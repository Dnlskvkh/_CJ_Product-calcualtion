# Актуализация производственных работ и группировка цехов — план реализации

> **Для исполнителя:** выполнять задачи последовательно. Перед каждым изменением запускать профильную проверку, после изменений — полный `node run-checks.cjs`.

**Цель:** обновить производственные работы по `Данные.xlsx`, добавить базовые/индивидуальные цены и нормо-часы, а в разделе «Изготовление» сгруппировать строки по цехам с сохранением ручного порядка.

**Архитектура:** исходный архив распаковывается в рабочую копию `source-project/` текущего checkout. Подготовительный импортёр читает оба Excel, обновляет только производственные записи каталога и создает отчеты. Браузерная модель хранит новые поля в строках расчета, а `app.js` отображает цеховые группы и перемещение строк вверх/вниз.

**Стек:** vanilla HTML/CSS/JS, CommonJS-проверки, текущий `dist/` и `worker/`, Node.js 24, существующая SQLite/record protocol схема.

**Спецификация:** `docs/superpowers/specs/2026-11-17-production-works-design.md`

## Глобальные ограничения

- Главный источник — `Данные.xlsx`, лист `Перечень_работ`; вторичный Excel не переопределяет его.
- Обработать все 190 позиций, включая скрытые и отфильтрованные строки.
- Материальные справочники не изменять.
- Не угадывать цены и производительности; ноль и текст цены считать отсутствием.
- Существующие числовые текущие цены при первоначальном импорте сохранять.
- Индивидуальная цена не перезаписывается последующими актуализациями.
- Исходные Excel не изменять; публикационные скрипты не запускать.
- Группировка и порядок строк не должны менять стоимость, формулы и клиентский экспорт.

## Фокус проверки

- Скрытые строки первичного Excel не выпадают из импорта.
- Нулевые/неизвестные цены не превращаются в действительные цены.
- Конфликтная или отсутствующая производительность не запускает автоматический расчет нормо-часов.
- Ручная цена сохраняется после перезапуска и импорта, reset возвращает последнюю базовую.
- При смене единицы цена остается прежней и появляется уведомление.
- Подрядчик всегда попадает в `Подрядные`, а fallback-классификация не скрывает источник.
- Перемещение строки не пересчитывает стоимость и сохраняется после JSON/localStorage.

### Задача 1: Подготовить рабочую копию и проверяемый импорт

**Файлы:**
- Создать: `source-project/` из `Calculator-source-2026-11-17-153643.zip`.
- Создать: `source-project/tools/import-production-works.cjs`.
- Создать: `source-project/tools/production-works-core.cjs`.
- Создать: `source-project/tests/production-works-import-check.cjs`.
- Создать: `source-project/reports/production-works/.gitkeep`.

**Интерфейсы:**
- `readWorkbooks(primaryPath, secondaryPath) -> { primary, secondary }`.
- `normalizeWorkRecord(record) -> NormalizedWorkRecord`.
- `matchWorks(sourceWorks, catalogWorks) -> MatchResult`.
- `classifyWorkshop(record) -> { workshop, source, fallback }`.
- `writeReports(result, outputDir) -> void`.

- [ ] Распаковать архив в `source-project/` и проверить наличие `dist/`, `worker/`, `drizzle/`, `tests/`, `package.json`.
- [ ] Реализовать чтение `Данные.xlsx` и вторичной книги без изменения исходных файлов.
- [ ] Добавить assert-проверки: 190 строк, 50 `н/ч` с H/I, 20 без H/I, 35 дополнительных L-кандидатов.
- [ ] Реализовать нормализацию имени, единицы, цены, формулы и параметров.
- [ ] Реализовать классификатор цехов с приоритетом `Подрядные` и фиксированным порядком групп.
- [ ] Запустить `node tests/production-works-import-check.cjs` и получить PASS.

### Задача 2: Сверка, отчеты и обновление каталога

**Файлы:**
- Modify: `source-project/tools/import-production-works.cjs`.
- Modify: `source-project/tools/production-works-core.cjs`.
- Modify: `source-project/dist/catalog.js`.
- Create: `source-project/reports/production-works/Отчет_сверки_наименований.json`.
- Create: `source-project/reports/production-works/Отчет_расхождений_стоимостей.json`.
- Create: `source-project/reports/production-works/Отчет_отсутствующих_стоимостей.json`.
- Create: `source-project/reports/production-works/Отчет_измененных_единиц_измерения.json`.
- Create: `source-project/reports/production-works/Отчет_добавленных_позиций.json`.
- Create: `source-project/reports/production-works/Отчет_дубликатов.json`.
- Create: `source-project/reports/production-works/Отчет_формул_ценообразования.json`.
- Create: `source-project/reports/production-works/Отчет_нормативов_производительности.json`.
- Create: `source-project/reports/production-works/Отчет_спорных_нормативов.json`.
- Create: `source-project/reports/production-works/Отчет_позиций_без_норм_выработки.json`.

- [ ] Сформировать все десять отчетов с обязательными полями из ТЗ.
- [ ] Обновить только `kind=work` из `Перечень_работ`, сохранив material-записи и unmatched calculator-only work.
- [ ] Добавить в каталог `basePrice`, `baseUnit`, `sourceFormula`, `sourceParameters`, `sourceFinalCost`, `productivity`, `productivityUnit`, `productivityStatus`, `workshop`.
- [ ] Проверить, что числовая текущая цена не перезаписана.
- [ ] Повторно запустить импорт и сравнить результат с первым запуском для идемпотентности.

### Задача 3: Расширить модель и валидацию расчета

**Файлы:**
- Modify: `source-project/dist/domain-schema.js`.
- Modify: `source-project/dist/app.js` (`blank`, `lineFrom`, `commitLine`, `cleanCalculation`-совместимые поля).
- Modify: `source-project/dist/review-ui.js` при необходимости сохранения полей.
- Test: `source-project/tests/production-works-model-check.cjs`.

- [ ] Добавить обратно совместимые поля `basePrice`, `pricingMode`, `baseUnit`, `sourceFormula`, `sourceParameters`, `sourceFinalCost`, `physicalQuantity`, `physicalUnit`, `productivity`, `productivityUnit`, `productivityStatus`, `unitChangeNotice`, `workshop`, `productionOrder`.
- [ ] Запретить отрицательный физический объем и недопустимые статусы/режимы.
- [ ] Сохранить старые JSON без новых полей.
- [ ] Проверить, что копирование, импорт, архив и подпись расчета не теряют новые поля.

### Задача 4: Расчет нормо-часов и базовой/индивидуальной цены

**Файлы:**
- Modify: `source-project/dist/engine.js`.
- Modify: `source-project/dist/app.js` (`editLine`, `commitLine`, reset).
- Modify: `source-project/dist/internal-report.js`.
- Test: `source-project/tests/production-works-engine-check.cjs`.

- [ ] Реализовать `physicalQuantity / productivity` без промежуточного округления только для `approved` и совпадающих единиц.
- [ ] Оставить ручной ввод `qty` для `missing`; отключить автоматический расчет для `conflict` и `not_applicable`.
- [ ] При ручном изменении цены устанавливать `pricingMode=individual` и сохранять `basePrice`.
- [ ] При reset восстанавливать базовую цену, единицу, формулу и параметры.
- [ ] При последующей актуализации обновлять текущую цену только для `calculated`.
- [ ] Проверить контрольный пример 18 / 4.5 = 4 и отрицательные/нулевые границы.

### Задача 5: Интерфейс «Ценообразование», цеха и порядок строк

**Файлы:**
- Modify: `source-project/dist/app.js` (`render`, список работ, `editLine`).
- Modify: `source-project/dist/style.css` или `source-project/dist/workspace.css`.
- Test: `source-project/tests/production-works-ui-check.cjs`.

- [ ] Добавить под ценой сворачиваемый блок `Ценообразование` с формулой, параметрами, единицами и статусом нормы.
- [ ] Добавить сообщение индивидуальной цены, кнопку reset и уведомление синхронизации единицы.
- [ ] Отображать работы секциями в порядке: `ЧПУ цех`, `Металлоцех`, `Древообработка`, `Лакокрасочный`, `Сборочный`, `Подрядные`.
- [ ] В каждой секции сортировать строки по `productionOrder`, для старых строк использовать текущий порядок массива.
- [ ] Добавить drag-and-drop за рукоятку из трех полосок слева от названия; перемещать строку только внутри текущего цеха и сохранять `productionOrder` сразу после отпускания.
- [ ] Проверить, что перемещение не меняет расчет и не попадает в клиентский экспорт как служебное поле.

### Задача 6: Сохранение, отчеты, сборка и полный прогон

**Файлы:**
- Modify: `source-project/dist/cloud.js` только если новые поля не проходят существующий протокол.
- Modify: `source-project/dist/record-protocol.js` только если требуется нормализация записей.
- Modify: `source-project/tests/scenarios/` при необходимости сценария перезапуска.

- [ ] Проверить localStorage, JSON, библиотеку изделий, версии, SQLite/API и восстановление.
- [ ] Проверить сохранение порядка строк и индивидуальной цены после перезапуска.
- [ ] Запустить профильные проверки.
- [ ] Запустить `node build-worker.cjs`.
- [ ] Запустить `node run-checks.cjs`.
- [ ] После успешного полного прогона собрать `node build-portable.cjs` в отдельный outputs-каталог.
- [ ] Не запускать публикацию и не менять исходные XLSX.

## Состояние выполнения на 17.11.2026

Выполнено в `source-project/`: рабочая копия, импортёр и отчеты по 190 позициям, классификация шести цехов, модель/валидация новых полей, UI группировки и перемещения строк, профильная и общая проверка, Worker и portable ZIP. При сборке без сети React Flow-бандл переиспользован из существующего `dist/graph-react.js`.
