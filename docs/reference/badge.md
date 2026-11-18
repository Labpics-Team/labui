# Badge

Badge переносит авторскую метку Lab UI v2.1: 15 цветовых семейств, Fill/Tinted и общий недоступный вид. Исходный набор Figma содержит 30 обычных master и два серых disabled master; API поддерживает все 60 сочетаний осей.

- Геометрия задаётся в `packages/tokens/src/components.json`: высота 20 px, отступы 4×8 px, интервал 4 px, знаки 12 px, Geist Medium 12/12 px. Веб переводит размеры в rem; Compose сохраняет геометрию в dp и масштабирует текст в sp.
- `icon` и `icon-end` / `iconEnd` принимают декоративное содержимое. Компонент задаёт размер и цвет, выбор библиотеки знаков остаётся у приложения. Подпись сохраняет доступное значение; Badge не создаёт действие, роль кнопки или остановку Tab.
- Цвета и подпись разрешаются вместе в Colors profile до компиляции штатного Program. Figma Color → Difference → Color Dodge → Color Burn → Screen определяет текст на Fill. У знаков последний слой Normal: на тёмной заливке они слегка тонированы, а текст остаётся белым. Tinted сохраняет разные Linear Burn/Linear Dodge для светлой и тёмной тем; светлая жёлтая метка использует оранжевую подпись.
- Нейтральный Fill инвертирован; Gray Fill остаётся полупрозрачным. Static Tinted использует общий нейтральный оттенок. Disabled использует исходные нейтральные роли и их отдельные значения в четырёх режимах Light/Dark × Normal/Increased Contrast. Общая opacity к компоненту не применяется.
- Lit и React читают одну строку CSS. React поставляет её в своём артефакте, поэтому изменение общего CSS требует сборки обоих пакетов. Vue, Svelte, Solid и Astro выводят свойства и слоты из Lit через генератор.
- Прежние `danger/warning/success/info` нормализуются в `red/orange/green/blue`; `dot` сохранён для совместимости. Авторское значение по умолчанию — `blue`.

На Compose Skia измеряет естественный глиф-бокс Geist выше авторской строки 12 sp. Ограниченный строковый бокс и `wrapContentHeight(unbounded = true)` центрируют глифы, сохраняя высоту 20 dp и место для диакритики в вертикальных отступах. Текст при системном масштабе 200% увеличивает метку до 32 dp.

Источники: [Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1), [W3C Compositing and Blending](https://www.w3.org/TR/compositing-1/), [Compose wrapContentHeight](https://developer.android.com/reference/kotlin/androidx/compose/foundation/layout/wrapContentHeight.modifier). Проверки и изображения: [Badge evidence](../evidence/badge-20261118/README.md).
