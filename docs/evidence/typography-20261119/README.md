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
