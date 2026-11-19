# Drag Button

`DragButton` / `<lab-drag-button>` / `LabDragButton` подтверждает действие. Кнопка
запускается обычным нажатием, Enter, Space или отпусканием указателя после полного
горизонтального движения. Это действие с ролью Button, а не числовой Slider.

Figma Default → Halfy dragged → Fully dragged описывает рост внутреннего Button.
Его ширина изменяется от 48 px до доступной ширины дорожки; шеврон остаётся у
подвижного края. Success и Danger заполняют всю дорожку и центрируют checkmark
с текстом. Результат Danger сохраняет авторский знак; сообщение объясняет исход.
Обе темы, Button paints и Text/M-Emphasized происходят из общей системы.

```tsx
import { DragButton } from '@labpics/ui-react/drag-button';

<DragButton label="Подтвердить перевод" helperText="Подтвердить перевод"
  status={status} resetKey={attempt}
  pendingText="Отправляем" successText="Отправлено" dangerText="Не отправлено"
  onComplete={async () => {
    setStatus('pending');
    try { await sendTransfer(); setStatus('success'); }
    catch { setStatus('danger'); }
  }} />
```

```kotlin
var status by remember { mutableStateOf(LabDragButtonStatus.Idle) }
val scope = rememberCoroutineScope()
LabDragButton(
    label = "Подтвердить перевод",
    helperText = "Подтвердить перевод",
    status = status,
    resetKey = attempt,
    pendingText = "Отправляем",
    successText = "Отправлено",
    dangerText = "Не отправлено",
    onComplete = {
        status = LabDragButtonStatus.Pending
        scope.launch {
            status = try { sendTransfer(); LabDragButtonStatus.Success }
            catch (cancelled: CancellationException) { throw cancelled }
            catch (_: Exception) { LabDragButtonStatus.Danger }
        }
    },
)
```

`complete` выдаётся один раз за попытку. Компонент синхронно закрывает повторный
ввод до вызова обработчика и сам показывает pending, даже если приложение ещё
не обновило props. Нативный click после pointerup не создаёт второе действие.
Приложение управляет результатом; смена `resetKey` или возврат результата в `idle`
открывает новую попытку. Изменение сообщения не повторяет запрос. Не используйте
таймер для автоматического сброса успешного действия: человек должен успеть
прочитать результат. Сетевую идемпотентность обеспечивает сервер приложения.

Незавершённый жест, Escape, pointercancel, потеря capture, уход фокуса/окна,
скрытие страницы и изменение ширины отменяют движение. Компонент не активируется
на pointerdown и не перехватывает вертикальную прокрутку (`touch-action: pan-y`).
RTL меняет направление жеста и шеврон. Нулевая доступная дистанция оставляет
обычное нажатие. Reduced motion убирает возвратную анимацию и вращение ожидания.

Во время pending и результата фокус остаётся на той же кнопке; `aria-disabled`
закрывает повтор, `aria-busy` обозначает ожидание, отдельный `role=status`
объявляет сообщение без замены доступного имени действия. `disabled` снимает
кнопку с клавиатурного пути. Декоративные Icons не создают дополнительных целей.

Авторская маска привязана к правому краю: пять размытых прямоугольников 140×210
с промежутками 64 и blur 128. Она применяется только к фону и helper, а Button
остаётся резким. Маска статична: web переиспользует SVG mask, Compose хранит
ALPHA_8 bitmap видимой дорожки и обновляет его только при изменении размеров/density.
Узкая дорожка сокращает helper до одной строки; полное имя действия сохраняется
в `label`. Длинный результат переносится и увеличивает высоту кнопки. Helper
скрывается во время ожидания и результата, поэтому не выступает из-под заливки.

Compose использует `LabTheme`, `LabMotion`, общий Button paint и опубликованный
`pics.lab:icons-compose`. `enabled = false` соответствует web `disabled`.
Доступное имя остаётся в `contentDescription`, результат — в `stateDescription`
и polite live region. В desktop-потребителе компонент проверяется без окна через
`ImageComposeScene`; пример приложения находится в `DragTransferExample.kt`.

Источники: [Lab UI v2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1),
[WCAG 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html),
[Pointer Events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events).
