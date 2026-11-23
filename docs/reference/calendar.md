# Calendar

`lab-calendar`, React `Calendar` и Compose `LabCalendar` реализуют Calendar/Mini, Gridcell и Status Dots из [исходной Figma](https://www.figma.com/design/LuaiBd4anRi4DMZayKAnY2?node-id=6094-1293). Общая геометрия находится в `packages/tokens/src/components.json`: размеры, текстовые роли, форма точек, материалы и цвета.

Веб использует Zag Date Picker и `@internationalized/date`; Compose — `kotlinx.datetime.LocalDate`. Наружу веб отдаёт только григорианские ISO-даты `YYYY-MM-DD`. Значение не меняется от DST, часового пояса или языка. Строки со временем и невозможные даты отклоняются. `locale` меняет представление и начало недели; действия переводятся через `translations`/native `strings`. Для SSR передайте одинаковые `today`, месяц и выбор серверу и клиенту. Без `today` веб берёт текущую дату UTC.

Generated SSR сохраняет ограничения через `unavailableDates: ['2024-05-20']` и переводы через `translations: { events: 'Событий: {count}' }` или готовые `events[date].label`. Это JSON-данные, поэтому они сохраняются при гидрации. `isDateUnavailable` и функция `translations.events` предназначены для клиентского рендера: серверные функции не сериализуются. React SSR может получать callback напрямую, но приложение должно передать ту же функцию клиентскому компоненту. Astro-адаптер подключает штатный Lit hydrate-support до регистрации элемента.

Для оформленного React SSR до загрузки JavaScript включите `@labpics/ui-core/calendar.css` в серверный CSS entry вместе с foundations. На клиенте компонент также подключает этот лист автоматически.

```tsx
import { Calendar } from '@labpics/ui-react/calendar';

<Calendar selection="range" name="dates" locale="ru-RU"
  today="2024-05-15" defaultMonth="2024-05-01"
  onValueChange={(dates) => saveDraft(dates)} />
```

В single значение содержит 0 или 1 дату; в range — 0, начало либо два упорядоченных включительных края. Следующий выбор после полного диапазона начинает новый. Нельзя завершить диапазон через `isDateUnavailable`. Соседние месяцы видны приглушённо и недоступны; переход выполняется стрелками шапки или клавиатурой. `today` задаёт `aria-current=date`; активный фон принадлежит выбору. События показывают до пяти точек с авторскими вырезами; доступное имя сохраняет фактическое количество. `markers` — независимые отметки приложения.

`value` и `month` управляются независимо. Lit использует `value=null`, React отсутствие `value` для внутреннего состояния. При контролируемых входах события запрашивают изменение; интерфейс и форма показывают только принятое значение. Месяц нормализуется к первому дню. `FormData.getAll(name)` возвращает выбранные ISO-даты, в том числе промежуточное начало диапазона. `required` требует полного выбора; disabled и readonly освобождены от этой проверки. Reset восстанавливает начальный неконтролируемый выбор и месяц; управляемые входы остаются у приложения.

Клавиши: стрелки перемещают фокус по дням и неделям; Home/End — начало/конец недели; PageUp/PageDown — месяц, с Shift — год; Enter/Space — выбор. Tab выходит к следующему контролу. RTL меняет горизонтальное направление. На узком экране или при крупном тексте шапка остаётся в контейнере, а двумерная сетка получает собственную горизонтальную прокрутку с сохранением размера текста.

В исходном демонстрационном макете подпись «May, 2025» стоит над сеткой мая 2024 года. Реализация сохраняет авторскую геометрию и рассчитывает настоящие даты указанного года.

Источники поведения: [Zag Date Picker](https://zagjs.com/components/date-picker), [Internationalized Date](https://react-spectrum.adobe.com/internationalized/date/index.html), [Kotlin LocalDate](https://kotlinlang.org/api/kotlinx-datetime/kotlinx-datetime/kotlinx.datetime/-local-date/). Нативные платформы и проверки описаны в `native/compose/docs/calendar.md`.
