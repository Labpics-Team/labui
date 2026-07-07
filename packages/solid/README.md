# @labpics/ui-solid

Solid-адаптер LabUI. Тонкие обёртки над Lit web-components `<lab-*>` из
`@labpics/ui-core`. По ADR-0001 (A-prime) родная реализация одна — React; Solid
_потребляет_ те же кастом-элементы. Обёртка добавляет лишь тонкий биндинг.

Обёртки написаны на рантайм-примитивах Solid (без JSX), поэтому пакет — чистый TS и
компилятор Solid для него не нужен; ваш собственный JSX (`<Button/>`) компилит ваш
билд. Все 27 компонентов **сгенерированы** из ядра (SSOT).

## Установка

```sh
pnpm add @labpics/ui-solid @labpics/ui-core solid-js
```

`solid-js` — peer (`>=1.8`). Для SSR также нужен `@lit-labs/ssr` (опциональный peer).

## Использование

```tsx
import { Button } from '@labpics/ui-solid';
// или per-component: import { Button } from '@labpics/ui-solid/button';

<Button type="accent" size="l">Сохранить</Button>;
```

Пропы — оси компонента (типы из класса ядра). Дефолты задаёт элемент.

### События

Кастом-события — через типизированные обработчики `onXxx` (kebab → camelCase):

```tsx
<Checkbox onCheckedChange={(e) => setChecked(e.detail.checked)} />
<Select onValueChange={(e) => onSelect(e.detail)} />
```

### Слоты

Контент передаётся детьми. Именованные слоты кастом-элемента — детьми с атрибутом
`slot="name"`:

```tsx
<Button>
  <span slot="icon"><IconSave /></span>
  Сохранить
</Button>
<Dialog>
  <div slot="content">Тело диалога</div>
</Dialog>
```

### Сырое использование `<lab-*>` в TSX

Обёртки типизированы. Если пишете элементы напрямую, augment-ните JSX Solid:

```ts
declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'lab-button': JSX.HTMLAttributes<HTMLElement>;
    }
  }
}
```

## SSR (SolidStart) — styled first paint без FOUC

Вход `@labpics/ui-solid/ssr` даёт `renderX(props, slots)` → строка с declarative
shadow DOM; внедряется через `innerHTML` (сырая вставка, НЕ `textContent`):

```tsx
import { renderButton } from '@labpics/ui-solid/ssr';
const dsd = renderButton({ type: 'accent' }, { default: 'Сохранить' });

<div innerHTML={dsd} />;
```

На клиенте элемент апгрейдится импортом обёртки из `@labpics/ui-solid` (или
регистрации `@labpics/ui-core/<name>`).
