# Avatar

`lab-avatar`, React `Avatar` и Compose `LabAvatar` представляют человека или
команду: готовый портрет → выбранный fallback. Изображение появляется только
после успешной загрузки и декодирования; ошибка и устаревший ответ предыдущего
URL сохраняют fallback. Web повторно проверяет cached image после hydration.

```tsx
<Avatar name="Даниил" initials="Д" color="blue" status="online" src={photoUrl} />
<Avatar name="Команда продукта" fallback="texture" color="purple" />
```

```kotlin
LabAvatar(name = "Даниил", initials = "Д", color = LabAvatarColor.Blue,
    status = LabAvatarStatus.Online, src = photoUrl)
```

`name` — полное доступное имя, `initials` — независимая видимая надпись до двух
графем. Без `initials` берутся первые графемы первого и последнего слова.
Пустой `initials` или `fallback="texture"` выбирает текстуру. Пустое имя
объявляется как «Аватар». `decorative` скрывает весь компонент от доступности,
когда соседний текст уже передаёт имя и статус. Компонент не получает фокус.

Имя и присутствие объединены в один образ: «Даниил, В сети». `statusLabel`
(HTML `status-label`) заменяет русскую подпись статуса для локализации.
Внутренние изображения, буквы и точка не объявляются по отдельности.

## Геометрия и источник

Исходник — [Avatar 6107:10719](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2/?node-id=6107-10719).
В Figma авторский размер 32×32 px; S=24 и L=48 — пропорциональные расширения.
Единственный профиль геометрии и семантических цветов —
[`components.json#avatar`](../../packages/tokens/src/components.json).
Генератор производит Compose metrics и enums, web читает профиль напрямую.

| Размер | Диаметр | Инициалы / строка | Точка / зазор |
|---|---:|---:|---:|
| S | 24 | 10.5 / 9 | 6 / 1.5 |
| M | 32 | 14 / 12 | 8 / 2 |
| L | 48 | 21 / 18 | 12 / 3 |

Зазор — прозрачный вырез в круге, а не окрашенное кольцо. В RTL точка и вырез
переносятся вместе. Web масштабируется через rem; Compose увеличивает круг
с текстовым fallback при системном fontScale > 1, сохраняя геометрию при
последующей загрузке фото.

Десять цветов: red, orange, yellow, green, teal, mint, blue, indigo, purple,
pink. Роли `avatar-fill-*` принадлежат общему профилю Colors. Совместимость:
neutral/brand → blue, danger → red, warning → orange, success → green,
info → teal. Online читает `label-info-primary`, Away —
`label-warning-primary`, DND — `label-danger-primary`, Offline —
`label-quaternary`. Эти значения подтверждены исходным Status indicator
`7719:56717`; точка по умолчанию скрыта.

## Текстурный материал

`fallback="texture"` использует готовое изображение материала. Исходные слои
Figma 512×512 и их SHA-256 сохранены в
[`assets/avatar/source.json`](../../assets/avatar/source.json). Файл Figma не
изменяется. Два слоя — фотографическая основа и белая/тёмная текстура —
собираются офлайн; затем применяется цвет из текущего профиля Colors.
В increased contrast тёмная текстура меняет `#101012` на исходный чёрный.
Её покрытие восстанавливается из premultiplied RGBA слоёв, включая зерно
и просветы, без размытия или подгонки по контрольным изображениям.

Все 40 поставляемых вариантов — **производные материалы, не точные PNG-экспорты
Figma**. Отдельно сохранённые авторские PNG служат сравнением; визуальный
результат проверен в 32/48 px с соседями, в обеих темах и при увеличении.
Источник, рецепт, разрешение и хэши каждого ресурса находятся в общем
[`manifest.generated.json`](../../assets/avatar/manifest.generated.json). Новый цвет или изменение
палитры следует из `components.json` и Colors, а не из списка в renderer.

Web использует lossless WebP 256×256 — достаточно для L=48 при 200% и DPR 2.
Подключайте `@labpics/ui-core/theme.css`: в нём выбирается материал режима.
Переменные зарегистрированы как `@property` с типом `<url>`, чтобы относительный
URL вычислялся в исходном stylesheet до наследования в Shadow DOM или
встраиваемый React CSS. Изображения не входят в JS; браузер загружает только
используемые варианты и повторно использует один URL для всех одинаковых Avatar.

Compose получает PNG через обычные density qualifiers. Офлайн уменьшенные
48/72/96/144/192 px сохраняют мягкость текстуры на CPU; один большой bitmap с
`FilterQuality.High` не обеспечивает нужного усреднения при уменьшении.
На density 1 декодируется 9 KiB, на density 2 — 36 KiB на использованный
вариант. Геометрия, статус и портрет остаются самостоятельными слоями.

Пересборка: `python -m pip install -r scripts/requirements-avatar.txt`, затем
`python scripts/compile-avatar-materials.py`. Флаг `--check` проверяет
воспроизводимость без записи. Обычный build использует уже подготовленные
ресурсы и не требует Python, Figma или сети. Подробные измерения и рендеры —
в [проверке материала](../evidence/avatar-20261119/README.md).

Исходный letter mark использует SF Pro Rounded Heavy. Надпись центрируется
в авторском текстовом блоке высотой 30 px внутри круга 32 px: центр
надписи поднят на 1 px и масштабируется вместе с кругом.
Sunghyun Sans ExtraBold — открытая замена с кириллицей, а не идентичный шрифт.
Geist остального интерфейса не меняется. Источник и проверяемые hashes —
в [provenance шрифтов](../../packages/fonts/PROVENANCE.md).

## Загрузка и поставка

Web URL определяет отдельное наблюдение изображения. При смене src старое
наблюдение отменяется; последовательность A → B → A не принимает события
первого A. React использует самостоятельный компонент без custom element;
Vue/Solid/Svelte/Astro — типизированные адаптеры Lit, включая SSR.
Общий CSS доступен через `@labpics/ui-core/avatar.css`; React подключает его
автоматически. Для SSR без JS подключите этот CSS вместе с темой и шрифтами.

Compose использует [Coil AsyncImage](https://coil-kt.github.io/coil/compose/)
с [Ktor network backend](https://coil-kt.github.io/coil/network/) для загрузки,
кэша и отмены. Публичный API не раскрывает типы Coil. JVM, Android и iOS
подключают собственный Ktor engine; хост отвечает за сетевые разрешения.

Браузерная проверка `apps/docs/tests/avatar.spec.ts` покрывает обе реализации,
геометрию, имя/decorative, загрузку/ошибку/старые события, RTL и cached SSR
image до hydration. `AvatarRenderTest` проверяет Compose на CPU без окон:
темы, масштаб текста, графемы, semantics и настоящий локальный HTTP.
