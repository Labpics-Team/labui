# Textarea

Textarea использует нативный многострочный редактор и общую с Input прозрачную
рамку с разрывом под подпись. Источник — [Lab UI v2.1, Input & Textarea / Textarea](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1).
Исходный файл изучен без изменений 18 ноября 2026 года: 13 вариантов
Default / Entered / Active / Danger / Warning / Success × hover и Disabled.
У источника одна геометрия; `size=s/l` — существующие варианты плотности API,
которые используют типографику семейства Input.

При `size=m`, `rows=3`, масштабе 100% рамка имеет высоту 112 и радиус 12,
текст Geist 400 16/24, подпись Geist 500 14/12, helper Geist 500 12/12.
Подпись находится на 8 выше верхнего края, текст начинается в (20, 16),
helper — через 8 после рамки, с горизонтальным отступом 4. При переносе
подписи поле растёт по потоку CSS; подпись не перекрывает текст и не закрывает
материал цветной подложкой. Длинные подписи не сокращаются.
Active использует синюю роль `--lab-border-focus`; при фокусе Danger, Warning
и Success сохраняют собственный цвет рамки.

Геометрия живёт в `packages/tokens/src/components.json`; единый CSS —
`packages/core/src/components/field/outlined-styles.ts`. Lit включает его
в Shadow DOM, React получает тот же `@labpics/ui-core/input.css` при импорте.
`part=field/frame/label/control/helper/error` остаются доступными у Lit.
Compose использует `LabInput(singleLine = false)` с тем же профилем Textarea;
однострочный `LabInput` сохраняет профиль Input.

## Ввод и формы

`value`, `rows`, `name`, `required`, `readonly`, `disabled`, `minlength`,
`maxlength`, `autocomplete` передаются нативному textarea. React использует
`readOnly`, `minLength`, `maxLength`; остальные HTML-атрибуты передаются
через props. Для контролируемого React-поля применяются `value` и
`onValueChange`; для неконтролируемого — `defaultValue`.

Lit участвует в `FormData` через `ElementInternals`; disabled fieldset
исключает значение из отправки. `form.reset()` возвращает исходное значение,
`formStateRestoreCallback` восстанавливает состояние истории браузера.
Readonly остаётся доступным для фокуса и отправки, но исключается из проверки
ограничений. Ошибка `invalid + error` задаёт нативную custom validity и
связи ARIA; одно `invalid` без сообщения не создаёт пустого объявления.
Enter добавляет строку. Компонент не перехватывает выделение и IME.

`autoResize` / `auto-resize` растит и уменьшает редактор до содержимого,
сохраняя минимум `rows`. При поддержке `field-sizing: content` размеры
вычисляет браузер. Совместимый fallback измеряет `scrollHeight` только при
изменении текста, ширины или типографики; изменение высоты не запускает
новый цикл измерений. Поздняя загрузка шрифта отслеживается через невидимый
образец с той же шириной и типографикой: [WebKit может не выдавать события](https://bugs.webkit.org/show_bug.cgi?id=305470)
`FontFaceSet` даже для обычного CSS `@font-face`. Образец создаётся только
для fallback autoResize; его собственные обновления не добавляют замеров.
Отключение autoResize возвращает ручной resize, удаляет образец и снимает
наблюдение. Нативный `field-sizing` не создаёт дополнительного DOM.

## Серверный рендеринг

Vue, Solid, Svelte и Astro используют один `@labpics/ui-core/ssr`. В Lit SSR
4.1 `.value` textarea не сериализуется ([upstream #4915](https://github.com/lit/lit/issues/4915)).
Специальный `ElementRenderer` добавляет только экранированный исходный текст
в единственный пустой native textarea. Клиентский template и hydration markers
не меняются; значения не становятся динамическими static-html templates.
Правка пользователя до гидратации сохраняется; reset возвращает серверное
исходное значение. Связи label/helper/error сохраняют серверные идентификаторы
независимо от порядка рендеров на сервере и клиенте.
Вставки `</textarea>`, амперсанды и первый перевод строки сохраняются как текст.
CRLF и CR нормализуются в LF, как при присвоении нативного `textarea.value`,
включая первый кадр Lit и React до загрузки JavaScript.
Если форма создаётся собственным SSR shell, подключите `@labpics/ui-core/tokens.css`,
семантическую палитру и `@labpics/ui-core/input.css` в его stylesheet, чтобы
React-поле было оформлено до загрузки JavaScript.

Проверки: `apps/docs/tests/textarea.spec.ts` (Chromium/WebKit),
`packages/core/test/textarea-ssr.test.ts`, а также
`node apps/docs/tests/textarea-packed.mjs` после сборки пакетов. Последняя
устанавливает архивы вне monorepo и проверяет четыре SSR-адаптера и React
до JavaScript, после гидратации, редактирования и reset. Рендеры и запись
проверки находятся в `docs/evidence/textarea-20261118`.

Основание нативного поведения — [HTML textarea](https://html.spec.whatwg.org/multipage/form-elements.html#the-textarea-element)
и [CSS field-sizing](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/field-sizing).
