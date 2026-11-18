# Lab UI Text

Три начертания основаны на Geist font Version 1.400 из
[vercel/geist-font tag 1.4.2](https://github.com/vercel/geist-font/tree/4d655731f83507f0258ce5541c297b6553d5d081/packages/next/dist/fonts/geist-sans),
commit `4d655731f83507f0258ce5541c297b6553d5d081`.
К каждому добавлен отсутствующий `U+2318` (⌘) из Noto Sans Symbols 2,
Version 2.008, с рисунком клавиши из Figma. Все исходные контуры, advances,
shaping-таблицы и метрики строки Geist сохранены и проверяются при пересборке.
Имена ресурсов `geist_regular/medium/semibold` сохранены; внутреннее имя
производного шрифта — Lab UI Text.

| Ресурс | Исходное начертание | Вес |
| --- | --- | --- |
| geist_regular.ttf | Geist-Regular.ttf | 400 |
| geist_medium.ttf | Geist-Medium.ttf | 500 |
| geist_semibold.ttf | Geist-SemiBold.ttf | 600 |

Источники, лицензии, причина дополнения и команда пересборки описаны в
[общем provenance](../../../../../../packages/fonts/PROVENANCE.md).
SHA-256 и размеры производных ресурсов находятся в
[symbols.json](../../../../../../packages/fonts/symbols.json).
Лицензии Geist и Noto — `OFL.txt` и `OFL-NotoSymbols.txt` рядом с ресурсами.

Одна версия действует во всех темах и на всех платформах. Основание выбора — сопоставление
SVG-контуров Snackbar, Card, Button, Input и полное покрытие русского алфавита:
[исследование](../../../../evidence/fonts-20261117/README.md).
