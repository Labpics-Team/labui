# Menu, Context Menu и Menubar

Семейство выполняет команды над текущим объектом или представлением. Все три
компонента используют одно дерево `LabMenuItem`, общие состояния выбора и профиль
`menu` в [components.json](../../packages/tokens/src/components.json).

## Подключение

```tsx
import { Menu, ContextMenu, Menubar } from '@labpics/ui-react/menu';
import { symbol as duplicate } from '@labpics/icons/symbols/duplicate';
import type { LabMenuItem } from '@labpics/ui-core/menu/runtime';

const items: readonly LabMenuItem[] = [
  { value: 'copy', label: 'Создать копию', icon: duplicate, shortcut: ['⌘', 'D'] },
  { value: 'guides', label: 'Показывать направляющие', kind: 'check', closeOnSelect: false },
  { value: 'separator', kind: 'separator' },
  { value: 'export', label: 'Экспорт', kind: 'submenu', items: [
    { value: 'pdf', label: 'PDF' },
    { value: 'png', label: 'PNG' },
  ] },
];

<Menu label="Действия" items={items} onSelect={runCommand} />;
<ContextMenu label="Действия документа" items={items} onSelect={runCommand}>
  Документ
</ContextMenu>;
<Menubar menus={[{ value: 'file', label: 'Файл', items }]} onSelect={runCommand} />;
```

Web Components подключаются через `@labpics/ui-core/menu`, `/context-menu` и
`/menubar`. Vue, Solid, Svelte и Astro экспортируют соответствующие адаптеры и
SSR-функции `renderMenu`, `renderContextMenu`, `renderMenubar` из `/ssr`.
Сервер возвращает настоящие управления; панели подключаются при гидратации.
Стили React входят в импорт компонента. Общие шрифты, цвета, токены и темы
подключаются по обычному контракту приложения.

## Данные и состояние

`value` — стабильная непустая строка, уникальная во всём дереве, включая separator.
Переименование и перестановка сохраняют идентичность строки. `label` — видимый
текст. `icon` и `iconEnd` принимают импортированные Icons symbols.
`iconVariant` и `iconEndVariant` выбирают `outline` (по умолчанию) или `filled`.
Для check/radio выбранная отметка занимает место `icon`; в снятом состоянии
отображается переданная иконка. `shortcut` содержит подписи клавиш и не
регистрирует глобальное сочетание. Его обработчик предоставляет приложение.

| `kind` | Поведение |
| --- | --- |
| `action` или отсутствие `kind` | Выполняет команду |
| `check` | Переключает независимое значение |
| `radio` | Выбирает одно значение среди строк с одинаковым `group` |
| `submenu` | Открывает дочернее `items` |
| `separator` | Разделяет группы, не получает фокус |

`disabled` исключает строку из навигации и выполнения. `type` задаёт `neutral`,
`accent` или `danger`. `closeOnSelect: false` сохраняет панель после action/check/radio.
Повторный выбор radio не снимает его. Неизвестные выбранные значения исключаются;
в каждой radio-группе остаётся одно допустимое значение.

| Компонент | Контролируемое состояние | Начальное внутреннее состояние |
| --- | --- | --- |
| Menu, Context Menu | `open` | `defaultOpen` |
| Menubar | `value: string \| null` | `defaultValue` |
| Все | `checkedValues` | `defaultCheckedValues` |

`undefined` включает внутреннее состояние; `null` закрывает Menubar. При заданном
контролируемом значении действие вызывает запрос изменения, а принятое состояние
остаётся за приложением. React callbacks: `onOpenChange(boolean)`,
`onValueChange(string | null)`, `onCheckedValuesChange(readonly string[])`,
`onSelect(string)`. DOM-события соответственно `open-change` с `{ open }`,
`value-change` с `{ value }`, `checked-values-change` с `{ values }` и `select`
с `{ value }` в `detail`. События всплывают и пересекают Shadow DOM.

`heading` — необязательный заголовок popup. В Menubar он находится у каждой записи
`menus`. `placement` задаёт предпочтительное положение; при недостатке места
панель переносится и ограничивается viewport. `label` именует управление для
вспомогательных технологий. `disabled` всего компонента закрывает открытые панели.

## Навигация и размещение

Menu открывается кнопкой, Context Menu — secondary click, долгим нажатием,
ContextMenu или Shift+F10. Стрелки, Home/End и набор текста выбирают строку;
Enter/Space выполняют действие. Стрелка к подменю открывает его, обратная
возвращает в родительскую панель. Escape закрывает дерево. Клавиатурный
Context Menu возвращает фокус к области вызова; клик на другое управление
сохраняет новый фокус. Menubar использует один Tab-stop, пропускает недоступные
записи и переключает корни горизонтальными стрелками с учётом RTL.
Стрелка вперёд из вложенной команды без подменю переходит к следующему корню.
Отключение родительской команды закрывает всю её раскрытую ветку.

Панели остаются внутри своего renderer и используют локальный manual popover
в top layer. Поэтому они сохраняют ближайшую тему и материал, выходят из
clipping/transform предков и работают над native dialog. Приложение не переносит
панели в `body`. Material runtime выбирает режим из ближайшего `data-material`;
профиль задаёт Elevated/Soft, тени, контур и геометрию.

Lit и React делегируют жизненный цикл одному DOM runtime. Zag управляет отдельной
машиной каждой панели, а штатные `setChild`/`setParent` связывают дерево. Renderer
сохраняет собственные trigger/menubar controls; runtime управляет панелями.
Размонтирование прекращает машины и освобождает обработчики, popovers и материалы.

## Проверки и источники

- `pnpm --filter @labpics/ui-docs exec playwright test tests/menu.spec.ts` проверяет
  два renderer, управление состоянием, вложенность, фокус, RTL и локальный top layer.
- `pnpm --filter @labpics/ui-docs test:menu-packed` устанавливает настоящие архивы,
  проверяет публичные ESM-типы, четыре SSR-адаптера, Vue, React StrictMode,
  source-композиции и 1000 обновлений Menu/Tooltip/Select в Chromium и WebKit.
- [Native API и проверки](../../native/compose/docs/menu.md) описывают Foundation
  Popup, Compose semantics и установленный Maven consumer.
- [Сохранённые web-измерения](../evidence/menu/packed.json) и
  [native-рендеры](../../native/compose/evidence/menu-20261120/README.md).

Vanilla-адаптер Zag обновлён до 1.48: [upstream PR3557](https://github.com/chakra-ui/zag/pull/3557)
исправляет накопление getter-функций. Переданный при создании getter остаётся
живым; `updateProps({})` уведомляет watchers без нового getter на каждый render.
Unit-проверка после 1000 обновлений подтверждает одно чтение getter для полезного
запроса. Сами машины используют прежний совместимый контракт.

Исходники поведения:
[Zag nested menus](https://github.com/chakra-ui/zag/blob/main/website/data/components/nested-menu.mdx),
[WAI-ARIA Menu and Menubar](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/).
Дизайн: [Dropdown Menu](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/?node-id=6107-9225),
[Context Menu](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/?node-id=6110-16062),
[Menubar](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/?node-id=6110-23310).
