# Icon

`Icon` принимает импортированный символ из `@labpics/icons/symbols/<name>`.
Он сохраняет авторские Outline/Filled, оптические размеры и смысловые состояния.
Полный каталог, компилятор и движок анимации не входят в статический импорт.

```tsx
import { symbol as notifications } from '@labpics/icons/symbols/notifications';
import { Icon } from '@labpics/ui-react/icon';
import { createTypographyScale, typographyStyle } from '@labpics/ui-core/typography';

const scale = createTypographyScale('body', 20); // одна настройка области: 125%
<div style={typographyStyle(scale)}>
  <Icon symbol={notifications} size="1.25em" scale={scale} state="selected" />
  Уведомления включены
</div>;
```

`size` — положительное число CSS px либо строка `px/rem/em`; по умолчанию 24.
Для rem/em нужен общий `TypographyScale`. Он выводит em из авторской текстовой
роли и размера корня области; caller не повторяет кегль роли. И текст, и Icon
получают вычисленные px: внешний `font-size` не масштабирует их второй раз.
При изменении настройки создайте новый scale и передайте его области.
Никаких измерений, ResizeObserver или умножения на DPR. Произвольный внешний
CSS `em` без сигнала масштаба не определяет автоматический opsz: используйте
численный `size` или согласованный scale.

`opsz="auto"` следует итоговому size и ограничивается 16–48; явный opsz — 16–48.
`weight` — 300–600, по умолчанию 400. `variant` переопределяет Outline/Filled.
Без variant состояние `selected` выбирает Filled, `unselected` — Outline.
Остальные `state` определяются импортированным символом.

`calendar-number` принимает `date: Date` вместе с `timeZone` (явный IANA,
например `Europe/Moscow`). Дата не выводится из часового пояса машины и не
обновляется скрытым таймером; приложение передаёт новый момент. SSR отражает
его ISO-атрибутом, который hydration восстанавливает в Date.

Декоративный Icon скрыт от accessibility tree. Имя действия задайте кнопке.
Если знак сам сообщает информацию, передайте `label`; он получит роль img.
Цвет всегда наследуется через currentColor.

## Движение

Смена state/variant плавно продолжает текущую позу. Статический Icon не создаёт
таймеров, подписок или кадров. Движок загружается при первом движении.
При отказе загрузки сохраняется последнее запрошенное состояние статического SVG.
`duration` задаётся в миллисекундах (по умолчанию 180); `reducedMotion` и системное
предпочтение прекращают движение на целевой позе. Замена symbol и disconnect
освобождают ресурсы, включая отложенную загрузку.

Для refresh передайте `effect="cycle"` и меняйте `effectKey`, чтобы повторить жест.
Имя эффекта должно быть объявлено символом. Императивный путь даёт controls:

```tsx
const icon = useRef<IconHandle>(null);
<Icon ref={icon} symbol={refresh} />;
const playback = await icon.current?.playEffect('cycle');
playback?.pause();
playback?.seek(120);
playback?.play();
await playback?.finished;
```

Lit предоставляет тот же `element.playEffect()`. Ошибка декларативного движения
всплывает DOM-событием `icon-error`; Promise явного вызова отклоняется.

## Привязки и SSR

Lit: `import '@labpics/ui-core/icon'`, затем
`html\`<lab-icon .symbol=\${notifications} state="selected"></lab-icon>\``.
Vue и Solid экспортируют `Icon` из `@labpics/ui-<framework>/icon`;
Svelte — из `@labpics/ui-svelte`, Astro — из `@labpics/ui-astro/Icon.astro`.
Их `ssr` entry предоставляет `renderIcon({ symbol: notifications, ... })`.
В Astro ресурс остаётся серверным до явного присвоения импорта в клиентском
script; статический SVG работает и без этого. Для интерактивного Astro island
можно использовать любую из привязок клиентского фреймворка.

Сервер выдаёт готовый SVG до JavaScript. `symbol` помечен как resource в обычной
метаинформации свойства: packet не повторяется в HTML. После upgrade рисунок
остаётся видимым до присвоения того же импорта. При ручной Lit hydration сначала
подключите `@lit-labs/ssr-client/lit-element-hydrate-support.js`.

После hydration контроллер меняет только внутренний рисунок. Оболочка Lit
сохраняет свои DOM-маркеры при смене размера, символа, состояния и при reconnect;
серверный SVG до первого изменения принимается без замены.

CommonJS приложения загружают import-only символ через `await import()`;
после этого React, Lit, Vue, Solid и Astro SSR рендерятся синхронно.
Svelte сохраняет собственный ESM-only пакетный контракт. `require()` glyph не поддержан.
Чистый Icons renderer встроен в единственный общий dual ESM/CJS runtime LabUI.

Источники: [Lab Icons](https://github.com/Labpics-Team/lab-icons),
[исходный дизайн](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
[Lit hydration](https://lit.dev/docs/ssr/client-usage/).
