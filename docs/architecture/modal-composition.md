# Модальная поверхность и содержимое потребителя

LabModal сохраняет content nodes у потребителя. Внешний именованный слот
передаётся внутреннему слоту поверхности manual popover. Обычные и scoped CSS,
DOM-предки, состояние формы и делегированные события сохраняют исходное дерево.
Popover выводит поверхность из clipping и transform предка. Перенос узлов и
origin-маркеры удалены. LabMotion владеет движением Sheet и завершением его scope.

Native React Dialog и AlertDialog сохраняют `createPortal` в `document.body`.
Их стабильная плоскость также открывается как manual popover при открытии Zag
и убирается из top layer при закрытии или unmount. Поэтому обычный публичный
Dialog внутри Sheet принимает клики без дополнительного consumer hook.
Повторный render содержимого сохраняет плоскость и её место в top layer.
`manual` сохраняет закрытие, focus trap и порядок слоёв у существующего Zag runtime.
Плоскость рендерится только после mount. Её layout effect остаётся синхронным
до paint на клиенте и не вызывается при SSR; сервер и первая hydration выводят
только trigger. Callback с ранним выходом в родительском компоненте сохранял
предупреждение React, поскольку сам layout hook регистрировался на сервере.

Dialog behavior принимает стабильную DOM-ссылку `triggerEl` от renderer.
Она задаёт origin для существующего dismissable layer и fallback для возврата
фокуса, когда trigger и body portal находятся в разных native roots. Это один
binding владельца DOM; `finalFocusEl` сохраняет приоритет явной точки возврата.
Fallback принимает только подключённый focusable trigger; disabled, скрытая
или удалённая ссылка оставляет штатный возврат к захваченному активному элементу.
Core при поздней очистке отличает самостоятельный modal от родителя Sheet:
родитель возвращает собственный trigger, самостоятельный modal сохраняет свой
текущий фокус. Содержимое закрытого Sheet не становится точкой возврата в родителя.

## Один владелец поведения и доставки

Core включает реализацию Zag в свою сборку. Входы
`@labpics/ui-core/behaviors/{dialog,popover,menu,select,combobox,tooltip}`
предоставляют то же поведение Lit и native React. WC и React импортируют эту
публичную границу. Её CJS входы используют общие chunks; ESM входы читают те же
CJS exports через тонкие facades. Facades и их source maps выводятся из exports
фактической сборки в существующем copy-artifacts. Поэтому dismissable stack,
focus-trap stack, aria-hidden counters и scroll locks принадлежат одному runtime
также при одновременной загрузке физических CJS Sheet и ESM React behavior.
Компонентные входы сохраняют собственные ESM/CJS реализации.

Разделение кода внутри двух независимых форматов оставляло два stack: mixed
consumer терял initial focus в Chromium/WebKit, а тот же сценарий в одном формате
проходил. Общий behavior runtime закрывает именно эту границу. Канонический CJS
выбран по штатной Node схеме ESM facade: опубликованный Core не задаёт downstream
Node floor, необходимый для альтернативного `require(esm)`. Цена браузерного
CommonJS проверяется по фактическому consumer bundle относительно baseline.
Одна физическая установка Core — условие этой identity; разные версии и независимо
собранные копии требуют отдельного контракта.

Общий helper-вход `@labpics/ui-core/shared` сохраняет свой контракт без Lit,
регистрации элементов и загрузки всех поведений. Лицензии включённых зависимостей
попадают в `dist/THIRD-PARTY-NOTICES.txt` из фактического графа сборки.

Потребитель устанавливает tarball обычным npm. Его зависимости Zag остаются
неизменёнными registry packages; исправленный runtime уже находится в Core.
Потребительские patches и install hooks для исправления зависимостей не нужны.

## Кнопка открытия

Core принимает один `lab-button` или native `button type="button"` в
`slot="trigger"`. Слот заменяет встроенную кнопку целиком. Без именованного
trigger сохраняется прежняя кнопка с неинтерактивной подписью в default slot.
Обёртки и вложенные controls отвергаются. Button сохраняет свои варианты,
доступное имя, native type, loading и disabled; Modal получает только readonly
interaction-target port и владеет событиями и возвратом фокуса.

Binding ждёт upgrade и render Button, перепривязывается при замене слота и
освобождается при disconnect. Assignment generation прекращает влияние позднего
callback. `triggerEl`, event props и final focus читают одну актуальную native
цель. Dismissable exclusion разрешает её при каждом outside event. Другой
самостоятельный modal сохраняет текущий фокус при позднем cleanup.

Метаданные `data-projection="direct"` выводятся в существующий манифест
адаптеров. Vue проецирует один VNode; Svelte передаёт direct snippet аргумент
`{ slot: 'trigger' }`, который snippet назначает своему Button. SSR и Astro
назначают slot одному исходному HTML-элементу с сохранением hydration markers.
Обычные именованные слоты сохраняют прежние коробки.

ARIA связывает native цель с доступным controlled container:

| Renderer | Controlled element |
|---|---|
| Core, встроенная кнопка | Собственный portal host в том же shadow root. |
| Core, slotted Button | Modal host в root потребителя, доступном из root native кнопки. |
| React | Настоящий content в document portal; document является своим или родительским root для native кнопки. |

Внутренний `role="dialog"` остаётся на content. Строковый IDREF разрешается
только в своём root. `Element.ariaControlsElements` допускает ссылки в свой и
родительские roots, но исключает sibling и descendant roots. Общий
`bindDialogTriggerControls` проверяет scope readback и возвращает прежнее
отношение при cleanup. Недоступная cross-root capability даёт явную ошибку.
DOM readback не удостоверяет представление связи в AX tree; его проверяет
genuine hosted browser consumer.

Первичные источники сверены 7 ноября 2026 года:
[MDN reflected element reference scope](https://developer.mozilla.org/en-US/docs/Web/API/Document_Object_Model/Reflected_attributes#reflected_element_reference_scope),
[WAI-ARIA aria-controls](https://www.w3.org/TR/wai-aria/#aria-controls)
и [MDN browser compatibility data](https://github.com/mdn/browser-compat-data/blob/main/api/Element.json).
Property поддерживается Chromium 135, Firefox 136 и Safari 16.4 и новее.
TypeScript 5.7.3 lib.dom ещё не содержит его; owner использует узкую проверяемую
структурную capability. Experimental `referenceTarget` не требуется.

## Поправки существующего DOM и layer owner

В закреплённом Zag 1.41.2 поиск focusables через querySelectorAll не проходит
assigned slots и обычные нефокусируемые shadow hosts. Поправка DOM-query
обходит assignedElements с flatten, fallback slots и открытые shadow roots.
Она сохраняет фильтры видимости, disabled и inert, а при Tab также отрицательный
tabindex shadow host. Composed contains следует assignedSlot, parentNode и host.

Поиск controlled popup использует тот же composed граф. Каждый найденный
controller разрешает aria-controls в собственном native getRootNode() без composed,
а visited set хранит элементы,
чтобы одинаковые IDs в разных shadow roots не исключали друг друга. Закрытые
controllers и modal targets сохраняют прежние ограничения. Это позволяет
родительскому trap принимать фокус в законном внешнем popup потребителя.
Detached дерево разрешает только свои IDs и сохраняет отсутствие цели без
перехода к document. Остальные пользователи DOM-query getRootNode не меняются.
Проверенный controller из Zag 1.47.0 сохраняет исходное ограничение.

Поправка dismissable переносит регистрацию слоя с RAF на microtask после DOM
commit. Если узел ещё отсутствует, остаётся RAF; cleanup отменяет оба пути.
Это backport подхода whenNode из Zag 1.46.0. Pointer-outside сохраняет свой defer.
Первый trusted Escape принадлежит уже открытому верхнему слою.

Порядок регистрации задаёт верхний слой для Escape и pointer blocking.
Родительство для каскада закрытия выводится из composed расположения content
и trigger, переданных существующими машинами через exclude. Persistent elements
сохраняют свою роль исключений для outside interaction. Соседний popup,
открытый до deferred outside cleanup прежнего popup, сохраняет независимость.
Вложенные portalled popup остаются потомками слоя, внутри которого живёт trigger.

Layer owner использует то же родительство для nested metadata и outside checks.
Повторная регистрация меняет stack order, сохраняя родителя открытого слоя.
После veto или отложенного cleanup ребёнок переходит к живому ancestor; удаление
слоя повторно разрешает его index после синхронных callback потомков.
Отдельный onRequestDismiss guard в LabModal удалён. Этот закон действует
в общем runtime Core и не требует поправок каждого renderer.

Поправка aria-hidden переносит штатное исправление
[PR 3406](https://github.com/chakra-ui/zag/pull/3406), commit
`44445ae6b038d2d737bb3ca5b9d02d697c29cc07`, с сохранением API 1.41.2.
Только верхняя модальная блокировка каждого document скрывает фон. Открытие
заранее смонтированного внешнего портала приостанавливает прежнюю блокировку;
закрытие возвращает её оставшемуся родителю. Удаление нижней блокировки сохраняет
верхнюю, недоступная цель не снимает действующую модальность. Изменение
aria-expanded обновляет управляемое всплывающее содержимое, а заданное
потребителем aria-hidden сохраняется после очистки. Это тот же
подход, который поставляет опубликованный Zag 1.47.0. Обновление всего Zag
сохранило бы описанные controller и sibling cascade ограничения, поэтому
исправления остаются у закреплённого producer owner и доставляются вместе.

Проверка aria-hidden containment сохраняет исходную цель через весь composed
граф. Обход маскирует соседей на каждой открытой ShadowRoot границе и проходит
assigned slots с flatten и fallback. Замена цели первым shadow host оставляла
Sheet без блокировки; замена внешним host оставила бы его внутренних соседей
доступными. MutationObserver отдельно наблюдает shadow roots активной цели
и разрешённых controlled popup, поскольку `subtree` не пересекает эту границу.
Проверка скрытого controller следует тому же composed пути. Cleanup возвращает
прежние атрибуты и отключает наблюдение через существующий lock stack.

Native touch Menu сохраняет compatibility click WebKit. Закреплённый Menu
отменяет pointerdown на trigger и ожидает click для открытия; WebKit при touch
не создаёт этот click. Поправка оставляет native default для touch и сохраняет
отмену для mouse/pen. Disabled и context-menu guards выполняются до этого выбора.
Оба renderer используют ту же поправку из Core.

[package.json](../../package.json) и lockfile закрепляют точные producer inputs
через штатный pnpm patchedDependencies. ESM и CJS исправлены одинаково.
Владелец поправок и доставки — Web Core LabUI.

Dialog — зависимость сборки Core: его runtime и типы входят в пакет из одного
исправленного producer input. `dts.resolve` tsup8.3.6 сохраняет зависимости
production внешними, поэтому Dialog объявлен в devDependencies. Закреплённый
сборщик дополнительно считает внутренние декларации разрешённого пакета внешними
и теряет их при упаковке. Узкая поправка включает штатный `respectExternal`
rollup-plugin-dts только при заданном `dts.resolve`; список production external
сохраняется. Второй генератор деклараций и ручная копия schema не требуются.
Registry Zag у npm-потребителя сохраняет свои типы и runtime; `.mts` и `.cts`
потребители Core получают новый DOM binding вместе с поведением. Публичные
props React Dialog/AlertDialog остаются прежними.

## Почему сохранён manual popover

Прямой dialog.showModal() с настоящими слотами сохраняет DOM и стили. Однако
нативная modal inertness не допускает фокус во внешний body portal, даже когда
popup помещён в top layer через showPopover(). Этот контрпример выполнен в
Chromium и WebKit. Замена потребовала бы менять принятый контракт порталов.
Тот же предел описывает открытый
[WHATWG issue 9936](https://github.com/whatwg/html/issues/9936).

Зрелое бесплатное исправление
[Vaadin PR6411](https://github.com/vaadin/web-components/pull/6411), merge
`d252b615b25fcd7bf157ff2b90804063379551a4`, также сохраняет глубокую цель,
shadow siblings и assignedSlot. Его библиотека не заменяет общий Zag lock stack
и контролируемые порталы LabUI. Исправлен уже используемый owner; слоты требуют
именно composed обхода, чтобы не скрыть проецируемый consumer body.

Копирование CSS не восстанавливает DOM-предков и делегированные события.
Замена fork FocusTrap на другую библиотеку добавляет отдельное владение stack
и требует заново сохранять controlled popup. Обновление до проверенного Zag
1.47.0 устраняет часть задержки регистрации, но не composed DOM ограничения.
Поэтому исправлен существующий owner и его упаковка.

Sibling cascade воспроизведён в Chromium и WebKit через trusted click: старый
слой получает pointerdown.outside, затем новый — layer:request-dismiss от старого.
Отмена только второго события сохраняет новый popup при закрытии старого.
Проверенный Zag 1.47.0 и upstream main сохраняют stack-order cascade.
[PR 3599](https://github.com/chakra-ui/zag/pull/3599) предлагает родительство
по trigger; на дату проверки он открыт. Более полный, закрытый без merge
[PR 3322](https://github.com/chakra-ui/zag/pull/3322) описывает также re-registration
и сохранение связи после veto. Их вердикты не являются проверкой LabUI.
Локальная поправка сохраняет эти границы и обходит subtree линейно по числу
слоёв, включая parent, перемещённый выше своих потомков.

## Проверка и условие удаления

`pnpm --filter @labpics/ui-docs test:packed-modal` упаковывает текущие артефакты,
устанавливает их npm в отдельном временном проекте и проверяет неизменённые
registry DOM-query и Dialog declarations. Обычный registry TypeScript5.7.3
проверяет положительный Core DOM binding и сохранённые React props в `.mts`/`.cts`
без workspace paths, junctions и зависимости от producer types. Browser bundles разрешают зависимости из этого
проекта и исключают исходники Core/React и внешний layer runtime из результата.
React18 SSR отдельно проверяет Dialog/AlertDialog через физический ESM вход
и публичный CJS require: trigger присутствует, клиентская плоскость отсутствует,
предупреждений нет. Существующий optional peer Lit SSR проверяет полезный HTML
и Declarative Shadow DOM при смешанных import/require Core SSR и Sheet.
Эти контроли используют Node, который запускает штатную команду, без полного
сравнения HTML с изменяемыми instance IDs.
Сценарии исполняются в ESM/CJS и Chromium/WebKit. Для сохранения tarballs,
digest, lockfile, metafiles и результатов задаётся `LABUI_PACKED_MODAL_EVIDENCE`.
Отдельный mixed consumer берёт Sheet из CJS entry, а React Dialog/Alert и его
Core behavior из ESM entry; metafile подтверждает выбранные входы. Controlled
закрытие родителя проверяет общего владельца nested lifecycle.
Инертный Node consumer сравнивает все exports шести physical ESM/CJS behavior
entries, включая `machine` и `connect`. Browser bundle и его minified/gzip размер
сохраняются рядом с metafile; равенство ссылок отдельно не удостоверяет lifecycle.

Браузерные oracles охватывают настоящие Lit, Vue, Solid и React WC consumer,
замену React subtree открытой панели, первый trusted Escape, внешний native
React popup/Dialog/AlertDialog, Motion failures, disconnect и final-focus
generation histories, sibling popup через mouse/touch и controlled закрытие
настоящего portal descendant. Первый Escape не ждёт фокуса и не заменяет clock или RAF.
Соседние Dialog/AlertDialog и popup controls сохраняют собственные suites.
Отдельный публичный fixture без top-layer hook проверяет полезные клики
Dialog/AlertDialog, Sheet ещё за двумя consumer shadow roots, тройное вложение,
повторное открытие соседей, React render и unmount из дочернего Alert.
Controlled закрытие Sheet завершает Dialog/Alert portal также при trigger
в consumer ShadowRoot; возврат фокуса проверяется на сохранившемся trigger.
AX assertions проверяют скрытие фона и возврат оставшегося modal после закрытия.

HappyDOM 21.0.4 реализует assignedElements, но теряет assignedSlot. В bounded
unit-графе явно заданы две assignment связи, квалифицированные Chromium156 и
WebKit27.2. Ожидания composed contains сохранены; видимость, перераспределение
слотов и настоящую Tab-навигацию удостоверяют браузеры.

При обновлении Zag сначала проверяются точные исходники и эти потребители.
Поправка dismissable удаляется после подтверждённой регистрации после commit
без обязательного RAF, независимости sibling и сохранения nested lifecycle.
DOM-query поправка удаляется после поддержки forwarded
slots, shadow hosts, composed contains и controller-owned ID resolution с тем
же потребительским результатом. Обновление версии само по себе не закрывает
условия. Упаковка у единого Core owner сохраняется независимо от срока patches.
Menu поправка удаляется после подтверждённого native touch открытия и sibling
перехода в Chromium/WebKit без изменения mouse, keyboard и disabled поведения.
Поправка aria-hidden удаляется после подтверждённой доступности одиночных
и вложенных модальных поверхностей, заранее смонтированных порталов
и управляемого всплывающего содержимого в дереве доступности, восстановления
оставшейся поверхности после закрытия, глубоких shadow siblings и сохранения
заданного aria-hidden. Native React плоскость сохраняется при обновлении Zag:
доставка в browser top layer принадлежит renderer, а поведение — Core.
Dialog patch удаляется после поставленного upstream DOM-ref binding,
который сохраняет parent cascade и final focus через разные native roots.
`getRootNode` сам по себе выбирает один root: исправление
[PR3127](https://github.com/chakra-ui/zag/pull/3127) и опубликованный Dialog1.47.0
не предоставляют отдельную ссылку на trigger. Перенос body portal в ShadowRoot
потребовал бы другого владельца CSS и менял бы принятый контракт размещения.
Поправка tsup удаляется после поставленного разрешения внутренних деклараций
при `dts.resolve`, подтверждённого тем же registry NodeNext-потребителем.

Первичные источники проверены 5 ноября 2026 года:
[HTML slots](https://html.spec.whatwg.org/multipage/scripting.html#the-slot-element),
[HTML popover](https://html.spec.whatwg.org/dev/popover.html),
[Lit shadow DOM](https://lit.dev/docs/components/shadow-dom/),
[Zag focus trap](https://zagjs.com/utilities/focus-trap),
[Zag changelog](https://github.com/chakra-ui/zag/blob/main/CHANGELOG.md),
[tsup dependency inclusion и splitting](https://tsup.egoist.dev/).
Ограничение DTS подтверждают
[tsup8.3.6 rollup.ts](https://github.com/egoist/tsup/blob/v8.3.6/src/rollup.ts),
[ts-resolve.ts](https://github.com/egoist/tsup/blob/v8.3.6/src/rollup/ts-resolve.ts)
и штатный [respectExternal](https://github.com/Swatinem/rollup-plugin-dts#what-to-expect).
Общий physical runtime следует
[Node dual-package patterns](https://github.com/nodejs/package-examples/blob/main/guide/07-dual-packages/README.md).
Клиентский mount gate следует
[React useLayoutEffect для SSR](https://react.dev/reference/react/useLayoutEffect#im-getting-an-error-uselayouteffect-does-nothing-on-the-server).
Выбор учитывает
[require(esm) в Node22.19](https://nodejs.org/download/release/v22.19.0/docs/api/modules.html#loading-ecmascript-modules-using-require)
и [ограничения tree-shaking esbuild](https://esbuild.github.io/api/#conditions).
Версионные выводы дополнительно опираются на опубликованные файлы
DOM-query/focus-trap/dismissable 1.41.2/1.46.0/1.47.0 и исходники tsup8.3.6.
