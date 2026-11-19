# Подключение компонентов

Примеры рассчитаны на собранный Lab UI workspace и браузерное приложение
с поддержкой импорта CSS. Пакеты версии `0.0.0` пока имеют `private: true`;
для работы из исходников используйте [первый запуск](../tutorials/catalogue.md).
При добавлении приложения в workspace объявите используемые пакеты в его
`dependencies` с версией `workspace:*`.

## Подключить стили

Загрузите семантические цвета, геометрию, движение, тему, тени и материалы
один раз на уровне приложения:

```typescript
import '@labui/colors/contract.css';
import '@labpics/ui-tokens/tokens.css';
import '@labpics/ui-tokens/motion.css';
import '@labpics/ui-core/theme.css';
import '@labpics/ui-core/shadow.css';
import '@labpics/ui-materials/material.css';
```

Цветовой CSS-контракт в этой версии workspace экспортирует пакет
`@labui/colors`; вычислительный движок — отдельный пакет `@labpics/colors`.
Используйте семантические `--lab-*` переменные из контракта для оформления
окружения компонента.

CSS материалов содержит исходные значения поверхностей до запуска JavaScript.
Web Components включают локальные правила внутри Shadow DOM; глобальный импорт
передаёт им значения темы и обслуживает элементы React вне Shadow DOM.

При необходимости подключите [шрифты](../../packages/fonts/):

```typescript
import '@labpics/fonts/fonts.css';
```

## Использовать Web Component

Импорт отдельного компонента регистрирует его custom element:

```typescript
import '@labpics/ui-core/button';
```

После импорта используйте его в HTML:

```html
<lab-button type="accent" kind="fill" size="m">Сохранить</lab-button>
```

`type` задаёт смысл действия, `kind` — оформление, `size` — размер.
`html-type` задаёт тип внутренней HTML-кнопки; по умолчанию это `button`.
Внутренняя кнопка находится в Shadow DOM и не отправляет внешнюю форму
автоматически. Кнопке без видимого текста нужен `aria-label`.
Полный набор свойств и состояний находится на странице Button в каталоге.

Для отправки внешней формы оставьте тип `button` и вызовите
`requestSubmit()` из обработчика нажатия:

```html
<form id="profile">
  <lab-button type="accent" kind="fill">Сохранить</lab-button>
</form>
```

```typescript
const form = document.querySelector('#profile');
const save = form?.querySelector('lab-button');
if (!(form instanceof HTMLFormElement) || !save) {
  throw new Error('Форма profile и её кнопка должны быть смонтированы');
}

const submit = () => form.requestSubmit();
save.addEventListener('click', submit);

export const disposeForm = () => {
  save.removeEventListener('click', submit);
};
```

`requestSubmit()` сохраняет проверку полей и событие `submit`.
При удалении формы вызовите `disposeForm()`, чтобы снять обработчик.

Обработчик связывает нажатие Button с формой. `lab-button` не является
её нативной submit-кнопкой и не управляет отправкой по Enter из полей.
`disabled` и `loading` блокируют нажатия Button. Доступностью полей и допуском
отправки в обработчике `submit` управляет приложение.

## Использовать React

React-пакет рисует обычные DOM-элементы и использует общий контракт компонентов.
Подключите стили приложения из примера выше, затем импортируйте нужный вход:

```tsx
import { Button } from '@labpics/ui-react/button';

export function SaveAction() {
  return (
    <Button type="accent" kind="fill" size="m" htmlType="submit">
      Сохранить
    </Button>
  );
}
```

При клиентском рендеринге стили Button входят в его модуль. Серверный HTML
должен получить стили до JavaScript. Для React Card подключите общую таблицу
на уровне страницы или layout:

```typescript
import '@labpics/ui-materials/material.css';
import '@labpics/ui-core/card.css';
```

Это требуется для любой серверной Card, включая вариант без изображения:
таблица задаёт отступы, типографику и геометрию уже в первом кадре.

Для серверного React Chip также импортируйте статический CSS на уровне страницы
или layout. Сборщик должен включить его в стили, загружаемые вместе с HTML:

```tsx
import '@labpics/ui-core/chip.css';
import { Chip } from '@labpics/ui-react/chip';

export function DesignFilter() {
  return <Chip defaultSelected>Дизайн</Chip>;
}
```

Клиентский модуль Chip добавляет стили после запуска JavaScript. Явный CSS import
сохраняет геометрию и оформление серверного HTML уже до hydration.

Для интерактивного обработчика
используйте `onClick` и обычную границу client-компонента своего фреймворка.
React Button рисует нативный `<button>`, поэтому `htmlType="submit"`
работает непосредственно внутри формы.
В Vue, Svelte, Solid и Astro используйте соответствующий
[пакет привязки](../reference/packages.md) и его публичные входы.

## Выбрать тему и материал

Выбор задаётся на корне приложения или отдельной области:

```typescript
import { setMaterial, setTheme } from '@labpics/ui-core';

setTheme(document.documentElement, 'dark');
setMaterial(document.documentElement, 'acrylic');
```

Для поверхностей Materials подключите его CSS и смонтируйте runtime
один раз в браузере:

```typescript
import '@labpics/ui-materials/material.css';
import { mountMaterialRuntime } from '@labpics/ui-materials';

const disposeMaterials = mountMaterialRuntime();

export function disposeApp() {
  disposeMaterials();
}
```

Вызовите `disposeApp()` при удалении приложения или завершении его
клиентской области.

Поверхности обозначаются классом `lab-material`. Runtime выбирает эффект
по ближайшей области `data-material` и возможностям браузера.
Он также обслуживает краевой progressive blur с атрибутом `data-veil`.
Серверная сборка загружает CSS; runtime монтируется после появления DOM.

Для Lit Card с `slot="media"` подключите также `@labpics/ui-core/card.css`
в статическую таблицу стилей страницы. Этот CSS определяет стык изображения
и Content ещё до регистрации элемента. В отдельном ShadowRoot подключите его
в таблицу стилей этого корня. Lit передаёт внутренние стили через серверный
DSD; общий `material.css` и эти правила слотов должны загружаться вместе с HTML,
а не через позднюю инъекцию клиентского JavaScript.

Значения осей и условия исполнения описаны в
[справочнике тем и материалов](../reference/theme-materials.md).
