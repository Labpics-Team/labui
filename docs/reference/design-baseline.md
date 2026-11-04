# Проверенный эталон Lab UI v2.1

Источник — [авторская библиотека Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1).
Чтение выполнено 30 октября 2026 года. Исходник не изменялся. Приватные адреса
и идентификаторы в этом документе не сохраняются.

Это результаты чтения эталона, а не перечень завершённых компонентов кода.
Изображения просмотрены для Card light/dark, Switch S/M/L off/on и focus,
Button S/M/L и focus, Bottom Sheet Half/Flex. Остальные варианты требуют своей
визуальной проверки при реализации. Значения ниже не вычислены генератором Lab UI.

## Оси системы

Темы: Light, Dark, Light IC, Dark IC. IC означает increased contrast.
Размер компонента S/M/L и общий масштаб независимы. В библиотеке есть режимы
масштаба 100%, 75%, 116.6%, 133.3%.

Foundations различают Blur, Glass, Solid и плотности Subtle, Soft, Muted, Base,
Elevated. Документация Card и Bottom Sheet использует названия Solid, Glassy,
Ambient; их точное соответствие foundations ещё нужно подтвердить отрисовкой.
Button и Switch документированы с материалом Solid. Материал родительской
поверхности не превращает каждый внутренний контрол в прозрачный.

## Switch

Непосредственно прочитанные master-варианты используют Unit **100%**, Dimension
**Desktop**, Typography **Desktop**. У варианта, набора, контейнера и страницы
нет переопределения этих режимов. Значения ширины связаны с Unit px/10=28,
px/12=36 и px/14=44; это не уменьшенная копия большого масштаба.

| Размер | Трек, px | Бегунок, px | Отступ бегунка, px | Высота строки, px |
|---|---|---|---|---|
| S | 28 × 16 | 12 × 12 | 2 | 24 |
| M | 36 × 20 | 16 × 16 | 2 | 24 |
| L | 44 × 24 | 20 × 20 | 2 | 24 |

В состоянии on бегунок M начинается в x=18 относительно трека; переход от
off равен 16 px. Общая формула пути — ширина трека минус диаметр бегунка и два
отступа. Крайний отступ слева и справа одинаков. Frame focus-ring у M имеет
размер 40 × 24 px; обводка толщиной 2 px направлена наружу, поэтому видимая
внешняя граница — 44 × 28 px. Она не меняет основной layout.

Для веба существующий размерный контракт Lab UI принимает root 16 px. Поэтому
геометрия переводится в rem делением на 16 и проверяется также при root 20 px.
Сам Figma-файл не задаёт CSS root. Масштабирование и размеры проверяются отдельно.

Labels необязательны с обеих сторон. S/M: Geist Regular 16/24, tracking −0.25 px,
gap 8 px. L: Geist Medium 20/20, tracking −0.33 px, gap 12 px. Бегунок использует
Shadow/XS. Эти типографические и цветовые свойства не считаются исправленными
одной проверкой геометрии трека.

Есть 108 фактических вариантов по Type, Toggle, Size, State, Icon; они не
образуют полного произведения осей. Библиотечная документация определяет Switch
как немедленное применение бинарного состояния. Для выбора одного из трёх
материалов нужен соответствующий выбор вариантов, а не трёхпозиционный Switch.

## Card, Button и Bottom Sheet

| Компонент | Прочитанные отношения |
|---|---|
| Card | Radius 16 px, border 1 px, image и нижний content. Content padding 24 px, gap 16 px; текстовый layout gap 8 px, title/description gap 2 px. Высота зависит от содержимого: master 400×294 и showcase 400×400 не задают единственный размер карточки. |
| Button S | Высота 36 px, capsule radius, padding x=12/y=8 px, icon 20 px, label group min-height 20 px. |
| Button M | Высота 48 px, radius 16 px, padding 12 px, icon 24 px, label group min-height 24 px. |
| Button L | Высота 56 px, radius 16 px, padding 16 px, icon и label group как M. |
| Bottom Sheet | Полноширинный нижний body, верхние радиусы 32 px, x/bottom padding 16 px, gap 24 px; drag area 24 px, indicator 36×4 px; header, content slot, controls с gap 8 px. |

У Button description находится в строке рядом с основной label. 432 варианта
покрывают accent/neutral/danger, fill/tinted/border/ghost, icon-only, S/M/L и
default/hover/pressed/loading/disabled/focus. Это задаёт объём будущей приёмки.

Чтение Button уточнено 31 октября 2026 года. S использует Geist Medium 14/12
в label box высотой не менее 20 px. M/L используют Geist Medium 16/24 в label
box не менее 24 px. У label box собственные горизонтальные inset 8 px; leading
icon находится снаружи него, дополнительного gap между этими боксами нет.
Обводка расположена внутри указанных внешних отступов и не добавляет 2 px к
высоте. У icon-only label box и завершающая иконка отсутствуют, ширина равна высоте.
Основная иконка расположена по центру; read-only проверка квадратного S от 1 ноября
2026 подтверждает область 20 px в кнопке 36 px с отступами 8 px.

Эта геометрия переводится в rem при root 16 px и растёт вместе с ним; увеличение
текста может растить кнопку. Отдельная геометрическая проверка кода не подтверждает
полную анатомию с description/trailing icon, tracking, цвет и эффекты состояний.

Уточнение анатомии от 31 октября 2026 года: description S использует Geist 500,
14/12 px и tracking 0; M/L — Geist 400, 16/24 px и tracking −0.25 px. Между label
и description 8 px, у общей текстовой группы inset 8 px, внешний gap равен 0.
Обе области иконок имеют 20/24/24 px для S/M/L. Контур демонстрационного символа
в `apps/docs/src/assets/button-symbol.svg` взят из этого публичного эталона;
приватные metadata удалены, цвет наследуется через `currentColor`, размер задаёт
потребитель. Цветовое назначение, материалы и эффекты проверяются отдельно.

Уточнение эффектов accent/fill от 1 ноября 2026 года: основная заливка
`#007aff` в Light и `#4a8fff` в Dark одинакова для default, hover и pressed.
Состояния определяют независимые слои:

| Слой | Default | Hover | Pressed |
|---|---|---|---|
| Вертикальный градиент | White 20% → 0 | White 32% → 0 | Dark 12% → 0 |
| Внутренняя тень, x/y/blur/spread | 0/−1/1/0 px | 0/−1/1/0 px | 0/+1/1/0 px |
| Центральное свечение | Нет | Нет | White 52%, layer opacity 32% |

В normal Light/Dark Dark означает `#101012`; alpha внутренней тени составляет
12% в Light и 20% в Dark. Эти значения не заменяют лестницу внешних теней.
Свечение — круг 96 px при Desktop 100%, смещение центра по горизонтали S −1,
M 0, L +3 px. В экспортированном SVG радиус круга 48, Gaussian sigma 18;
радиус layer blur в модели Figma — 36 px. CSS `blur()` использует sigma.
В коде размеры и смещения масштабируются от root 16 px через rem.

Исходные raw stops hover/pressed имеют конечную alpha 0.0001; high-fidelity
экспорт округляет её до 0. Изменение итогового канала от такой alpha ограничено
0.0255 в шкале sRGB8 до квантования. Это зафиксированное различие источников,
а не основание менять исходный эталон. Прочитанные Mobile glow 64 px и IC Dark
black пока не означают наличие соответствующих режимов в коде.

Очищенный пакет чтения имеет SHA256
`437cab93f10378f5c940c1eaf9c344ca1562fcfb93fa0e6b2614d34a5897afa9`,
metadata экспортного glow —
`500f21f4d9ad9ed378408433d639edefe5732e4cd19b1762a4c24d389b537c48`.
Совпадение параметров не удостоверяет совпадение растеризации Figma и браузера:
это проверяется на реальном Button отдельно от геометрии и доступности.

Контрольный SVG M default и pressed экспортирован без изменения модели; локальные
имена SVG-символов очищены. Исходные очищенные экспорты сохраняются с SHA256:
default — `eade0a1c081e4248588d9beba74180ac6c53ae5aadbe3fb562384c3078631355`,
pressed — `872101838dbddee7d23b265d9352410a277b0f47b035fdb863c22dd6823f7451`.
В копиях `apps/docs/tests/fixtures/button-effects` удалена только пустая строка
после закрывающего SVG-тега. SHA256 копий: default —
`e85e897af29b194b3a04d1057bd0cceb82a1833475e72791bd7158ed899eaa09`, pressed —
`c1ac7d2e37df7ede9e0c412c035a397cacd6391704206e43b6460068aa94871f`.
Внутренняя тень использует SVG sigma 0.5, offset −1/+1, sRGB и alpha 0.12.
Последний stop pressed SVG имеет alpha 0.01 — это третье, отдельно сохранённое
представление, отличное от raw 0.0001 и high-fidelity 0.

Контроль 1 ноября 2026 выявил различие самих renderer: для M default, (115,46),
Figma PNG даёт RGB (2,121,249), тот же исходный SVG в Chromium — (2,123,255).
Для pressed, (115,4), соответственно (43,134,233) и (40,132,233).
Прежнее предположение о допустимости CSS/SVG-сравнения с пределом 2/255 в одном
браузере опровергнуто: для M default, (115,4), WebKit даёт SVG (118,158,255),
CSS (46,146,255), а исходный Figma PNG — (46,147,255). Такой SVG отвергает
согласованный с источником CSS и не используется как пиксельный эталон.
Исходные PNG остаются визуальной опорой; проверка резкого градиента сохраняет
прежний предел. Для размытых слоёв проверяются авторские параметры и обнаружение
удаления, ослабления и переворота слоя в одном браузере. Это проверка действия
эффекта, а не новый допуск расхождений с Figma. SVG сохраняется как свидетельство
экспорта; параметры компонента под его растеризацию не подгоняются.

Bottom Sheet имеет Full, 2/3, Half, 1/3, Flex. Эталонный viewport 375×812 не
становится фиксированным размером реализации. Над панелью Ghost использует
progressive blur, а не обычное сплошное затемнение. Прочитанные эффекты:
Progressive-blur/Strong — 24 px, BG-blur/Strong — 128 px, оба с noise.

## Цвет и чтение материалов

| Семантическая роль | Light | Dark |
|---|---|---|
| Labels/Neutral/Primary | `#101012` | `#f6f8fa` |
| Labels/Neutral/Secondary | `#3c3c43b8` | `#b0b0b9b8` |
| Border/Neutral/Base | `#78788029` | `#78788033` |
| Accent/Brand | `#007aff` | `#4a8fff` |
| Backgrounds/Materials/Elevated/01 | `#ffffffcc` | `#828282cc` |
| Backgrounds/Materials/Elevated/02 | `#262626` | `#1f1f1f` |

В этом чтении сгенерированный Figma-код терял часть effects и иногда показывал
light fallback для тёмного instance. Значения таблицы проверены через variable
definitions; материалы также просмотрены на изображении. Их вид нельзя
восстановить одним копированием fallback CSS: нужны blend, порядок слоёв и фон.

## Граница каталога

Структурный [снимок каталога от 4 ноября 2026 года](catalogue.md) содержит наборы
и варианты всех компонентных страниц. Его покрытие отделено от визуальной
приёмки и соответствия реализации.

Страницы эталона: Accordion, Alert, Alert Dialog, Avatar, Badge, Bottom Sheet,
Breadcrumb, Button, Calendar, Card, Charts, Chats, Check & Radio, Chips,
Choicebox, Color Picker, Context menu, Data Table, Drag Button, Drag'n'drop,
Dropdown, Dropdown Menu, Floating Dock, Input & Textarea, Input Pin, Kbd,
Loader, Menubar, Multiselect, Pagination, Progress, Segmented Control, Slider,
Snackbar, Switch, Tab, Timeline, Tooltip. Foundations включают Typography,
Colors, Dimensions, Effects, Layers, Icons и Flags.

В коде на `1cc4d062ecacc826b47d635ff2b5cb90a70c449f` зарегистрировано 27 семейств:
accordion, alert-dialog, avatar, badge, breadcrumb, button, card, checkbox,
combobox, dialog, input, kbd, loader, menu, number-input, pagination, pin-input,
popover, progress, radio-group, select, slider, switch, tabs, tags-input,
textarea, tooltip.

Название семейства или общая state machine не подтверждают соответствия странице
эталона. Например, наличие dialog ещё не означает готовый Bottom Sheet, а tabs —
готовый Segmented Control. Сопоставление анатомии, вариантов и поведения выполняется
для каждого семейства; отсутствие взаимно однозначных имён не сокращает каталог.
