# Авторский Switch

Источник: [Figma Switch 4111:884](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/?node-id=4111-884), версия `2422536133022859436`. Figma не изменялась. Геометрия, типографика, paints, четыре слоя тени, состояния и пути вырезов читаются из `packages/tokens/src/components.json`. Общий `switchCss` и публичный LabMotion исполняются Lit и React; Vue/Solid/Svelte/Astro получают обновлённые обёртки из анализа ядра.

Рендеры Chromium, DPR 2, Geist: [светлый](light.png), [тёмный](dark.png), [Figma](figma.png). Размеры S/M/L — 28×16, 36×20, 44×24 при корневом шрифте 16 px. [Lit](lit-320.png) и [React](react-320.png) показывают длинную русскую подпись при ширине окна 320 px и корневом шрифте 32 px. Текст остаётся целиком доступен; узкая область переносит длинные слова.

Проверки 18 ноября 2026:

- 52 Playwright проверки Chromium/WebKit: нативные формы, required, reset и его обновляемое начальное значение, disabled fieldset, внешний form/label и смена текста подписи, controlled accept/reject, Space, имена, размеры и взаимодействия, темы, прозрачный знак, 320/390 px при 200%, непрерывность Motion и reduced motion.
- Настоящий DSD без JavaScript: OFF/ON дают правильный `input.checked`, имя icon-only сохраняется, ширина M равна 36 px. В Lit SSR используется только булевый `?checked`; запись DOM property выполняется после обновления клиента.
- 6 core SSR-проверок, 2 React ESM/CJS server-render проверки, 6 проверок размеров токенов, 9 adapter golden/shared проверок. Core/React/docs build и typecheck, scoped lint — PASS.
- Независимый агент сопоставил все 108 авторских вариантов с первичными Figma nodes и обоими web-исполнениями; размеры, cutout, paints, тени и набор совпали. Проверены отменённый reset, invalid requestSubmit, disposal/reconnect Motion и внешние подписи.

Контракт формы: `checked-change` / `onCheckedChange` сообщают намерение пользователя. React `checked` и Lit `controlled` позволяют приложению принять значение. `defaultChecked` задаёт исходное значение и следующий reset; обновление defaults сохраняет текущий ввод. Reset не создаёт событие изменения. В React сверка после доверенного reset выполняется в следующем task: microtask может пройти до стандартного действия браузера.

Основание семантики: [WAI-ARIA Switch Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/switch/). Checkbox предоставляет нативный ввод; FACE связывает Lit с внешней формой. Пустые слоты подписи не создают отдельного flex-блока и не меняют размер после hydration. Иконка автора — реальное отверстие в бегунке; custom icon-on/off сохраняют свой контент.
