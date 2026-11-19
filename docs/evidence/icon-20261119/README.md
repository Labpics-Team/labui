# Публичный Web Icon — 19 ноября 2026

Исходный срез прошёл независимое cold review. Это предварительная квалификация
с локально упакованным `@labpics/icons@0.4.0` из lab-icons `7c3b543`;
на момент проверки npm отдавал 0.2.0. Перед интеграцией выпуска нужно обновить
lockfile по опубликованной 0.4.0 и повторить установленный сценарий без
`LAB_ICONS_TARBALL`. Публичные manifests уже требуют 0.4.0; старый lockfile
намеренно не изображает ещё не состоявшуюся установку из реестра.

`apps/docs/tests/icon-packed.mjs` упаковывает девять LabUI packages и устанавливает
их в отдельный проект. `installed.json` содержит SHA-256 проверенных архивов.
Проверены ESM и поддержанные CJS SSR-входы, external NodeNext types, все четыре
generated SSR-функции, no-JS рисунок, сохранение DOM SVG после upgrade без
ресурса и после hydration, states во время lazy import, symbol replacement,
disconnect/reconnect, Date + IANA, effect controls и ошибки загрузки.

Статический путь с plus: 25 634 байта minified JS вместе с optical packet;
в reachable import graph нет motion, compiler, catalog и чужих символов.
Для 1 и 100 статических Icons: 0 кадров, 0 ResizeObserver, 0 обращений matchMedia.
После перехода listener снят; controls running → pause → resume → finish дают
1 → 0 → 1 → 0 подписок. Отдельное независимое ревью проверило stop → 0.
При удержанном HTTP motion chunk explicit/system reduced-motion немедленно
рисует последнее состояние, снимает подписки и не оживляет старую загрузку.

`icon-render.mjs` проходит настоящий experience в двух темах, 100/125/200%,
на ширине 1000 и 390 px. Одна настройка области задаёт текст 16/20/32 px и Icon
20/25/40 px; screenshots и `render.json` сохраняют результат. Пройдено изменение
уведомлений через Sheet → сохранение → обновлённый знак состояния. Группа
масштаба использует RadioGroup с переносом, чтобы все подписи оставались
видны на мобильном экране при 200%.

Общие проверки: core 91 тест, включая три Icon SSR; tokens 118,
adapter-codegen 32; TypeScript
core/React/docs и dual package builds. Generated adapters получены из core
metadata без отдельных правил для Icon. Полный packet исключён из SSR общей
опцией свойства `resource: true`; Date переносится отражённым ISO-атрибутом.

Повтор:

```sh
node apps/docs/tests/icon-packed.mjs
node apps/docs/tests/icon-render.mjs http://127.0.0.1:4337
```

До публикации Icons первый сценарий принимает путь к проверенному архиву
через `LAB_ICONS_TARBALL`. Браузеры запускаются headless с mute.

Источники: [принятый план Icons](https://github.com/Labpics-Team/agents-config/blob/main/plans/lab-icons/r1.md),
[Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
[Lit hydration](https://lit.dev/docs/ssr/client-usage/).
