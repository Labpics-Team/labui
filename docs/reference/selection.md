# Check, Radio и Choicebox

Общий `selection` в `@labpics/ui-tokens/components.json` задаёт авторскую геометрию,
Geist, роли цвета и знаки. Lit и React используют один CSS; Compose получает
те же размеры генератором. Choicebox состоит из тех же Check/Radio, по одному
нативному действию на вариант. Формы, значения и клавиатура сохраняются при смене представления.

Источник: [Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
Check, Radio и Choicebox, проверены 18 ноября 2026. Check содержит 96 вариантов,
Radio — 64, Choicebox — 20. Авторские цвета — accent и neutral; прежний danger
сохранён как семантическое расширение. Отдельного pressed-состояния в этих наборах нет.

`tiny/s/m/l` дают контрольные размеры 16/12/16/20 px. Tiny показывает отдельный
знак без подложки. Radio сохраняет прозрачный центр: толщина кольца s/m/l — 3/4/6 px;
у accent l в focus она составляет 5 px. Check использует заполненный авторский
вектор и горизонтальную черту для mixed. Disabled задаётся ролями цвета, без
общей opacity. Системный масштаб меняет типографику и геометрию веб-контрола;
Compose разделяет dp-геометрию и системный sp-масштаб текста.

Одна ошибочная пара исходника исправлена в реализации: у selected/mixed neutral
Check Figma связывает почти белый dark `Backgrounds/Neutral/Inverted` с всегда
белым `Labels/Static/Light/Primary`. Профиль использует `label-inverted-primary`
для знака поверх инвертированной поверхности: светлый рисунок сохраняется,
в тёмной теме знак остаётся различимым. Tiny имеет другую анатомию и сохраняет
авторские роли; сам файл Figma не изменяется.

Focus: кольцо 2 px с отступом 2 px, tiny Check — отступ 0, tiny Radio — −2 px.
Для пустого tiny, у которого Figma не рисует focus, клавиатурный фокус всё равно
показывается: это необходимое поведение реального ввода за пределами матрицы макета.

Choicebox `card` соответствует авторскому `Opientation=Horizontal` (104 px минимум),
`row` — `Vertical` (56 px минимум). API сохраняет смысл компоновки без опечатки
источника. Высота растёт по содержимому; 283.5 px — предпочтительная ширина.
Hover добавляет только подложку, выбор — рамку 2 px и выбранный Check/Radio.
Для узкого веб-контейнера профиль задаёт `rowWrapWidth` 224 px при корневом
размере 16 px: подпись переходит под иконку и знак. Это responsive-расширение
авторской строки; Compose выбирает перенос по измеренной ширине содержимого.

## Формы и управление

Lit: `controlled` явно включает управление извне; без него `checked`/`value`
показывает текущее значение. `default-checked`, `default-indeterminate` и
`default-value` задают исходное значение и значение после reset. React определяет
управляемый режим наличием `checked`/`value`. Отклонённое изменение оставляет
прежнее значение; reset не генерирует событие пользовательского выбора.

Checkbox отправляет `value` (по умолчанию `on`) только при `checked=true`.
Mixed не отправляет значение и не удовлетворяет required. RadioGroup отправляет
одно выбранное доступное значение; `null` означает отсутствие выбора,
а пустая строка остаётся допустимым значением. Choicebox использует `string[]` как Select;
single отправляет первое выбранное значение, multiple — повторяющиеся поля `name`.
Required требует хотя бы одного доступного выбранного пункта. Disabled и внешний
fieldset исключают поля из отправки и проверки. Lit использует ElementInternals;
React — нативные поля формы. Отменённый reset сохраняет текущий выбор.

Checkbox поддерживает Space; RadioGroup и single Choicebox — стрелки, Home и End,
с пропуском недоступных вариантов и переносом фокуса. Tab входит в radio-группу
один раз. Направление горизонтальных стрелок учитывает RTL. Разметка SSR содержит
значение, форму, имена и авторский вид до загрузки клиентского кода; indeterminate
записывается в DOM-свойство при подключении, в серверной разметке указан `aria-checked=mixed`.

## Содержание

Checkbox: default/children, `label-start`, `description`, `icon`.
RadioGroup/Choicebox: `items` содержит уникальный `value`, строковые `label`,
`description` и `disabled`; слоты `label-{value}`, `description-{value}` и
`icon-{value}` позволяют использовать компоненты. В React Radio содержит children,
description и icon; ChoiceboxItem принимает ReactNode для этих частей.
RadioGroup также поддерживает `item.labelStart` и `label-start-{value}` перед знаком;
в React это `Radio.labelStart`.
Vue, Svelte и Solid передают rich-содержимое light DOM с теми же `slot`-именами.
SSR-функции адаптеров принимают `{ dynamic: { 'label-a': '<strong>…</strong>' } }`
вторым аргументом; Astro передаёт именованные слоты автоматически. Это уже
отрендеренный доверенный HTML, как и остальные SSR-слоты.
Пропущенное SSR-свойство сохраняет constructor default через Lit `noChange`.
Массивы items и Choicebox value/defaultValue отражаются в JSON-атрибутах:
гидрация восстанавливает их до первого обновления без повторной записи из приложения.
Иконка декоративная. В активную карточку не вкладывают другой интерактивный элемент.

Основания поведения: [W3C Checkbox](https://www.w3.org/WAI/ARIA/apg/patterns/checkbox/),
[W3C Radio Group](https://www.w3.org/WAI/ARIA/apg/patterns/radio/).
