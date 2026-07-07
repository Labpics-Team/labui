# @labpics/ui-vue

Vue-адаптер LabUI. Тонкие обёртки над Lit web-components `<lab-*>` из
`@labpics/ui-core`. По ADR-0001 (A-prime) родная реализация одна — React; Vue
_потребляет_ те же кастом-элементы, а не переписывает их. Разметка, стили, a11y и
поведение живут один раз в ядре — обёртка добавляет лишь тонкий Vue-биндинг
пропов/событий/слотов.

Все 27 компонентов **сгенерированы** из ядра (единый манифест — SSOT), поэтому API
не дрейфует от Lit- и React-версий.

## Установка

```sh
pnpm add @labpics/ui-vue @labpics/ui-core vue
```

`vue` — peer (`>=3.4`). Для SSR также нужен `@lit-labs/ssr` (опциональный peer).

## Использование

Импорт обёртки тянет регистрацию элемента за собой — отдельного шага настройки нет.

```vue
<script setup lang="ts">
import { Button } from '@labpics/ui-vue';
// или per-component (tree-shaking): import { Button } from '@labpics/ui-vue/button';
</script>

<template>
  <Button type="accent" size="l" @click="save">Сохранить</Button>
</template>
```

Пропы — оси компонента (типы взяты прямо из класса ядра). Дефолты задаёт сам
элемент, дублировать их не нужно.

### События

Кастом-события элемента доходят обычным синтаксисом `@event`:

```vue
<Checkbox @checked-change="(e) => (checked = e.detail.checked)" />
<Select @value-change="(e) => onSelect(e.detail)" />
```

### Слоты

Именованные слоты — через `#name`; контент по умолчанию — обычным слотом:

```vue
<Button>
  <template #icon><IconSave /></template>
  Сохранить
</Button>
<Dialog>
  <template #content>Тело диалога</template>
</Dialog>
```

Динамические слоты (tabs/accordion, ключ = значение элемента) и любые именованные
слоты форвардятся генерически.

### Сырое использование `<lab-*>` в шаблоне

Если пишете элементы напрямую (не через обёртки), скажите компилятору Vue, что
`lab-*` — кастом-элементы:

```js
// vite.config.js
vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('lab-') } } });
```

Для обёрток (render-функции) это НЕ требуется.

## SSR (Nuxt) — styled first paint без FOUC

Глубокий SSR web-компонентов — свойство `@lit-labs/ssr`. Вход `@labpics/ui-vue/ssr`
даёт эргономичные `renderX(props, slots)` → строка с declarative shadow DOM;
внедряется через `v-html`:

```vue
<script setup lang="ts">
import { renderButton } from '@labpics/ui-vue/ssr';
const dsd = renderButton({ type: 'accent' }, { default: 'Сохранить' });
</script>

<template>
  <div v-html="dsd"></div>
</template>
```

На клиенте элемент апгрейдится импортом обёртки из `@labpics/ui-vue` (или
регистрации `@labpics/ui-core/<name>`). Общий рецепт Nuxt — в
[docs/adapters.md](../../docs/adapters.md).
