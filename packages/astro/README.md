# @labpics/ui-astro

Astro-адаптер LabUI. Тонкие `.astro`-компоненты, серверно рендерящие Lit
web-components `<lab-*>` из `@labpics/ui-core` в declarative shadow DOM и гидрирующие
их на клиенте. По ADR-0001 (A-prime) родная реализация одна — React; Astro
_потребляет_ те же кастом-элементы.

`@astrojs/lit` **устарел на Astro 5** (офиц. доки), поэтому интеграция — ручной
рецепт Lit SSR: server → DSD-строка (`set:html`), client `<script>` →
hydrate-support + регистрация элемента (LitElement сам гидрируется из DSD). Все 27
компонентов **сгенерированы** из ядра (SSOT).

## Установка

```sh
pnpm add @labpics/ui-astro @labpics/ui-core
```

`astro` — peer (`>=4`). Для SSR нужен `@lit-labs/ssr` (опциональный peer).

## Использование

Импортируйте `.astro`-обёртку и используйте как обычный Astro-компонент:

```astro
---
import Button from '@labpics/ui-astro/Button.astro';
import Dialog from '@labpics/ui-astro/Dialog.astro';
---
<Button type="accent" size="l">Сохранить</Button>
<Dialog heading="Подтверждение">
  <span slot="content">Тело диалога</span>
</Dialog>
```

Пропы уходят на элемент атрибутами/свойствами; контент по умолчанию и именованные
слоты (`slot="..."`) проецируются в shadow DOM. Компонент серверно эмитит styled
declarative shadow DOM (без FOUC) и подключает клиентский скрипт гидрации.

## Программный SSR (`@labpics/ui-astro/ssr`)

Те же DSD-функции доступны напрямую (напр. для рендера вне `.astro`):

```ts
import { renderButton } from '@labpics/ui-astro/ssr';
const dsd = renderButton({ type: 'accent' }, { default: 'Сохранить' });
// строка с <template shadowrootmode>, внедряется через set:html
```

## Angular и другие фреймворки

Angular нативно поддерживает кастом-элементы — отдельный пакет не нужен. Рецепт (плюс
Next/Nuxt/SvelteKit) — в [docs/adapters.md](../../docs/adapters.md).
