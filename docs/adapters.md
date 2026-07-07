# Фреймворк-адаптеры LabUI

Как использовать LabUI в React, Vue, Svelte, Solid, Astro и Angular, включая SSR.

## Модель (ADR-0001, A-prime)

Родная реализация одна — **React** (`@labpics/ui-react`): тонкие React-компоненты над
теми же Zag-машинами, что и Lit-ядро. Остальные стеки поставляются **как Lit
web-components** `<lab-*>` из `@labpics/ui-core`: адаптеры Vue/Svelte/Solid/Astro —
тонкие обёртки, монтирующие эти кастом-элементы и пробрасывающие пропы/события/слоты.
Разметка, стили, a11y и SSR-форма живут ОДИН раз в ядре — обёртка ничего не
переписывает.

Обёртки Vue/Svelte/Solid/Astro **сгенерированы** из единого манифеста, выведенного из
исходников ядра (`@labpics/adapter-codegen`). Поэтому API адаптеров не может
разойтись с Lit- и React-версиями: добавили компонент в ядро → перегенерация
подхватывает его во всех адаптерах, golden-тест ловит расхождение.

| Стек | Пакет | Как | SSR-вход |
| --- | --- | --- | --- |
| React / Next | `@labpics/ui-react` | родной рендерер | нативный (RSC) |
| Vue / Nuxt | `@labpics/ui-vue` | обёртка над `<lab-*>` | `@labpics/ui-vue/ssr` → `v-html` |
| Svelte / SvelteKit | `@labpics/ui-svelte` | обёртка над `<lab-*>` | `@labpics/ui-svelte/ssr` → `{@html}` |
| Solid / SolidStart | `@labpics/ui-solid` | обёртка над `<lab-*>` | `@labpics/ui-solid/ssr` → `innerHTML` |
| Astro | `@labpics/ui-astro` | `.astro` над `<lab-*>` | встроено (`set:html`) |
| Angular | — (без пакета) | нативные custom elements | нативно |

Детали и примеры каждого — в README пакета. Ниже — SSR-рецепты и Angular.

## Почему SSR web-компонентов особенный

Глубокий SSR (styled first paint без FOUC) — свойство `@lit-labs/ssr`, а не хост-
фреймворка: элемент рендерится в **declarative shadow DOM** (`<template
shadowrootmode>`). Клиентская обёртка `<Button>` рендерит `<lab-button>` и апгрейдит
его на клиенте, но НЕ эмитит DSD сама. Для FOUC-free SSR каждый адаптер даёт вход
`/ssr` с функциями `renderX(props, slots)` → DSD-строка, которую хост внедряет своим
СЫРЫМ каналом (`v-html` / `{@html}` / `innerHTML` / `set:html`). На клиенте элемент
апгрейдится импортом обёртки (или регистрации `@labpics/ui-core/<name>`).

Общее требование: для SSR-пути установите `@lit-labs/ssr` (опциональный peer каждого
адаптера).

**Асимметрия первого кадра (осознанная).** `renderX(props, slots)` биндит только
оси-пропы компонента и слоты. Хостовые НАТИВНЫЕ атрибуты (`class`, `id`, `aria-*`,
`data-*`), которые клиентская обёртка `<Button>` прокидывает через fall-through, в
серверный DSD НЕ попадают — их применяет клиентская обёртка при гидрации. На стили это
не влияет (shadow-стили самодостаточны на `--lab-*`-токенах); затрагивает лишь
хост-уровневые `class`/`aria-*` до гидрации. Если нужны они и на первом кадре — задайте
их на внешнем контейнере, в который внедряете DSD-строку.

## Next.js (React)

Используйте родной рендерер — он уже `'use client'` и работает под App Router как
клиентский лист под серверной оболочкой:

```tsx
import { Button } from '@labpics/ui-react';

export default function Save() {
  return <Button type="accent">Сохранить</Button>;
}
```

## Nuxt (Vue)

FOUC-free SSR — через DSD-инъекцию:

```vue
<script setup lang="ts">
import { renderButton } from '@labpics/ui-vue/ssr';
import '@labpics/ui-vue/button'; // клиентская регистрация/апгрейд элемента
const dsd = renderButton({ type: 'accent' }, { default: 'Сохранить' });
</script>

<template>
  <div v-html="dsd"></div>
</template>
```

Для чисто клиентского использования достаточно обёртки `<Button>` (гидрация без DSD).

## SvelteKit (Svelte)

```svelte
<script lang="ts">
  import { renderButton } from '@labpics/ui-svelte/ssr';
  import '@labpics/ui-svelte'; // клиентская регистрация обёрток
  const dsd = renderButton({ type: 'accent' }, { default: 'Сохранить' });
</script>

{@html dsd}
```

## SolidStart (Solid)

```tsx
import { renderButton } from '@labpics/ui-solid/ssr';
import '@labpics/ui-solid/button'; // клиентская регистрация/апгрейд
const dsd = renderButton({ type: 'accent' }, { default: 'Сохранить' });

<div innerHTML={dsd} />;
```

## Astro

Интеграция встроена в `.astro`-обёртки (server рендерит DSD, client-`<script>`
гидрирует):

```astro
---
import Button from '@labpics/ui-astro/Button.astro';
---
<Button type="accent">Сохранить</Button>
```

`@astrojs/lit` устарел на Astro 5 — поэтому используется ручной рецепт Lit SSR (см.
README пакета).

## Angular — без отдельного пакета

Angular нативно поддерживает кастом-элементы: подключите `CUSTOM_ELEMENTS_SCHEMA`,
импортируйте регистрацию элемента, и используйте `<lab-*>` прямо в шаблоне.

```ts
import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import '@labpics/ui-core/button'; // регистрирует <lab-button>

@Component({
  selector: 'app-save',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<lab-button type="accent" (click)="save()">Сохранить</lab-button>`,
})
export class SaveComponent {
  save() {}
}
```

- **Строковые/булевы оси** — атрибутами: `type="accent"`, `[attr.disabled]="disabled ? '' : null"`.
- **Сложные пропы** (массивы `items`, контролируемые значения) — свойством:
  `[items]="options"` (Angular ставит DOM-свойство при биндинге через `[]`).
- **Кастом-события** — обычным `(event)`: `(checked-change)="onChange($event)"`,
  `(value-change)="onSelect($event)"` (в `$event.detail` — деталь события).
- **SSR (Angular Universal)**: серверный DSD через `@labpics/ui-core/ssr`
  `renderToString(html\`<lab-button>…\`)` + инъекция сырой строкой; на клиенте элемент
  апгрейдится импортом регистрации.

## Регенерация обёрток

Обёртки и манифест выведены из ядра. После правок компонентов ядра:

```sh
pnpm --filter @labpics/adapter-codegen generate
```

Golden-тест (`@labpics/adapter-codegen`) падает, если закоммиченное разошлось с ядром.
