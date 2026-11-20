# Dialog, AlertDialog, Popover

Исходный план: https://github.com/Labpics-Team/agents-config/blob/main/plans/labui/r1.md

AlertDialog следует неизменяемому `Alert Dialog`: 480 px, padding/gap 36, radius 24, labels gap 12, headline 20/20/600, body 16/24/400, Buttons m с равными ширинами и gap 8. Dialog и Popover остаются расширениями этого языка; отдельных исходных макетов нет.

1. Общий профиль поверхности и типографики, авторская композиция AlertDialog.
2. Общий runtime web: browser top layer/modality, controlled open requests, Floating UI для привязки Popover. Живые слоты и локальная тема остаются в исходном DOM. Built-in действия и Icons 0.4.
3. Compose: те же профиль, материалы, действия, управление состоянием; Dialog/Popover и подтверждение с безопасным начальным фокусом.
4. Реальные installed consumers, обе темы/материалы, 100/125/200%, узкая ширина, клавиатура/возврат фокуса, вложение, SSR/hydration и сохранение ввода.
5. Сверка source/render, cold review, commit/push и передача root для общей интеграции/выпуска.

Menu и vanilla runtime изменяет другой агент; эти файлы не затрагивать. Локально только headless, native SOFTWARE; NVDA/аудио/видимые окна запрещены. Временный Icons tarball override вернуть до commit.

Ревью: удалена подмена внутреннего состояния Zag; runtime использует публичный browser dialog lifecycle. Исправлены IME Escape, включая отложенный native cancel WebKit, reactive Lit placement/arrow, projected trigger и пустые conditional slots. Lab Motion удерживает модальность до выхода; native actions складываются при крупном тексте, Popover имеет стрелку. Шапка отдаёт заголовку полную строку, когда слово не помещается рядом с крестиком. Справка: docs/reference/dialog-family.md.

Popover рассчитывает доступное место по viewport: positioner находится внутри top-layer dialog, и проверка top-layer только самого positioner ошибочно оставляла clipping ancestors. Перпендикулярный fallback позволяет боковой панели поместиться на узком экране. Различающий сценарий: 390×844, font-size 32px, placement right внутри transform + overflow hidden.

Проверены Chromium/WebKit (18 Playwright scenarios, source/matrix, IME после двух RAF, installed React/Vue/Solid/Svelte/Astro), Core/React typecheck, Figma neutral Button paints и 5 native SOFTWARE tests. Снимки native сохранены рядом с web. Временный Icons override убран из package.json/lock.

Доставка: commit исходников → catalog:generate (native source должен быть committed) → adapter-codegen tests/catalog:check → commit каталога → push и передача root. Root интегрирует Menu, материалы, общие scanners и выполняет PR/merge/release. Найденный отдельно дефект Acrylic при native 200% устранён в общем renderer: clip оборачивает blur, сохраняя внешние stroke и shadow. [Различающая проверка и итоговые материалы](../../../native/compose/evidence/material-shape-20261120/README.md); повторены 12 native SOFTWARE-сценариев.

Ветка `feat/dialog-family-authored-20261120` отправлена: исходники `1ab719c1`, каталог `30863990`. Независимое ревью приняло freeze `308639909b52416808d316e302d6ad9ee0817042`; подробности и ограничения в README. Работа этого участка готова к общей интеграции root; выпуск продукта ещё выполняется в основной задаче.
