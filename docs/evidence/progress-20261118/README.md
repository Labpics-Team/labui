# Loader и Progress — 18 ноября 2026

Проверены 4 мастера Loader, 5 Linear progress и 10 Circular progress из
[Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1).
Figma оставалась read-only. Поля источника и оригинальные PNG сохранены в
[native evidence](../../../native/compose/evidence/progress-20261118/README.md).
API и расширения размеров описаны в [справке](../../reference/progress.md).

## Изображение

Рендер снят из production build с загруженным Geist 1.400 и reduced motion.
Атласы содержат все авторские состояния:

- Lit: [светлая](lit-light-100.png), [тёмная](lit-dark-100.png), [200% и RTL](lit-dark-200-rtl.png).
- React: [светлая](react-light-100.png), [тёмная](react-dark-100.png).
- Детали 3×: [Loader Lit](lit-loader-medium-75-3x.png), [Loader React](react-loader-medium-75-3x.png),
  [Circular Lit](lit-circular-medium-25-3x.png), [Circular React](react-circular-medium-25-3x.png),
  [Circular WebKit](webkit-circular-medium-25-3x.png).

Для попиксельной сверки компонент размещён в целых координатах и композитится
на белом фоне. Средняя абсолютная ошибка RGB относительно Figma:
Loader 1,83/255 в обоих web-рендерах; Circular 0,45/255 в Chromium и 1,44/255
в WebKit. [Полные числа и образцы градиента](comparison.json).
Цвета и геометрия дуг совпадают; внутренние точки градиента Loader отличаются
не более чем на четыре уровня RGB.

Проверка подписи обнаружила, что обычный центрированный line box поднимал
цифры на 1 CSS px относительно Figma. Изолированный процент теперь использует
`text-box: trim-both cap alphabetic`: его cap-height и baseline задают центр.
Чёрные границы текста Chromium совпадают с оригиналом; в WebKit верх совпадает,
нижний край отличается на два физических пикселя при 3×. Произвольных offset
и изменений исходного шрифта нет. См. [CSS text-box](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/text-box).

## Поведение

Полный прогон Loader/Progress — 34/34 в Chromium и WebKit, 10,2 с.
После финального изменения типографики повторены все 18 сценариев авторского
набора в обоих браузерах: 18/18, 8,5 с. Проверены реальные значения и диапазоны,
zero/unknown, смена формы, пропорция и RTL, обе темы, 200%, SSR из собранного
Vue adapter, гидрация и первый кадр без JavaScript. Движение проверяется по
промежуточным кадрам Lit/React, остановке reduced motion и повторному подключению.
Любое событие motion-error завершает авторский сценарий ошибкой.

Core: 48 тестов; генератор: 32; адаптеры: Astro 45, Vue 9, Solid 9, Svelte 8;
React server imports: 4; документация: 17. Typecheck и build затронутых пакетов,
adapter generate --check, catalog check с двумя независимыми исходными caches
прошли. Compose — 10 тестов, 3,19 с CPU; отдельные результаты и команды находятся
в native evidence. Окна, системная озвучка и screen reader не запускались.

Независимое ревью привело к проверенным исправлениям: Lit возобновляет движение
после reconnect; Compose центрирует локальный viewBox в прямоугольной области;
переход к unknown отменяет прежнюю численную анимацию. Ширина неизвестной полосы
и пределы её движения производятся из одной доли общего профиля.

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = 'D:/AgentWork/.playwright-browsers'
$env:PW_PORT = '4338'
pnpm --filter @labpics/ui-docs exec playwright test `
  progress-author.spec.ts progress.spec.ts loader.spec.ts `
  --project=chromium --project=webkit --workers=2
```

Первичные контракты: [WAI-ARIA range properties](https://www.w3.org/WAI/ARIA/apg/practices/range-related-properties/),
[Lab Motion API](https://github.com/Labpics-Team/lab-motion/blob/main/docs/api.md).
