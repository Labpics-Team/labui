# Браузерные полномочия Program

`browser.mjs` подключает настоящий Core Program. Core остаётся единственным владельцем численного решения; авторские LabUI inputs читаются отдельно от опубликованных CSS outputs.

## Один внешний слой

`browser-authority.mjs` владеет управляемыми inline custom properties на одном scope. Полный подготовленный набор присваивается одним `style.cssText`; `browser-host.mjs` подтверждает Core install только после этого эффекта. Runtime больше не публикует параллельный author stylesheet.

Авторские normal inline declarations сохраняются в локальном draft ledger. Наблюдаемое внешнее изменение, отличающееся от последнего installed value/priority, становится новым draft; outputs не парсятся обратно как inputs. При dispose восстанавливаются только всё ещё принадлежащие владельцу declarations. Несвязанные свойства и внешние изменения сохраняются. Удаление authored declaration является новым входом.

Inline `!important` не является допустимым authored input. Начальный и live отказ заменяет управляемые outputs inline `initial!important`, поэтому unsupported value не выигрывает author cascade и не раскрывается унаследованный static contract. Ошибка отзыва передается как `cleanup_failed`, не подавляется callback-обработчиком состояния.

Marker и style root входят в свежесть lease, но не в механизм отзыва. Их изменение сохраняет прежние Core outputs до обработки и затем требует свежего observation и нового attachment. Unknown observation снимает outputs; восстановление не возвращает старый CSS snapshot. Удаление `adoptedStyleSheets` не удаляет публикацию, поскольку этот adapter не владеет stylesheet.

## Завершение cleanup

`disposed` публикуется только после отзыва outputs, безопасного выхода из Core, успешных `attachment.dispose/free`, восстановления authored role declarations и canvas. Ошибка любой незавершённой фазы наблюдаема как `failed/cleanup_failed`; owner и текущая фаза сохраняются для повторного public cancel/dispose. Успешный Core dispose не повторяется при retry free/finalize. Во время Core callback запрос завершения сообщает `waiting/cleanup_pending`, а terminal появляется после unwind. При retry browser restoration уже восстановленный inline owner не маскируется заново; listeners снимаются только после завершения browser owners.

## Граница обещания

Это кооперативный CSS host, не hostile-DOM sandbox. Посторонний код с доступом к DOM может переписывать inline declarations; такие изменения наблюдаются на refresh/frame и снимаются либо принимаются как новые normal inputs. Между внешней записью и наблюдением нет синхронной изоляции. Совпадающая с installed value/priority повторная запись неразличима по CSSOM и не объявляется новым draft. Отдельные declarations на дочернем consumer принадлежат его CSS-владельцу и не покрываются обещанием scope authority.

## Проверка

`test/browser-authority-scenarios.mjs` исполняется в настоящем браузере с настоящим Core WASM и generated contract.css. Fixture ожидает `lab-colors-state` через одноразовую подписку с bounded timeout до действия; sleeps и polling отсутствуют. `test/browser-withdrawal.test.mjs` различает подавленную и наблюдаемую ошибку отзыва до создания host. Полная framework-квалификация принадлежит delivery/CI владельцу.
