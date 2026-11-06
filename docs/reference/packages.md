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
