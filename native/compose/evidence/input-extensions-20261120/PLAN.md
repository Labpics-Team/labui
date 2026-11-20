# Native input extensions

Ответственность: LabInput accessory/decorator boundary, LabCombobox,
LabNumberInput, LabTagsInput и их native checks/evidence. Web, профиль и каталог
ведёт другой исполнитель в той же рабочей копии. Коммит включает только эти
native файлы; затем SHA передаётся для генерации каталога и интеграции root.

Отдельных Figma masters нет. Геометрия берётся из Input S/M/L, список —
Dropdown, метки — Chip S Sharp. Рамка, notch, helper/error и disabled/readOnly
проходят через один LabInput; TextFieldState остаётся единственным редактором.

1. Добавить переносимые slots LabInput, сохранив обычный Input render.
2. Combobox: controlled selected values, typed query, nonfocusable popup/listbox,
   disabled options, keyboard, accepted selection и IME guard.
3. TagsInput: controlled List<String>, draft/edit state, FlowRow chips в рамке,
   limits/duplicates/paste, virtual chip navigation, composition guards.
4. NumberInput: текстовый draft первичен; конечные min/max/step, commit на
   blur/Enter, точный обычный десятичный шаг без накопления binary drift.
   Числовую модель отдельно сопоставить с первоисточником и контрпримерами.
5. Headless SOFTWARE: семантика/клавиатура/настоящие IME edit commands,
   readOnly/disabled/controlled rejection, Light/Dark, 100/200%, narrow PNG.
   Никаких окон, NVDA, звука или изменений Figma.

Выпуск: commit только native → handoff web/catalog/root → cold review →
общая интеграция, CI, PR/merge/release у root.

Результат: native source готов, SOFTWARE 32/32 PASS (Input 3, Combo/Tags 11,
Chip 4, Number render 8 и numeric 6), PNG обеих тем 100/200% осмотрены. Paste boundary
исследована отдельно и проверена через реальные clipboard/IME/editor пути.
Android ancestor-contentReceiver regression добавлен в consumer runner;
локальный SDK не настроен, его runtime и iOS продолжает проверять CI. Number отдельно
закоммичен ca1a7362; общий Input, Combo/Tags, clipboard и evidence передаются
root для независимого ревью, native catalog linkage и интеграции.
