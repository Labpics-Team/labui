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
