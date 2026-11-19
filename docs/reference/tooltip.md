# Tooltip

Tooltip добавляет краткое описание к существующему control. Он не заменяет доступное имя и не содержит интерактивных элементов.

```tsx
<Tooltip content="Сохранено в вашей библиотеке" type="neutral" placement="top">
  <Button>Библиотека</Button>
</Tooltip>
```

```html
<lab-tooltip content="Сохранено в вашей библиотеке" placement="top">
  <lab-button>Библиотека</lab-button>
</lab-tooltip>
```

```kotlin
LabTooltip("Сохранено в вашей библиотеке") { trigger ->
    LabButton("Библиотека", {}, trigger)
}
```

React принимает один native control или компонент, передающий ref на него; сохраняет ref потребителя в React 18 и ref cleanup в React 19. Lit использует native control либо `LabButton.interactionTarget`. Обычный текст остаётся допустимым: web делает его фокусируемым текстом. SSR и hydration сохраняют одну структуру и один control.

## Авторский контракт

Figma `6203:2958`, версия `2423213750570316842`: Neutral, Inverted, Accent; восемь положений × три типа. Geist Body 16/24/−0.25, padding 12, radius 12 и smoothing 0.6. Поверхности solid; эффекты — четыре слоя авторской XL-тени. Neutral использует bg-tertiary: белый в light, #242426 в dark. Tail Chevron хранит исходный Bézier-контур 28×8; Bubble сохраняет две исходные фигуры 17×15 со смещением x=6 в опоре 28×8. Профиль и пути находятся в `components.json`, native-пути компилируются заранее. Контур тела растягивает только прямые участки: углы сохраняют геометрию.

Размер M авторский. S/L — совместимые расширения web API. Ограничение ширины 352 и промежуток до control 4 — правила адаптации к реальному содержимому. На границах viewport меняется фактическая сторона и положение хвоста. RTL меняет start/end.

## Поведение и границы

Общий web runtime использует Zag для задержек и намерения, Floating UI — для положения, manual popover — для top layer. Плавающая поверхность сохраняет DOM-предков и локальные токены темы, работает в dialog и выходит из overflow/transform предков. Наблюдение размеров и положения работает только при открытой подсказке; закрывание и disconnect снимают его вместе с contour runtime.

Keyboard focus открывает сразу, hover — через 400 ms. Указатель можно перевести на текст; подсказка остаётся открытой, пока фокус или hover относится к ней. Escape закрывает только подсказку и сохраняет фокус. Обычный touch на web остаётся действием control. Compose использует Foundation BasicTooltipBox для mouse hover, long press, popup и взаимного исключения; popup не забирает фокус. Доступное long-press действие содержит текст пояснения. Entrance использует общий Lab Motion и reduced motion.

`aria-describedby` дополняет существующие описания. Между разными shadow roots ID-ссылка не разрешается: runtime создаёт скрытый описательный текст в root настоящего control. Текст существует только на время подключения Tooltip, а отношение — на время открывания. Chromium accessibility tree проверяет описание внутренней Lit-кнопки; проверки также проходят в WebKit. Это явная часть границы, а не предположение о том, что DOM-наследование означает ARIA-наследование.

Источники: [неизменяемая Figma](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2?node-id=6203-2958), [APG Tooltip](https://www.w3.org/WAI/ARIA/apg/patterns/tooltip/), [Popover API](https://developer.mozilla.org/en-US/docs/Web/API/Popover_API/Using), [Floating UI](https://floating-ui.com/docs/computePosition), [Foundation BasicTooltipBox](https://developer.android.com/reference/kotlin/androidx/compose/foundation/BasicTooltipBox.composable).
