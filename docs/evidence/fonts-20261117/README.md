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

До смены версии HTTP-ответ WOFF2 и файл пакета имели один SHA-256:
`2ffebe993e969069a9789d15164b7715d42491b5835516c5e3b935d5f81b05f1`.
Внутренняя версия была 1.800, ось wght 100–900, default 400. Номер исходного
релиза — v1.7.2. Native static Geist также имеет версию 1.800; различие этих
двух номеров не означает несовместимые шрифты.

`tests/fonts.spec.ts` проверяет фактически отрисованный шрифт шести страниц.
Отрицательный опыт блокирует WOFF2: CSS по-прежнему называет Geist, но проверка
обнаруживает системный шрифт. Обе проверки прошли на production preview.

Второй дефект установлен по прямым SVG outlines и HarfBuzz: Card, Button,
Input и светлый Snackbar используют контуры Geist 1.400. Максимальная ошибка
границ букв этой версии после нормализации тесного SVG viewport — 0.018 px;
это сравнение границ, не полное расстояние между контурами. Сырые экспорты,
числа и изображение сравнения сохранены рядом. OpenType-настройки master
пустые; ранняя гипотеза отключённого кернинга отвергнута.

В web/native выбран единый авторский Geist 1.400 из официального tag 1.4.2.
Все 66 русских букв присутствуют. Тёмный Snackbar в Figma содержит иной набор,
совместимый с 1.800; подмена версии по теме не вводится. Сам макет не менялся.
Текущий WOFF2 SHA-256:
`46525b05bbf4527d263f8624ca7024c7d0dce3c64430267d30c31c6dd3821e4d`.
После замены браузерная ширина Snackbar стала 347.734 px вместо 344.141 px;
Figma master имеет ширину 349 px с округлёнными HUG-областями.

На production preview прошли 54 проверки Card, Snackbar, первого сценария и
фактического шрифта. Ещё 2 теста CDP явно пропущены в WebKit; шесть проверок
бинарников/fonts.css и Node ESM/CJS SSR также прошли.

Источники: [Geist](https://github.com/vercel/geist-font),
[CDP rendered fonts](https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-getPlatformFontsForNode),
[OpenType в Figma](https://developers.figma.com/docs/plugins/api/properties/TextNode-opentypefeatures/).
