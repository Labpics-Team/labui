# Alert

Alert сообщает о важном событии, сохраняет текущий фокус и остаётся видимым до
закрытия. Макет задаёт Neutral/Danger и Quantity 1/2/3. Danger меняет ведущую
иконку; смысл срочности задаётся отдельно через `announcement`.

Источник: [Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
страница Alert, прочитана 19 ноября 2026. Поведение объявления сверено с
[WAI APG Alert](https://www.w3.org/WAI/ARIA/apg/patterns/alert/).

`packages/tokens/src/components.json#alert` — общий источник геометрии. Передний
слой Elevated: radius 24, padding 16, интервал до закрытия 24, иконка и закрытие
24. Между иконкой и Content — 4, внутри Content слева — ещё 4. Заголовок
использует общую роль body-emphasized, описание — body. Цвета: label-primary,
label-secondary, label-danger и border-base. Внутренняя граница имеет толщину 1.
Стопка добавляет по 8 высоты: Base с отступом 24 и opacity .76, затем Muted
с отступом 48 и opacity .52; нижние радиусы 8. В обоих renderers это реальные
поверхности общего material renderer. Прозрачность, тема и масштаб независимы.

```tsx
<Alert heading="Файл не сохранён" description="Проверьте подключение и повторите сохранение."
  type="danger" announcement="assertive" open={visible} onDismiss={() => setVisible(false)} />
```

Lit: `@labpics/ui-core/alert`; React: `@labpics/ui-react/alert`. Остальные web
привязки выводятся из Lit автоматически. Heading и description — текст.
`showIcon=false` скрывает ведущий знак, `icon` slot/React node заменяет его.
Lit поддерживает `show-icon="false"` и `open="false"` даже в SSR. Close всегда
остаётся нативной кнопкой с локализуемым `closeLabel`.

По умолчанию web Alert закрывает себя. React `open` и Lit `controlled` передают
решение приложению: обработчик `onDismiss`/`dismiss` получает только запрос.
`preventDefault()` сохраняет неконтролируемое уведомление. Enter и Space работают
как у обычной кнопки; Escape не перехватывается глобально. После удаления
уведомления, в котором был фокус, web возвращает его к доступному прежнему
контролу. Появление уведомления само по себе не меняет фокус.

`quantity` — видимая глубина, ограниченная тремя, а не хранилище сообщений.
При нескольких сообщениях приложение сохраняет очередь и после закрытия
подставляет следующий текст с новым `notificationKey`; последняя запись меняет
`open` на false. Декоративные слои скрыты от accessibility tree. Live region
объявляет только заголовок и описание, без числа слоёв и подписи закрытия.
`announcement="polite"` используется по умолчанию; для срочного события есть
`assertive`. Смена только темы, материала или глубины не повторяет объявление.
У компонента нет таймера, автоматической очереди, portal или фонового RAF.

```kotlin
LabAlert("Файл не сохранён", onDismiss = { visible = false },
    open = visible, description = "Проверьте подключение.",
    type = LabAlertType.Danger, material = LabMaterial.Acrylic)
```

Compose использует `LabText`, `Icon` и `LabSurface` внутри `LabTheme`/`LabScene`.
Видимость всегда задаёт приложение. `restoreFocus` принимает FocusRequester
контрола возврата; он используется при активации закрытия с фокусом.
Произвольная иконка получает цвет и размер через LabAlertIconScope. Увеличение
шрифта переносит текст и увеличивает высоту; фиксированная высота не задаётся.

Для читаемой строки оставлено 12 em описания. Если места меньше, иконка и
закрытие занимают верхний ряд, а текст получает всю ширину под ними. Это решение
адаптации в `alert.reflow.minContentEm`; исходная композиция 450×80 сохраняется
при обычном размере текста. Web использует container query, Compose выбирает
расположение во время измерения без пересоздания кнопки закрытия.

Размер 450 из master также задаёт intrinsic contribution web-контейнера и
ширину Compose при неограниченных входных constraints. Поэтому flex, grid и
shrink-to-fit родители получают полезный размер; заданная приложением доступная
ширина продолжает ограничивать Alert. Изменение размеров сохраняет фокус.
Основание проверки адаптации: [W3C Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow).
