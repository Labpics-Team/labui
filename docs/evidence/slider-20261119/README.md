# Slider: authored web and Compose, 20 ноября 2026

Источник — неизменённый [Lab UI 2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
версия `2423213750570316842`, страница `6467:113820`. Read-only REST и восемь PNG;
Figma Console не использовалась. Профиль `components.json#slider` задаёт геометрию
для Lit, React и Compose; SSR и Vue/Solid/Svelte/Astro получают API из Lit.

| Представление | Авторская геометрия |
| --- | --- |
| Linear `6467:117307` | Дорожка 4, бегунок 12, внутренняя обводка 3. Центр = `max(12, width × fraction) − 6`: заполнение связано с правым краем бегунка. |
| Circular `6467:117329` | Диаметр 96, обводка 4 внутрь, радиус 46. Начало сверху, по часовой стрелке. Два исходных бегунка `[0,p]` перекрываются на 0/100. Невидимый 200 px arc в 0% не задаёт размер. |
| Large `7530:6558` | Высота 56, радиус 16; текст 16/24/500; индикатор 3×16 с отступом 12. Два цвета текста разделены заполнением, промежуточный край прямой. Маска 7×56, layer blur 2 = Gaussian sigma 1. |

Размеры — CSS px при root 16 и dp при native fontScale 1. Три новые роли
`slider-track`, `slider-large-track`, `slider-large-label` добавлены через Colors
Program: прежние близкие роли имели другую прозрачность. Dark и increased contrast
следуют той же программе. Large не принимает диапазон; vertical доступен Linear.

Нативные web `input[type=range]` сохраняют клавиатуру, форму и семантику. Общий
runtime проецирует pointer на авторскую геометрию; горизонтальные RTL стрелки
нормализованы из-за различия Chromium/WebKit. Состояние переживает detach/reparent.
`value` управляется приложением, отклонённый запрос не меняет значение; `null`
освобождает управление. `defaultValue` сохраняется для reset. Шаг отсчитывается
от глобального min; неделимый max не добавляет значение вне сетки. Диапазон хранит
стабильные бегунки без пересечения. Circular сохраняет сторону шва без max→min
скачка; Escape и отменённый pointer возвращают начальное значение. Основание:
[WAI-ARIA Multi-Thumb Slider](https://www.w3.org/WAI/ARIA/apg/patterns/slider-multithumb/).

`compare-*.png` показывают Figma, Chromium и Compose на белом фоне в этом порядке.
`comparison.generated.json` содержит фактическую RGB-разницу, а не обещание
попиксельного совпадения. Сохраняются различия сглаживания и растеризации Geist.
Для сравнения canvas выровнен по целому пикселю независимо от внешних текстовых
строк страницы. Скрипт: `python compare-source.py <directory-with-source-PNGs>`.

`web-*-density-*` и `native-*-density-*` — плотность 1/1,25/2, без заявления о
browser zoom. Отдельные `web-*-font-*` проверяют реальный root 16/20/32 px,
указатель и формы при каждом размере. `native-*-font-*` — системный fontScale
1/1,25/2 и длинные русские подписи; размеры dp сохраняются, Large растёт по строке.
Устаревшие снимки с CSS zoom удалены: WebKit измерял Shadow DOM при нём иначе.

Проверено:

- 6 контрактных тестов, 16 browser-тестов Lit/React, типы всех адаптеров и сборка docs.
- Установленные npm tarballs: пять SSR/hydrated renderer, сохранение DOM и реального
  ввода до hydration, controlled/end callback, fieldset/first legend, внешняя форма,
  submit/reset/cancel, дробный шаг, RTL, диапазон, circular seam/Escape, reparent.
- 9 Compose-тестов в offscreen CPU `ImageComposeScene`: мастера, semantics/range,
  pointer, RTL/keyboard, Escape, отказ controlled, readOnly/disabled, увеличенный
  текст, нулевые ограничения, непрерывные изменения.
- Отдельный Maven consumer `0.1.0-slider-20261120.1`, без source substitution:
  `SliderConsumerTest` изменяет четыре настройки и проверяет видимую сводку при
  fontScale 2. Хеши npm/Maven находятся в `*installed.generated.json`.

Общий docs typecheck остаётся красным на четырёх прежних `possibly undefined`
в `apps/docs/tests/avatar.spec.ts:129–132`; Slider и остальные package typecheck
проходят. Файл Avatar этой работой не менялся.

Web не создаёт idle RAF. Native размывает маленькую alpha-маску 13×62 @1x,
затем перемещает изображение и окрашивает его ролями. Отдельный опыт с временным
счётчиком подтвердил один `rasterizeBlurMask` на прогрев 20 и 120 изменений; счётчик
удалён. `render-performance.json` фиксирует измеренные median/p95 для двух CPU
рендеров на изменение; это локальный опыт, не обещание времени на всех устройствах.

Воспроизведение из корня:

```powershell
pnpm --filter @labpics/ui-core exec vitest run test/slider-contract.test.ts
node apps/docs/tests/slider-packed.mjs
pnpm --filter @labpics/ui-docs exec playwright test slider.spec.ts --project=chromium --project=webkit
$env:JAVA_TOOL_OPTIONS='-Djava.awt.headless=true'
$env:SKIKO_RENDER_API='SOFTWARE'
./native/compose/gradlew.bat -p native/compose :desktopTest --tests pics.lab.ui.SliderRenderTest
```

Maven publish использует `publicationVersion=0.1.0-slider-20261120.1` и отдельный
`publicationRepository`; consumer — тот же `uiVersion/uiRepository`,
`iconsVersion=0.4.0-semantic.6` и Maven Icons repository, без `uiSource/iconsSource`.
Запускается `:desktopTest --tests pics.lab.ui.sample.SliderConsumerTest` из consumer.
Это проверка локально опубликованных Maven-байтов, не публичный выпуск.
Android/iOS-устройства и системные screen readers этим прогоном не покрыты;
окон, NVDA и звука не было.
