# @labpics/ui-svelte

Svelte 5-адаптер LabUI. Тонкие обёртки над Lit web-components `<lab-*>` из
`@labpics/ui-core`. По ADR-0001 (A-prime) родная реализация одна — React; Svelte
_потребляет_ те же кастом-элементы. Обёртка добавляет лишь тонкий биндинг.

Пакет распространяется исходными `.svelte` (компилит ваш билд). Все 27 компонентов
**сгенерированы** из ядра (SSOT).

## Установка

```sh
pnpm add @labpics/ui-svelte @labpics/ui-core svelte
```

`svelte` — peer (`>=5`). Для SSR также нужен `@lit-labs/ssr` (опциональный peer).

## Использование

```svelte
<script lang="ts">
  import { Button } from '@labpics/ui-svelte';
</script>

<Button type="accent" size="l">Сохранить</Button>
```

Пропы — оси компонента (типы из класса ядра). Дефолты задаёт элемент.

### События

Кастом-события — через callback-пропы `onXxx` (kebab → camelCase):

```svelte
<Checkbox onCheckedChange={(e) => (checked = e.detail.checked)} />
<Select onValueChange={(e) => onSelect(e.detail)} />
```

### Слоты

Контент по умолчанию — детьми. Статические именованные слоты — через snippet-пропы
(camelCase-имя слота):

```svelte
<Button>
  {#snippet icon()}<IconSave />{/snippet}
  Сохранить
</Button>
<Dialog>
  {#snippet content()}Тело диалога{/snippet}
</Dialog>
```

Динамические слоты (tabs/accordion) и rich-контент слота, чьё имя совпадает с пропом
(напр. `content` у tooltip), передавайте сырыми light-DOM детьми с атрибутом
`slot="name"`.

## SSR (SvelteKit) — styled first paint без FOUC

Вход `@labpics/ui-svelte/ssr` даёт `renderX(props, slots)` → строка с declarative
shadow DOM; внедряется через `{@html}`:

```svelte
<script lang="ts">
  import { renderButton } from '@labpics/ui-svelte/ssr';
  const dsd = renderButton({ type: 'accent' }, { default: 'Сохранить' });
</script>

{@html dsd}
```

На клиенте элемент апгрейдится импортом обёртки из `@labpics/ui-svelte` (или
регистрации `@labpics/ui-core/<name>`). Общий рецепт SvelteKit — в
[docs/adapters.md](../../docs/adapters.md).
