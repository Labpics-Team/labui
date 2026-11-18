# Источник шрифтов

Geist воспроизводит авторский набор Lab UI. Используется **font Version 1.400**
из официального release tag **1.4.2**, commit
`4d655731f83507f0258ce5541c297b6553d5d081`.

17 ноября 2026 года контуры и метрики этой версии сопоставлены с прямыми
экспортами четырёх семейств Figma: Card, Button, Input, Snackbar. Максимальная
ошибка границ букв после нормализации SVG — 0.018 px. Версия 1.800 меняет
контуры и ширину надписей; это и объясняло остаточное расхождение после
исправления загрузки шрифта. Обе версии содержат полный русский алфавит.

В отдельных инстансах Figma присутствует набор 1.800. В продукте используется
одна версия 1.400 для всех тем и обоих исполнений web/native: смена темы не
меняет шрифт и размеры текста. Исходная Figma не редактируется.

Geist Mono остаётся на прежнем release tag v1.7.2: оснований менять отдельное
семейство в этом исправлении не получено.

| Файл | Источник | SHA-256 |
|---|---|---|
| `fonts/Geist-Variable.woff2` | [Geist 1.4.2](https://raw.githubusercontent.com/vercel/geist-font/4d655731f83507f0258ce5541c297b6553d5d081/packages/next/dist/fonts/geist-sans/Geist-Variable.woff2) | `46525b05bbf4527d263f8624ca7024c7d0dce3c64430267d30c31c6dd3821e4d` |
| `fonts/GeistMono-Variable.woff2` | [Geist Mono v1.7.2](https://github.com/vercel/geist-font/blob/v1.7.2/fonts/GeistMono/webfonts/GeistMono%5Bwght%5D.woff2) | `afaacc4c5fbba89d2ebf7a02dc4070208540874592a5504d57175782fe893101` |

Эти два файла не изменены. Обе вариативные семьи имеют ось `wght` 100–900, default 400;
width/opsz/italic осей у этих файлов нет. Шрифты поставляются локально, без
внешнего запроса при открытии приложения. Лицензия — [SIL OFL 1.1](./OFL.txt),
Copyright © 2023 Vercel совместно с basement.studio.

Система использует прямые начертания. Акцент задаётся весом и цветом;
`font-synthesis: none` в общем слое темы запрещает искусственный наклон.
Наличие отдельного italic у upstream не означает его подключение в LabUI.

При обновлении нужно сверить источник, hash, fvar, кириллицу и реальный набор
рядом с исходными компонентами. Затем обновить файлы, таблицу и машинный pin
в `test/fonts.test.ts`; выполнить тест пакета и браузерную проверку шрифтов.

## Клавишный символ Command

В Geist 1.400 и 1.800 отсутствует `U+2318` (⌘). Экспорт Figma Kbd `6107:8549`
показывает контур **Noto Sans Symbols 2, Version 2.008**: 6 контуров, границы
8.544 × 8.64 px при размере 12 px. Сравнение контуров в этом размере, без
подгонки масштаба, даёт максимальное расстояние между отсчётами 0.00849 px;
у Inter — 0.68614 px, Segoe UI Symbol — 2.14899 px. Все восемь исходных
вариантов Kbd используют только один отсутствующий в Geist символ: ⌘.

[Источник Noto](https://github.com/google/fonts/tree/7af0d90b4d532ffa4b041937b560c6df4e7b1e95/ofl/notosanssymbols2)
закреплён по commit и SHA-256 в `scripts/build-symbols.py`.
[Лицензия](./OFL-NotoSymbols.txt) — SIL OFL 1.1, Copyright 2022 The Noto Project Authors.

`fonts/LabUI-Symbols.woff2` содержит только дополнение ⌘. CSS подключает его
к семейству Geist через `unicode-range: U+2318`; остальные символы продолжает
рисовать исходный вариативный файл. Контур ⌘ фиксирован, синтетического
утолщения нет. Вертикальные метрики дополнения взяты из Geist: разные
исходные метрики Noto не должны сдвигать строку при появлении одной клавиши.

В native дополнение встроено в три статических начертания под внутренним
именем **Lab UI Text**. Это исключает системную подмену в Compose, где список
начертаний `FontFamily` выбирается по весу, а не задаёт цепочку glyph fallback.
Сборка проверяет каждый исходный контур и advance, все исходные Unicode mappings,
shaping-таблицы и метрики строк common/Android-ресурсов. Подсказки Noto удалены: они ссылаются на его
собственные TrueType-программы. Исходные подсказки Geist сохранены.

Для Compose Skia поставляется отдельная производная семья **Lab UI Text Skia**
из `native/compose/src/skikoMain/composeResources/font`. В ней изменены только
внутреннее имя и шесть hhea/OS/2 typo-полей: высота метрик становится равной
`unitsPerEm`, leading — нулю, а сумма ascent + descent сохраняется.
Для закреплённого Geist это 850 / −150 / 0 вместо 920 / −220 / 100.
Win ascent/descent, контуры, advances, hinting и shaping-таблицы сохраняются.
Проверка восстанавливает шесть полей и требует байтового равенства таблиц;
Android продолжает загружать исходную семью без этой поправки.

Это обход подтверждённого поведения Compose 1.12.2 / Skiko 0.150.2:
leading повторно попадает в явный интерлиньяж, а tight-строки получают
естественные внешние метрики. [Исследование и реальные рисунки](../../docs/evidence/native-lineboxes-20261119/README.md)
содержат отрицательный опыт и ограничения. При смене text backend эту
поправку нужно перепроверить тем же render-тестом.

Ресурсы воспроизводятся FontTools 4.68.0 и Brotli 1.2.1:

```sh
python -m pip install fonttools==4.68.0 brotli==1.2.1
python packages/fonts/scripts/build-symbols.py --cache-dir /tmp/labui-font-sources
python packages/fonts/scripts/build-symbols.py --cache-dir /tmp/labui-font-sources --check
```

Источники скачиваются только при пересборке; обычная сборка и открытие продукта
используют локальные ресурсы. Размеры и контрольные суммы производных файлов
собраны в [symbols.json](./symbols.json).

## Округлённые инициалы Avatar

В скрытом letter mark исходного Avatar указан SF Pro Rounded Heavy 800, 14 px.
Поставляемая OFL-замена — **Sunghyun Sans ExtraBold**, самостоятельное семейство;
она не выдаётся за тот же шрифт и не меняет Geist остального интерфейса.
Проверены вес 800, 2793 Unicode mappings, вся кириллица А–я, Ё/ё и реальный набор.

Источник: [Sunghyun Sans](https://github.com/anaclumos/sunghyun-sans/blob/068baca3972cc211f3e606cd2cfca3ec60bba982/fonts/ttf/SunghyunSans-ExtraBold.ttf),
commit `068baca3972cc211f3e606cd2cfca3ec60bba982`, лицензия [OFL](OFL-SunghyunSans.txt).
Native TTF не изменён, SHA-256
`1f34867ceb912e6638d2300eef9cb30261af21b75036292b4b27d303145767a1`.
Web WOFF2 сохраняет исходные контуры и метрики, SHA-256
`7137d6a4ff3b89fee2bf9ba43f329c4be414472f40bd089366a3f8d671fa051f`.

```sh
python packages/fonts/scripts/build-avatar-font.py
```

Пересборка использует FontTools 4.68.0 и Brotli 1.2.1. `--source <TTF>` позволяет
использовать скачанный файл; SHA-256 проверяется до сохранения ресурсов.
