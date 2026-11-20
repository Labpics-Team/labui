# Menu, Context Menu и Menubar

Три представления используют одно дерево `LabMenuItem`, один набор `checkedValues`
и профиль `menu` из `packages/tokens/src/components.json`. Реализация использует
Compose Foundation, `Popup`, `LabSurface` и импортированные Lab Icons. Material 3
не входит в этот путь. Поверхности помещают внутрь `LabScene`.

```kotlin
import pics.lab.icons.symbols.pencil
import pics.lab.ui.*

val items = listOf(
    LabMenuItem.Action("edit", "Редактировать", icon = pencil),
    LabMenuItem.Check("grid", "Показывать сетку", closeOnSelect = false),
    LabMenuItem.Submenu("export", "Экспорт", listOf(
        LabMenuItem.Action("png", "Изображение PNG"),
        LabMenuItem.Action("pdf", "Документ PDF"),
    )),
)
LabMenu(items, "Действия", onSelect = ::performAction) { control, toggle ->
    LabButton("Действия", toggle, control)
}
LabContextMenu(items, "Действия над объектом", onSelect = ::performAction) { region ->
    LabText("Объект на холсте", region.padding(24.dp))
}
LabMenubar(listOf(LabMenubarItem("project", "Проект", items)), onSelect = ::performAction)
```

`LabMenu` передаёт `Modifier` и `toggle` настоящему управляющему элементу. Это
позволяет вернуть ему фокус без дополнительной кнопки. `LabContextMenu` передаёт
modifier области содержимого; secondary click и long press открывают меню у
указателя, Menu key и Shift+F10 — у области. `label` — доступное имя popup.

## Данные и состояние

`LabMenuItem` — sealed family: `Action`, `Check`, `Radio`, `Submenu`, `Separator`.
Всё дерево, включая разделители и потомков, имеет уникальные непустые `value`.
Каждая запись имеет подпись; radio требует непустой `group`. `LabMenubarItem`
добавляет именованный корень и необязательный `heading`. Значения пунктов уникальны
между всеми корнями одной строки меню.

У пунктов есть `disabled`, `tone` (Neutral/Accent/Danger), `icon`, `iconEnd`,
`shortcut`. Иконки — `SymbolData` из самостоятельного пакета Lab Icons. `shortcut`
рисует `LabKbd`; приложение отдельно назначает горячие клавиши.
`iconVariant` и `iconEndVariant` выбирают `IconVariant.Outline` или `Filled`.
Без явного варианта используется Outline. Выбранный Check/Radio заменяет leading icon
своей отметкой; снятый показывает переданную иконку.
Выбранный Check показывает checkmark, выбранный Radio — точку. Значение выбора
находится в `checkedValues`, не в самом пункте. Радиогруппа охватывает всё дерево.
Повторный выбор radio не снимает его; disabled не меняет состояние. Неподходящие
и исчезнувшие ключи отфильтровываются при отображении без записи в приложение.

| Представление | Управляемое состояние | Локальное начальное состояние |
| --- | --- | --- |
| Menu / Context Menu | `open: Boolean`, `onOpenChange` | `defaultOpen` |
| Menubar | overload с `value: String?`, обязательным `onValueChange` | overload с `defaultValue` |
| Все три | `checkedValues: List<String>`, `onCheckedValuesChange` | `defaultCheckedValues` |

У Menu/Context `open = null` и у всех `checkedValues = null` выбирают локальное
состояние. У контролируемого Menubar `value = null` явно закрывает все корни,
поэтому для него отдельный overload. `default*` читаются при создании композиции.
Изменение управляемого значения только запрашивается: отказ callback сохраняет
видимое открытие и выбор. `onSelect` вызывается для выбранного действия, Check
или Radio; не для разделителя и не при раскрытии подменю. `closeOnSelect = false`
позволяет изменить несколько опций, оставив меню открытым.

## Навигация и внешний вид

ArrowDown/ArrowUp открывают dropdown с первого/последнего доступного пункта.
В меню работают Up/Down, Home/End, поиск по началу подписи, Enter/Space.
Горизонтальные стрелки открывают и закрывают подменю, зеркально в RTL. Escape
закрывает текущий уровень; выбор конечного действия закрывает всю цепочку.
Tab/Shift+Tab закрывают всю цепочку и переходят к следующему/предыдущему элементу
приложения. Disabled пропускается. Menubar имеет один Tab stop, горизонтальную
навигацию и переключение открытого корня наведением.

Вся цепочка находится в одном Foundation Popup, панели размещаются отдельными
узлами внутри него. Поэтому нажатие на родительский пункт при открытом подменю
доходит до этого пункта. Отдельные focusable Popup перехватывают указатель вне
самого глубокого окна; их platform-specific флаги для этой задачи не нужны.

Панель имеет ширину 256 dp, радиус 12, внутренний отступ 4; строка — 12×8,
иконка 16. Текст Geist 16/24 растёт в sp; ширина панели растёт с системным
`fontScale` до доступной ширины окна, аналогично 16rem в web. При нехватке высоты меню прокручивается;
строка Menubar прокручивается по горизонтали. Popup меняет сторону около края,
затем ограничивает положение границами окна. Context резервирует колонку
иконки/выбора; disabled скрывает правые аксессуары.

Dropdown и Context используют Elevated, тени M и XS; Menubar — Soft,
активная кнопка имеет светлый статический фон, тёмную подпись и XS. Параметр
`material` использует существующие Solid/Acrylic/Glass, по умолчанию Acrylic.
Reduced transparency обрабатывает общий `LabSurface`. Geometry, typography,
материалы и роли берутся из сгенерированного `LabComponents`.

## Проверки и источники

`MenuModelTest` проверяет целостность дерева и radio-группы.
`MenuRenderTest` управляет настоящими Foundation Popup через offscreen scene:
клавиатура, secondary click, nested selection, RTL, managed rejection, динамический
disabled, Tab и 100/200% в обеих темах. `MenuConsumerTest` загружает установленный
Maven JAR и проходит действия всех трёх представлений с общим состоянием.
Эти проверки не заявляют пройденные системные screen readers или реальные
Android/iOS устройства.

[Сохранённые рендеры и воспроизведение](../evidence/menu-20261120/README.md).

- [Compose Multiplatform: focus navigation](https://github.com/JetBrains/compose-multiplatform/blob/v1.12.2/tutorials/Tab_Navigation/README.md)
- [Compose Multiplatform: context menus](https://www.jetbrains.com/help/kotlin-multiplatform-dev/compose-desktop-context-menus.html)
- [WAI-ARIA Menu and Menubar: keyboard contract](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
- [Lab UI authored source](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1)
