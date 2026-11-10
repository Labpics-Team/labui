# Карта пакетов

Пакеты и приложения входят в [pnpm workspace](../../pnpm-workspace.yaml).
Актуальные exports, зависимости и команды находятся в их `package.json`.

| Пакет | Ответственность | Источник |
| --- | --- | --- |
| `@labpics/ui-core` | Web Components, общие типы, поведение и Lit SSR | [Core](../../packages/core/) |
| `@labpics/ui-react` | React-компоненты над общим контрактом | [React](../../packages/react/) |
| `@labpics/ui-vue` | Vue-привязка | [Vue](../../packages/vue/) |
| `@labpics/ui-svelte` | Svelte-привязка | [Svelte](../../packages/svelte/) |
| `@labpics/ui-solid` | Solid-привязка | [Solid](../../packages/solid/) |
| `@labpics/ui-astro` | Astro-привязка | [Astro](../../packages/astro/) |
| `@labpics/adapter-codegen` | Генерация общих частей привязок | [Adapter codegen](../../packages/adapter-codegen/) |
| `@labui/colors` | Цветовой CSS-контракт Lab UI на LabColors | [Colors](../../packages/colors/) |
| `@labpics/ui-tokens` | Геометрия, типографика, слои и токены движения | [Tokens](../../packages/tokens/) |
| `@labpics/ui-shadow` | Семантические тени | [Shadow](../../packages/shadow/) |
| `@labpics/ui-materials` | Solid, Glass, Acrylic и progressive blur | [Materials](../../packages/materials/) |
| `@labpics/fonts` | Geist и Geist Mono с лицензией OFL | [Fonts](../../packages/fonts/) |
| `@labpics/ui-docs` | Каталог, примеры и браузерные проверки | [Приложение каталога](../../apps/docs/) |

Компоненты Core и привязок имеют отдельные входы, например
`@labpics/ui-core/button` и `@labpics/ui-react/button`.
Регистрирующие Web Component входы и CSS имеют побочные эффекты;
используйте объявленные exports пакета.

Инструкции подключения находятся в
[практическом руководстве](../how-to/use-components.md),
области ответственности — в [объяснении устройства](../explanation/architecture.md).

## Публичные входы компонентов

Подключайте Web Component через его публичный вход. Импорт регистрирует элемент
в `customElements`; последующие импорты используют тот же модуль.

```ts
import '@labpics/ui-core/badge';
```

| Вход | Назначение |
|---|---|
| `@labpics/ui-core/<компонент>` | Класс компонента и регистрация его элемента |
| `@labpics/ui-core/shared` | Общие функции темы, CSS и полей, без Lit и регистрации элементов |
| `@labpics/ui-core` | Общие функции, типы, `LabElement` и мост Zag; при прямом `require` загружает Lit |
| `@labpics/ui-core/ssr` | Серверный рендеринг |
| `@labpics/ui-core/hydrate` | Подключение гидратации к сборке Vite |

Для общих функций используйте `shared`:

```ts
import { cssVar, setTheme } from '@labpics/ui-core/shared';

setTheme(document.documentElement, 'dark');
const foreground = cssVar('--lab-label-primary');
```

React-компоненты подключаются из `@labpics/ui-react/<компонент>` и используют
те же общие функции через `shared`. Их JavaScript не загружает Lit в ESM и CJS.
Стили и [гидратация Web Components](../ssr.md) подключаются отдельно.

### Вложенные компоненты

Внутри Core регистрация принадлежит `src/components/<имя>/index.ts`.
Если компонент использует другой элемент, подключайте публичный вход зависимости
по имени пакета:

```ts
import '@labpics/ui-core/badge';
```

Сборка Core оставляет такие ссылки внешними. Регистрация остаётся в публичном
входе и сохраняется при tree shaking. Относительные импорты соседнего
регистрационного `index.ts` позволяют сборщику перенести эффект в общий chunk
и нарушают эту границу. Внутренние классы и чистые вспомогательные модули могут
использовать обычные относительные импорты.

Экспорты задаёт [package.json Core](../../packages/core/package.json),
сборку — [tsup.config.ts](../../packages/core/tsup.config.ts).
Проверки упакованного потребителя находятся в
[packed-registration.test.ts](../../packages/core/test/packed-registration.test.ts).
