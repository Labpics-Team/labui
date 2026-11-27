# Авторские роли типографики, 19 ноября 2026

Общая `body` раньше получала tracking −0.1328 px из плавной шкалы.
Сохранённый источник задаёт −0.25 px для Regular 16/24 и 0 для Medium 16/24.
Исправление вводит отдельные точные роли и переводит реальные потребители
на их общую web/Compose-проекцию. Версии и байты шрифтов не менялись.

[`source-text.json`](source-text.json) содержит четыре текстовых узла из ранее
сохранённого REST-снимка Figma, версия `2422536133022859436`.
Значение headline −0.33000001311302185 px нормализовано до авторских −0.33 px;
отличие float-представления проверяется отдельно от метрик строки.
Figma в этой работе не открывалась и не изменялась. Это проверка перечисленных
текстовых ролей; причина отдельного прежнего расхождения Accordion здесь
не устанавливается.

## Реальный путь

`TypographyRenderTest` запускает CPU-only `ImageComposeScene` на Windows,
загружает штатные Geist-ресурсы, выводит настоящий `LabChoicebox` и независимый
Regular-образец с параметрами источника. Результат `maxIntrinsicWidth`:

| Масштаб текста | Choicebox | Образец | Строк в Choicebox |
| --- | --- | --- | --- |
| 100% | 652.0 px | 652.0 px | 1 |
| 200% | 1303.0 px | 1303.0 px | 2 |

Проверены также полный Medium label, Headline 20/20/500/−0.33 и сохранность
всех строк. Отдельно прошёл существующий сценарий длинного текста в RTL
при 200%. Рендеры: [100%](native-100.png), [200%](native-200.png).

Headless Chrome проверяет реальные Lit/React Choicebox на существующей
странице `_fixtures/selection.html`. Из computed style description строится
однострочный образец длиной 270 знаков, сравниваемый с независимым стилем
Regular 16/24/−0.25. Оба renderer дали:

| Масштаб текста | Текущая ширина | Образец | Прежняя эвристика |
| --- | --- | --- | --- |
| 100% | 1964.75 px | 1964.75 px | 1996.75 px |
| 200% | 3929.484375 px | 3929.484375 px | 3993.484375 px |

Прежняя ошибка накапливается до 32/64 px. Допуск сравнения целой строки —
0.05 px; Compose — 0.02 px. Это сравнение каждого renderer со своим
авторским образцом, а не обещание одинаковой растеризации разных движков.
Полные [web-метрики](web-metrics.json), [native-метрики](native-metrics.txt).

В [web Lit 100%](web-lit-100.png), [Lit 200%](web-lit-200.png),
[React 100%](web-react-100.png), [React 200%](web-react-200.png)
сохранён стрессовый контейнер исходной проверки шириной 280 px; при 200%
длинные слова переносятся, текст не обрезается. Изображения просмотрены
в полном размере. Они показывают реализацию, а не пиксельное сравнение с Figma.

## Воспроизведение и пакет

```sh
pnpm --filter @labpics/ui-tokens test
pnpm --filter @labpics/ui-tokens typecheck
pnpm --filter @labpics/ui-core... build
pnpm --filter @labpics/ui-react build
pnpm --filter @labpics/ui-vue build
node native/compose/scripts/generate-tokens.mjs --check
node native/compose/scripts/generate-components.mjs --check
native/compose/gradlew.bat -p native/compose :desktopTest --tests pics.lab.ui.TypographyRenderTest --tests pics.lab.ui.SelectionRenderTest.choiceboxDescriptionsAndLongLabelsReflowAtDoubleTextSizeInRtl
pnpm --filter @labpics/ui-docs exec playwright test selection.spec.ts -g "authored description preserves" --project=chromium --workers=1
```

Локальный браузерный прогон использовал установленный Chrome (`channel: chrome`)
в headless-режиме и Vite на `127.0.0.1:4337`: Chromium bundle Playwright
в этой Windows-среде отсутствует. Временная конфигурация после проверки удалена.

`pnpm pack` собрал настоящий tarball tokens. Он установлен в отдельный каталог
без workspace aliases. Прошли ESM и CJS импорты, сравнение экспортируемых
Card/Choicebox profiles с `components.json`, чтение DTCG и `tsc --strict`.
Прежние `fontSize.xl`, `letterSpacing.md` и числовые поля профилей доступны;
новая роль типизирована, использование `xl` как `TextStyleRole` отклоняется.

Модель и границы описаны в [справке типографики](../../reference/typography.md).

## Проверка замечаний независимого ревью

Ревью выявило два пропуска исходной проверки: конфликт авторских имён с
пользовательскими именами fluid-шкалы и жёсткий выбор Medium в native Choicebox.
Оба исправлены до интеграции.

CSS авторских ролей теперь имеет отдельный префикс `--lab-text-<role>-<property>`.
DTCG хранит их только в составной группе `typography`; группы `font-size` и
`font-weight` сохраняют пространство имён настраиваемой шкалы. Тест перебирает
каждую авторскую роль как имя шагов 0/1 и веса 350: генерация проходит,
объявления CSS не повторяются, авторские значения сохраняются. Существующий
конфликт с реальной метрикой `font-size/card-title` по-прежнему отклоняется.

Choicebox label читает все четыре метрики развёрнутого профиля в Compose;
web больше не задаёт tracking литералом 0. Новые проверки реального label:

```sh
native/compose/gradlew.bat -p native/compose :desktopTest --tests pics.lab.ui.TypographyRenderTest.choiceboxLabelUsesTheCompleteResolvedComponentProfile
pnpm --filter @labpics/ui-docs exec playwright test selection.spec.ts -g "choicebox label follows" --project=chromium --workers=1
```

Они прошли с исходной ссылкой `selection.choicebox.$textStyle=body-emphasized`
(500, tracking 0), затем с временной ссылкой `body` (400, tracking −0.25 px).
Для различающего опыта после смены ссылки выполнены `generate-components.mjs`
и сборки tokens → core → react. Compose проверил весь tuple и ширину строки;
Lit и React — все computed text metrics. После опыта исходная ссылка
восстановлена и пакеты пересобраны. Финальная проверка: 118 unit-тестов tokens,
typecheck, шесть browser-сценариев исходного профиля, два offscreen-сценария
`TypographyRenderTest`; с альтернативной ролью отдельно прошли один native
и два browser-сценария.

Dev-сервер между сборками разных профилей необходимо перезапускать: живой
процесс Node может сохранять уже импортированный SSR-модуль с предыдущими
стилями. Первый такой прогон показал старый Medium у Lit; новый процесс после
той же сборки дал Regular на обеих web-привязках. Обычный production-прогон
Playwright запускает собранный сайт новым процессом.

## Интеграция с общим каталогом

После интеграции с Pagination и Accordion прошли общая сборка, typecheck,
Biome, 118 тестов tokens, 12 сценариев Lit/React × Chromium/WebKit и 15
offscreen-проверок Compose (Typography, Selection и Accordion). Native-ресурсы
и каталог регенерированы из объединённого источника.

На собранной странице `experience.html` отдельно проверен фактически рисующий
шрифт, а не только CSS `font-family`: Chromium 140 через
`CSS.getPlatformFontsForNode` сообщает custom Geist для русских заголовка,
caption, подписи поля и кнопки, а также латинских заголовка и значения поля.
SHA-256 загруженного WOFF2 совпадает с `packages/fonts/fonts/Geist-Variable.woff2`:
`46525b05bbf4527d263f8624ca7024c7d0dce3c64430267d30c31c6dd3821e4d`.
Полный [browser readback](russian-font-render.json) сохраняет узлы и веса.
Проверка cmap через FontTools также подтвердила все 64 буквы А–я и Ё/ё
в web Geist/Geist Mono и native Regular. Эти наблюдения исключают fallback
кириллицы для проверенного пути; совпадение метрик Accordion с Figma
по-прежнему не объявляется.
