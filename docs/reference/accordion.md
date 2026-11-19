# Accordion

Accordion раскрывает независимые разделы страницы. M следует четырём состояниям
авторского [Lab UI 2.1](https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1):
closed/open × rest/hover. Геометрия, контур шеврона и цветовые роли определены
в `packages/tokens/src/components.json#accordion` и проецируются в web и Compose.

В M отступ 16 px, радиус 16 px, шеврон 16 px, промежуток до содержимого 8 px.
Заголовок — Geist 16/24/500 с нулевым трекингом, содержимое — 16/24/400 с −0.25 px.
Открытый заголовок сохраняет primary label. Hover заполняет весь раздел
`fill-quaternary`; рамок, разделителей и акцентного открытого заголовка нет.
S/L и horizontal явно расширяют источник; они не обозначают дополнительные masters.

```tsx
import { Accordion, AccordionItem } from '@labpics/ui-react/accordion';

<Accordion defaultValue={['delivery']} headingLevel={2}>
  <AccordionItem value="delivery" label="Когда доставят заказ?">
    Завтра с 10 до 18 часов.
  </AccordionItem>
  <AccordionItem value="address" label="Адрес доставки">
    <AddressForm />
  </AccordionItem>
</Accordion>
```

В Lit `items` содержит `{ value, label, disabled? }`, а именованный слот с тем же
`value` содержит панель. `items`, `value` и `default-value` принимают JSON в HTML.
В контролируемом режиме `value: string[]` — принятый набор; событие `value-change`
или React `onValueChange` только запрашивает новый. Отказ приложения сохраняет
панели. `[]` — контролируемый закрытый набор; Lit `null`/React `undefined` включает
внутреннее состояние. `multiple` разрешает несколько панелей, `collapsible`
по умолчанию разрешает закрыть последнюю. При `multiple` отдельные панели можно
закрывать независимо от `collapsible`.

Панели остаются в DOM и сохраняют поля при закрытии. Семантика закрывается сразу:
`inert`, `aria-hidden` и после движения `hidden` исключают содержимое из фокуса
и accessibility tree. Одна величина Lab Motion одновременно меняет высоту панели,
нижний отступ заголовка и поворот шеврона. Первый SSR-кадр неподвижен; reduced motion
сразу достигает конечного состояния. Runtime освобождает observer и playback.
При программном закрытии фокус из поля внутри панели, включая вложенный Shadow
DOM, возвращается её заголовку. Отказ приложения и закрытие другой панели
не переводят фокус из оставшегося открытым содержимого.

Каждый настоящий `button` находится в heading с заданным уровнем, указывает
`aria-controls` и сообщает `aria-expanded`. Стрелки, Home/End перемещают фокус
между доступными заголовками, Enter/Space раскрывают. Группа с более чем шестью
независимо открываемыми панелями не создаёт множество region landmarks.
Основание — [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/patterns/accordion/).

```kotlin
LabAccordion(openSections, { openSections = it }, listOf(
    LabAccordionItem("delivery", "Когда доставят заказ?"),
    LabAccordionItem("address", "Адрес доставки"),
)) { section ->
    if (section == "delivery") LabAccordionText("Завтра с 10 до 18 часов.")
    else AddressForm()
}
```

Compose всегда управляется внешним `List<String>`. `LabAccordionText` предоставляет
авторскую типографику обычному тексту; панель допускает любую композицию. Скрытый
раздел сохраняет обычный `remember`, исключает semantics и вход фокуса. Если раздел
с полем закрыт программно, фокус возвращается его заголовку. UI не содержит WebView.

[Web evidence](../evidence/accordion-20261119/README.md) включает установленные
архивы, SSR helpers Vue/Solid/Svelte/Astro с Lit upgrade, React hydration,
неизменные DOM/id и черновик до гидратации. Это не утверждение о стандартном
framework SSR всех адаптеров. В source Figma обнаружено открытое расхождение
версий Geist внутри текстовых ролей; измерения сохранены, общий шрифт и геометрия
Accordion не подменены ради совпадения одного снимка.
