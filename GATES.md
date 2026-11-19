# Gates: обновление производственной калькуляции

Аудит 20.11.2026: проверить договорённости о человеко-часах от объёма, полную сверку фрезеровки с сохранённым конъюнктурным анализом и закрепить требования для дальнейшей работы. Аудит не назначает новые цены и не меняет рабочую базу.

OWNS: source-project/**, docs/**, inputs/**, backups/**, GATES.md

Scope: аудит до изменений, совместимое обновление существующего приложения по CODEX_UPDATE_TASK.json и проверка всех приёмочных случаев.

- [x] G1: Сверены вложения, сохранены карта соответствий и независимая сверка XLSX
  EVIDENCE: audit-production-handoff.cjs проверил одинаковые SHA-256 двух JSON, 190/151/284 записей и 6 различий единиц; audit-production-workbook.py независимо сверил 568 значений XLSX/JSON, расхождений 0. Карта и план выданы до изменения приложения. Снимок исходников в backups/production-before-2026-11-19.json.gz.
- [x] G2: AT-01…AT-16, миграция, валидация и сохранение новой модели проходят
  CHECK: node production-model-check.cjs
  EXPECT: Production model acceptance checks passed
  CWD: source-project
  EVIDENCE: automatic-evidence=v1; definition-sha256=1ecc1c6b119ab74616d37b65f470c047180301be8bc5f15e30e8daaa8491e49a; exit=0; EXPECT=matched; output-sha256=4ba2c928a2b438954352e67110df23093139524783ef58365d43043903e0e397; output-bytes=99; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Danil.S\Documents\ChatGPT\_CJ_Product-calcualtion\source-project; path=0655091c28b3/31 entries
- [x] G3: Регрессии существующего приложения проходят
  CHECK: node run-checks.cjs
  EXPECT: All architecture and regression checks passed.
  CWD: source-project
  EVIDENCE: automatic-evidence=v1; definition-sha256=68fa5ac123f601107e32709d259b713c5e4d4b1fd5c8eb2c5f2b1c5f8535e4a5; exit=0; EXPECT=matched; output-sha256=0c1e84b2cd4ed5c02366b24b509978f2a165f73bfce176945f2a57c96563d4e0; output-bytes=5274; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Danil.S\Documents\ChatGPT\_CJ_Product-calcualtion\source-project; path=0655091c28b3/31 entries
- [x] G4: Worker/PWA и переносная сборка собраны с новой моделью
  CHECK: node build-portable.cjs
  EXPECT: Archive:
  CWD: source-project
  EVIDENCE: automatic-evidence=v1; definition-sha256=bf40543553908151c8ab8e3fbf616fd02494273dd95e5a9edf92efbbec5567fc; exit=0; EXPECT=matched; output-sha256=f15152a5dc445fdac93d55060991d6aaaf4e38b993b805a35204662c2567e5e2; output-bytes=2022; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Danil.S\Documents\ChatGPT\_CJ_Product-calcualtion\source-project; path=0655091c28b3/31 entries
- [x] G5: Рабочий браузерный сценарий проверен, справочники материалов неизменны, ограничения отражены в передаче
  EVIDENCE: Браузер 127.0.0.1:4188: миграция с восстановительной копией, №112 240 м = 4162 ₽, P43 12 м / 10 ходов / 1 лист = 831,467384 ₽, единый итог 6990,85 ₽, версия 1 сохранена; обновление PWA сохранило входы и итог. Проверены финансы и компоненты во внутреннем предпросмотре. preview.jpg сохранён. Защищённые хеши проверены G2; independent workbook-audit и engine-reference-comparison: 568 значений и 283 активных определения без расхождений. RESULT.md, SCHEMA.md, release-manifest.json и отчёт недоступных источников готовы; установленная копия/рабочая БД и публикация не затрагивались.

- [x] G6: Для всех согласованных постов проверены автодобавление и часы от объёма, включая смешанные режимы; остальные согласованные способы труда сверены с моделью
  CHECK: node source-project/tools/audit-labor-automation.cjs
  EXPECT: Labor automation audit verified
  EVIDENCE: automatic-evidence=v1; definition-sha256=5fb1b82873334fc53951d6e557e999f56a09d2b964d386ee6e6664d8887b403b; exit=0; EXPECT=matched; output-sha256=9240b325fd294b49efd8b6e1ad83d4487a8c5108547ca617cdd071f955b8347d; output-bytes=231; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Danil.S\Documents\ChatGPT\_CJ_Product-calcualtion; path=bb0a3a61dda7/32 entries

- [x] G7: Все позиции фрезеровки сопоставлены с сохранённым анализом, различия стоимости/тарифа/рыночной цены и пробелы источников явно записаны
  EVIDENCE: docs/research/2026-11-20-milling-price-audit.md/json: 23 связанные позиции, 11 толщин, первичный Данные.xlsx прочитан read-only, рыночные источники Ф1/Ф2 и тарифная база форматника разделены. Дополнительно реальным UI-сценарием и ядром сверены все 13 полных баз станок+исполнитель с source.price_comparisons; совпадение в пределах 1e-8. Только Р146.4 намеренно отличается от старого снимка по новому правилу пользователя.

- [x] G8: В инструкциях проекта закреплён обязательный контроль автоматических трудовых позиций; отчёт содержит проверенные находки и нерешённые вопросы
  EVIDENCE: docs/OPERATION_AUTOMATION_REQUIREMENTS.md содержит ограничение только станочными позициями, норму 270/ceil(толщина/3), исключение коэффициентов совмещения, все проверенные посты, полный форматник и критерии труда/стоимости. source-project/AGENTS.md и КАРТА_ПРОЕКТА.md ссылаются на требования; остальных определений операций не меняли (побайтовое сравнение с прежним установленным каталогом выявило только Р146.4).

- [x] G9: Уточнённая норма фанеры 270 м прохода/ч и ceil(толщина/3) проверена для всех толщин, исходные ставки и архивные снимки сохранены
  CHECK: node production-model-check.cjs
  EXPECT: Production model acceptance checks passed
  CWD: source-project
  EVIDENCE: automatic-evidence=v1; definition-sha256=1ecc1c6b119ab74616d37b65f470c047180301be8bc5f15e30e8daaa8491e49a; exit=0; EXPECT=matched; output-sha256=4ba2c928a2b438954352e67110df23093139524783ef58365d43043903e0e397; output-bytes=99; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Danil.S\Documents\ChatGPT\_CJ_Product-calcualtion\source-project; path=bb0a3a61dda7/32 entries

- [x] G10: Только станочные позиции всех согласованных постов автоматически включают стоимость исполнителя по занятости, включая P08 и отдельные строки форматника
  CHECK: node production-ui-check.cjs
  EXPECT: Production UI checks passed
  CWD: source-project
  EVIDENCE: automatic-evidence=v1; definition-sha256=cb159ea79843e7faa3db761e5cac4e336503030504f8e6f9f0104f0925cb1d57; exit=0; EXPECT=matched; output-sha256=7fff1512a5672201d7c01dd04419b249135138c7ef1d1f1d6206f7ad30e5aa43; output-bytes=159; shell=C:\WINDOWS\system32\cmd.exe; cwd=C:\Users\Danil.S\Documents\ChatGPT\_CJ_Product-calcualtion\source-project; path=bb0a3a61dda7/32 entries

- [x] G11: Станочное обновление установлено рядом с прежним, база сохранена, сервер отдаёт проверенные ресурсы
  EVIDENCE: Установлен Calculator-Windows-x64-2026-11-19T16-06-43-366Z, SHA256 c6ba49f704fe31952d6d10524182a11e5dde9fbf2813e7237768b6d95640b6dc. Все 40 записей SQLite сверены с предыдущей копией, integrity_check=ok. HTTP index/catalog/core/UI/sw=200 и хеши совпадают с source-project/dist; установленный Worker совпадает с собранным. Предыдущая папка сохранена; браузерный кэш пользователя не очищался.
