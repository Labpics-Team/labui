# Snackbar

Короткий результат действия с одним необязательным действием. Для ошибки,
которую нужно исправить, используйте сообщение рядом с предметом ошибки.

```tsx
import { Snackbar } from '@labpics/ui-react/snackbar';

<Snackbar open={saved} message="Настройки сохранены" actionLabel="Отменить"
  onOpenChange={setSaved} onAction={undo} />
```

```html
<script type="module">import '@labpics/ui-core/snackbar';</script>
<lab-snackbar open message="Настройки сохранены" action-label="Отменить"></lab-snackbar>
```

`duration` задаёт миллисекунды, по умолчанию 5000. `0` оставляет сообщение
до закрытия приложением. При наведении, фокусе внутри или скрытом документе
отсчёт останавливается и затем продолжается с оставшегося времени.
`notificationKey` перезапускает сообщение с тем же текстом, сохраняя DOM.

React сообщает о закрытии через `onOpenChange(false)`. Lit меняет `open`
и отправляет `lab-open-change` с `detail.open`. `onAction(event)` / `lab-action`
вызываются до закрытия; `event.preventDefault()` сохраняет сообщение открытым.
Ошибка эффекта передаётся через `onRuntimeError` / `lab-error`.

Показывайте сообщение у нижнего края своей рабочей области. Компонент
сохраняет тему и материал своего контекста (`data-material="solid|acrylic|glass"`),
не создаёт глобальную очередь и не переносит элементы в другой контейнер.
Пример с сохранением и настоящей отменой находится в `apps/docs/src/experience.tsx`.

Геометрия и пять состояний таймера взяты из неизменённой Figma: Snackbar
6109:6735 и timer 6109:6708. Единственный профиль — `ui-tokens/components.json`;
Lit и React используют общий CSS и один runtime. Elevated, capsule, отступы
12/8 px, интервал до действия 24 px; кнопка — штатный small/accent/ghost.
Без действия высота определяется таймером и отступами, с действием равна 52 px.

Сообщение объявляется один раз через `role="status"`, без перемещения фокуса.
Таймер скрыт от accessibility tree. Действие доступно клавиатурой; при его
закрытии фокус возвращается к предыдущему доступному элементу. Для критичного
действия обеспечьте постоянный путь выполнения вне временного сообщения.

Источники: [Figma Snackbar](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/Lab-UI?node-id=6109-6735),
[WAI ARIA22](https://www.w3.org/WAI/WCAG21/Techniques/aria/ARIA22).
