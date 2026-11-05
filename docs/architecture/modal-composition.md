# Модальная поверхность и содержимое потребителя

LabModal сохраняет content nodes у потребителя. Внешний именованный слот
передаётся внутреннему слоту поверхности manual popover. Обычные и scoped CSS,
DOM-предки, состояние формы и делегированные события сохраняют исходное дерево.
Popover выводит поверхность из clipping и transform предка. Перенос узлов и
origin-маркеры удалены. LabMotion владеет движением Sheet и завершением его scope.

## Один владелец поведения и доставки

Core включает реализацию Zag в свою сборку. Входы
`@labpics/ui-core/behaviors/{dialog,popover,menu,select,combobox,tooltip}`
предоставляют то же поведение Lit и native React. Все входы Core собраны вместе
с разделением кода в ESM и CJS: dismissable stack и focus-trap stack находятся
в общих chunks. React сохраняет внешний импорт Core. Отдельный bundle только
для Sheet создал бы независимый stack относительно соседних popup и Dialog.

Общий helper-вход `@labpics/ui-core/shared` сохраняет свой контракт без Lit,
регистрации элементов и загрузки всех поведений. Лицензии включённых зависимостей
попадают в `dist/THIRD-PARTY-NOTICES.txt` из фактического графа сборки.

Потребитель устанавливает tarball обычным npm. Его зависимости Zag остаются
неизменёнными registry packages; исправленный runtime уже находится в Core.
Потребительские patches и install hooks для исправления зависимостей не нужны.

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

Native touch Menu сохраняет compatibility click WebKit. Закреплённый Menu
отменяет pointerdown на trigger и ожидает click для открытия; WebKit при touch
не создаёт этот click. Поправка оставляет native default для touch и сохраняет
отмену для mouse/pen. Disabled и context-menu guards выполняются до этого выбора.
Оба renderer используют ту же поправку из Core.

[package.json](../../package.json) и lockfile закрепляют точные producer inputs
через штатный pnpm patchedDependencies. ESM и CJS исправлены одинаково.
Владелец поправок и доставки — Web Core LabUI.

## Почему сохранён manual popover

Прямой dialog.showModal() с настоящими слотами сохраняет DOM и стили. Однако
нативная modal inertness не допускает фокус во внешний body portal, даже когда
popup помещён в top layer через showPopover(). Этот контрпример выполнен в
Chromium и WebKit. Замена потребовала бы менять принятый контракт порталов.

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
registry DOM-query файлы. Browser bundles разрешают зависимости из этого
проекта и исключают исходники Core/React и внешний layer runtime из результата.
Сценарии исполняются в ESM/CJS и Chromium/WebKit. Для сохранения tarballs,
digest, lockfile, metafiles и результатов задаётся `LABUI_PACKED_MODAL_EVIDENCE`.

Браузерные oracles охватывают настоящие Lit, Vue, Solid и React WC consumer,
замену React subtree открытой панели, первый trusted Escape, внешний native
React popup/Dialog/AlertDialog, Motion failures, disconnect и final-focus
generation histories, sibling popup через mouse/touch и controlled закрытие
настоящего portal descendant. Первый Escape не ждёт фокуса и не заменяет clock или RAF.
Соседние Dialog/AlertDialog и popup controls сохраняют собственные suites.

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
оставшейся поверхности после закрытия и сохранения заданного aria-hidden.

Первичные источники проверены 5 ноября 2026 года:
[HTML slots](https://html.spec.whatwg.org/multipage/scripting.html#the-slot-element),
[Lit shadow DOM](https://lit.dev/docs/components/shadow-dom/),
[Zag focus trap](https://zagjs.com/utilities/focus-trap),
[Zag changelog](https://github.com/chakra-ui/zag/blob/main/CHANGELOG.md),
[tsup dependency inclusion и splitting](https://tsup.egoist.dev/).
Версионные выводы дополнительно опираются на опубликованные файлы
DOM-query/focus-trap/dismissable 1.41.2/1.46.0/1.47.0 и исходники tsup8.3.6.
