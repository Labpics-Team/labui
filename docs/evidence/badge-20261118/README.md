# Badge — 18 ноября 2026

Исходник: [неизменяемая Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1), Badge. Кеши live Figma primitives и semantic aliases сохранены в тестовых fixtures Colors.

- `light.png`, `dark.png`: настоящие Lit и React, все 60 сочетаний осей.
- `mobile.png`: тот же образец при ширине 320 px.
- `orange-comparison.png`, `yellow-comparison.png`: сверху исходный Figma export ×4, снизу рендер Lit ×4. SVG символа взят из Figma только для проверочного образца; Badge не включает геометрию знака.
- `native-light.png`, `native-dark.png`, `native-large-text.png`: offscreen Compose, 30 обычных и два общих disabled master. Квадраты в слотах проверяют точный цвет и размер; это проверочные индикаторы, не авторские иконки.

Веб: 20 px высота, Geist Medium 12/12, 84.5 px ширина с подписью Badge и двумя знаками; Figma округляет ширину master до 85 px. Цвета совпадают с исходной палитрой после предусмотренного Colors Program преобразования в sRGB8. Растеризация шрифтов и округление ширины зависят от рендерера.

Проверены SSR, 120 сравнений Lit/React в Light/Dark, смена роли, семантика, zoom; четыре режима семантических ролей из live Figma; три offscreen Compose сценария с обычным и увеличенным текстом. Нативный путь проверен на Desktop, без запуска видимых окон.
