# Браузерные полномочия Program

`browser.mjs` подключает настоящий Core Program. Core остаётся единственным владельцем численного решения; авторские LabUI inputs читаются отдельно от опубликованных CSS outputs.

## Один внешний слой

`browser-authority.mjs` владеет управляемыми inline custom properties на одном scope. Полный подготовленный набор присваивается одним `style.cssText`; `browser-host.mjs` подтверждает Core install только после этого эффекта. Runtime больше не публикует параллельный author stylesheet.

Авторские normal inline declarations сохраняются в локальном draft ledger. Наблюдаемое внешнее изменение, отличающееся от последнего installed value/priority, становится новым draft; outputs не парсятся обратно как inputs. При dispose восстанавливаются только всё ещё принадлежащие владельцу declarations. Несвязанные свойства и внешние изменения сохраняются. Удаление authored declaration является новым входом.

Inline `!important` не является допустимым authored input. Начальный и live отказ заменяет управляемые outputs обычным inline `initial`, поэтому исходная важная декларация удаляется и не раскрывается унаследованный static contract. Публикация и отзыв сохраняют normal priority: обычный `style.setProperty()` может задать следующий draft и в WebKit, где замена важного custom property обычным значением [была сломана](https://bugs.webkit.org/show_bug.cgi?id=327174). Удаление прежней декларации происходит в подготовленном блоке до единственного присваивания `cssText`. Ошибка отзыва передается как `cleanup_failed`, не подавляется callback-обработчиком состояния.

Marker и style root входят в свежесть lease, но не в механизм отзыва. Их изменение сохраняет прежние Core outputs до обработки и затем требует свежего observation и нового attachment. Unknown observation снимает outputs; восстановление не возвращает старый CSS snapshot. Удаление `adoptedStyleSheets` не удаляет публикацию, поскольку этот adapter не владеет stylesheet.

Живой владелец scope учитывается отдельно от DOM marker. Его удаление не разрешает второй runtime; scope освобождается после завершения всего dispose, включая восстановление canvas. Темы объявляют одинаковый набор материалов: различаются краски, но весь набор CSS-ролей остаётся управляемым при переключении. Неполная топология отвергается до изменения DOM.

## Завершение cleanup

`disposed` публикуется только после отзыва outputs, безопасного выхода из Core, успешных `attachment.dispose/free`, восстановления authored role declarations и canvas. Ошибка любой незавершённой фазы наблюдаема как `failed/cleanup_failed`; owner и текущая фаза сохраняются для повторного public cancel/dispose. Успешный Core dispose не повторяется при retry free/finalize. Во время Core callback запрос завершения сообщает `waiting/cleanup_pending`, а terminal появляется после unwind. При retry browser restoration уже восстановленный inline owner не маскируется заново; listeners снимаются только после завершения browser owners.

## Граница обещания

Это кооперативный CSS host, не hostile-DOM sandbox. Посторонний код с доступом к DOM может переписывать inline declarations; такие изменения наблюдаются на refresh/frame и снимаются либо принимаются как новые normal inputs. Между внешней записью и наблюдением нет синхронной изоляции. Совпадающая с installed value/priority повторная запись неразличима по CSSOM и не объявляется новым draft. Отдельные declarations на дочернем consumer принадлежат его CSS-владельцу и не покрываются обещанием scope authority.

Stylesheet `!important` на управляемых ролях самого scope находится вне этого контракта: например, `#scope { --lab-label-primary: red !important }` выигрывает normal inline публикацию и отзыв. Такие правила нельзя использовать на scope runtime. Важная декларация предка не мешает: собственная inline роль scope заменяет унаследованное значение. `ready` подтверждает публикацию в согласованном CSS host, а не изоляцию от чужих правил с более высоким приоритетом.

## Проверка

`apps/docs/tests/colors-live.spec.ts` подключает `test/browser-authority-scenarios.mjs`, `test/browser-cleanup-scenarios.mjs`, `test/browser-replacement-scenarios.mjs` и `test/browser-failure-listener-scenarios.mjs` через `apps/docs/src/_fixtures/colors-live.html` к существующему full Playwright suite (Chromium и WebKit). Fixture использует публичный `@labui/colors/runtime`, generated contract.css и Core WASM из установленного `@labpics/colors`; Vite публикует эти же bytes как `/core.wasm`. Сценарии проверяют DOM events, а fixture сохраняет истории публичного `onState`, включая видимый CSS и восстановление владельца до `disposed`.

Fixture ожидает `lab-colors-state` через подписку с bounded timeout до действия; sleeps и polling отсутствуют. `test/browser-withdrawal.test.mjs` различает подавленную и наблюдаемую ошибку отзыва до создания host. Полная framework-квалификация принадлежит delivery/CI владельцу.
