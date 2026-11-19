# Framework SSR и гидратация

Обычные компоненты `@labpics/ui-vue`, `@labpics/ui-solid` и `@labpics/ui-svelte`
рендерят содержательный HTML с declarative shadow DOM через серверный renderer
своего framework. Host, light DOM, слоты и обработчики остаются его узлами.
Lit гидратирует только shadow root. Дизайн и поведение берутся из того же компонента
ядра, что используется при клиентском рендере.

Общие [стили приложения](../how-to/use-components.md#подключить-стили) включаются
в CSS, загружаемый вместе с HTML: semantic colors, tokens, motion, theme и shadow.
DSD уже содержит стили самого элемента, но не заменяет этот общий контракт.

Для серверной сборки нужен optional peer `@lit-labs/ssr` версии `^4.1.0`.
Клиент подключает `@lit-labs/ssr-client/lit-element-hydrate-support.js` **до загрузки
модулей компонентов**. Надёжная граница при разделении сборки на chunks:

```js
import '@lit-labs/ssr-client/lit-element-hydrate-support.js';
const { hydrateApplication } = await import('./application.js');
await hydrateApplication();
```

`application.js` импортирует LabUI и запускает обычную гидратацию:

| Framework | Сервер | Клиент |
|---|---|---|
| Vue | `renderToString(createSSRApp(App))` | `createSSRApp(App).mount(root)` |
| Solid | `renderToString(() => <App />)` | `hydrate(() => <App />, root)` |
| Svelte 5 | `render(App).body` | `hydrate(App, { target: root })` |

Solid также требует обычный `HydrationScript` в документе. Компоненты, props и
структура light DOM одинаковы на сервере и клиенте. Браузер потребляет DSD-шаблон
при разборе исходного HTML, поэтому клиентское дерево не содержит этого элемента.

## Слоты Svelte 5

Неименованное содержимое передаётся через `children`. Фиксированные named snippets
сохраняют свои имена (`description`, `iconEnd` и другие). Для динамических имён и
совпадений со скалярным prop используется `slots: Readonly<Record<string, Snippet>>`:

```svelte
<script>
  import { Tabs } from '@labpics/ui-svelte';
  let draftText = $state('Черновик');
  const items = [
    { value: 'draft', label: 'Черновик' },
    { value: 'history', label: 'История' },
  ];
</script>

{#snippet draft()}
  <textarea bind:value={draftText}></textarea>
{/snippet}
{#snippet history()}<p>Сохранённые версии</p>{/snippet}

<Tabs {items} defaultValue="draft" slots={{ draft, history }} />
```

Ключ `slots` — точное имя native slot. Явная запись в `slots` заменяет одноимённый
фиксированный snippet prop. Например, `Tooltip` принимает строковый `content`, а
богатое содержимое — `slots={{ content: richContent }}`. Адаптер создаёт оболочки
`display:contents`, сохраняет их по имени и рендерит snippets штатным Svelte.

Legacy-синтаксис `<Tabs><div slot="draft">...</div></Tabs>` не является этим API:
Svelte извлекает такую разметку в `$$slots`, а Svelte 5-компонент использует snippets.
Потребителю не нужно вручную создавать light-DOM оболочки или HTML-строки.

## Граница ядра

`@labpics/ui-core/element-ssr` — условный вход. Node получает серверную функцию,
браузер — функцию без snapshot и без импорта SSR engine. Выбор проверяется через
настоящие package exports, Node ESM/CJS, Vite SSR и metafile клиентской сборки.
Подстановка workspace source через aliases не квалифицирует установленный пакет.

`renderElementParts(tag, { specs, props, attributes })` возвращает отражённые host
атрибуты, атрибуты DSD-шаблона и содержимое shadow root. Он не возвращает host,
framework children или внешние Lit part markers. `renderToString` из `/ssr` и эта
функция используют один набор renderer: Textarea, LabElement, LitElement.

`attributes` передаёт доступные компоненту скалярные native атрибуты (`id`, `form`,
`aria-*`, `data-*`) до его render. Native boolean presence и строковое значение
`aria-hidden="false"` различаются. Объектные `class`/`style`, callbacks, refs и
snippets сохраняются у framework host; они не строкифицируются в серверном
экземпляре Lit. Строковые class/style могут читаться как обычные атрибуты.

Отключённый boolean, явный `null` и property-only модель передаются существующим
`data-lab-inputs` и восстанавливаются один раз до `connectedCallback`. Пропущенный
input оставляет конструкторный default. При первом framework-пробросе уже имеющийся
строковый атрибут с тем же значением не переписывается: повтор вызвал бы attribute
reaction и затёр восстановленный Textarea draft. Последующее изменение caller
применяется; обновление другого prop не повторяет старое значение.

## Статические HTML helpers

`renderTabs`, `renderButton` и остальные функции адаптерных `/ssr` возвращают
полный host как HTML-строку для статического серверного фрагмента. Их строковые
слоты не несут framework state или обработчики. Гидратация такого фрагмента через
Lit и нативная гидратация framework — разные проверяемые пути.

## Проверка

```sh
pnpm --filter @labpics/ui-core... build
pnpm --filter @labpics/ui-vue --filter @labpics/ui-solid --filter @labpics/ui-svelte build
pnpm --filter @labpics/ui-docs test:framework-ssr
```

Проверка устанавливает tarballs вне workspace и запускает шесть сценариев:
Vue/Solid/Svelte × Chromium/WebKit. Она проверяет styled HTML до регистрации
custom elements, исходные host/shadow/light-DOM узлы, dirty Textarea и выделение,
обработчики snippets/slots, reactive updates, false/null/default inputs и новый
controlled value. Vue использует скомпилированные SFC и вложенный компонент.
Браузеры и временный consumer завершаются в `finally`.
Типы нового core-входа проверяются установленным TypeScript в NodeNext ESM/CJS,
а публичные Svelte snippets — `svelte-check`, включая отклонение строки вместо
snippet. Обычный `tsc` использует ambient `*.svelte` и не квалифицирует этот prop.

[Результат](../evidence/framework-ssr-20261119/result.json) ·
[Исполняемая проверка](../../apps/docs/tests/framework-ssr-packed.mjs).

Основания: [Lit element parts](https://github.com/lit/lit/blob/main/packages/labs/ssr-react/src/lib/node/render-custom-element.ts),
[Vue SSR](https://vuejs.org/guide/scaling-up/ssr),
[обычный Vue wrapper с DSD](https://github.com/svebcomponents/svebcomponents/blob/main/packages/ssr-vue/src/lib/runtime/CustomElementWrapper.ts),
[Solid hydrate](https://docs.solidjs.com/reference/rendering/hydrate),
[Svelte snippets](https://svelte.dev/docs/svelte/snippet).
