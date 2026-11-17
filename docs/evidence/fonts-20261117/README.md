# Загрузка Geist

17 ноября Chromium CDP `CSS.getPlatformFontsForNode` показал Segoe UI / Segoe UI
Semibold в Card, хотя computed `font-family` начинался с Geist. На странице не
было ни запроса WOFF2, ни объявления `@font-face`. Общий стиль primitives-demo
используется также Badge, Avatar, Kbd, Loader и Progress. Главная страница и
шаблон каталога отдельно задавали system-ui.

Страницы теперь подключают `foundation.css`: шрифты, цвет, размерные токены и
общий слой темы загружаются вместе. Основной текст использует Geist, код —
Geist Mono. Браузер после исправления подтвердил custom Geist в Card, в том
числе для кириллицы. Настоящее Medium задаётся весом 500.

HTTP-ответ WOFF2 и файл пакета имеют один SHA-256:
`2ffebe993e969069a9789d15164b7715d42491b5835516c5e3b935d5f81b05f1`.
Внутренняя версия — 1.800, ось wght 100–900, default 400. Номер исходного
релиза — v1.7.2. Native static Geist также имеет версию 1.800; различие этих
двух номеров не означает несовместимые шрифты.

`tests/fonts.spec.ts` проверяет фактически отрисованный шрифт шести страниц.
Отрицательный опыт блокирует WOFF2: CSS по-прежнему называет Geist, но проверка
обнаруживает системный шрифт. Обе проверки прошли на production preview.

Сравнение настроек набора со светлым и тёмным Snackbar в Figma продолжается
отдельно. Этот фикс доказывает загрузку правильного файла, а не полное
совпадение всех метрик Figma.

Источники: [Geist](https://github.com/vercel/geist-font),
[CDP rendered fonts](https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-getPlatformFontsForNode),
[OpenType в Figma](https://developers.figma.com/docs/plugins/api/properties/TextNode-opentypefeatures/).
