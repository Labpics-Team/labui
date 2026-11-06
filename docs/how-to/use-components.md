# Подключение компонентов

Примеры рассчитаны на собранный Lab UI workspace и браузерное приложение
с поддержкой импорта CSS. Пакеты версии `0.0.0` пока имеют `private: true`;
для работы из исходников используйте [первый запуск](../tutorials/catalogue.md).
При добавлении приложения в workspace объявите используемые пакеты в его
`dependencies` с версией `workspace:*`.

## Подключить стили

Загрузите семантические цвета, геометрию и стили темы один раз на уровне приложения:

```typescript
import '@labui/colors/contract.css';
import '@labpics/ui-tokens/tokens.css';
import '@labpics/ui-core/theme.css';
```

Цветовой CSS-контракт в этой версии workspace экспортирует пакет
`@labui/colors`; вычислительный движок — отдельный пакет `@labpics/colors`.
Используйте семантические `--lab-*` переменные из контракта для оформления
окружения компонента.

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
Для отправки формы задайте `html-type="submit"`; по умолчанию кнопка
имеет поведение `button`. Кнопке без видимого текста нужен `aria-label`.
Полный набор свойств и состояний находится на странице Button в каталоге.

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

Стили самого Button входят в его модуль. Для интерактивного обработчика
используйте `onClick` и обычную границу client-компонента своего фреймворка.
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

// При удалении приложения или завершении его клиентской области:
disposeMaterials();
```

Поверхности обозначаются классом `lab-material`. Runtime выбирает эффект
по ближайшей области `data-material` и возможностям браузера.
Он также обслуживает краевой progressive blur с атрибутом `data-veil`.
Серверная сборка загружает CSS; runtime монтируется после появления DOM.

Значения осей и условия исполнения описаны в
[справочнике тем и материалов](../reference/theme-materials.md).
