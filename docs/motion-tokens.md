# Motion-токены LabUI

Схема токенов движения на всю дизайн-систему: длительности, изинги, пружины и
семантические роли — с первоклассным `prefers-reduced-motion` и DTCG-экспортом.

Живёт в `@labpics/ui-tokens` отдельным доменом от размерных токенов (у него свои
DTCG-типы `duration`/`cubicBezier` и свой контракт reduced-motion), поэтому у
него **свой** генератор и свои артефакты — размерный контракт (`tokens.css`) не
затронут.

## Модель

Один типизированный конфиг (`src/motion/config.ts`) — единственный источник
истины. Чистый идемпотентный генератор производит три артефакта без расхождений:

| Артефакт | Что это | Импорт |
|---|---|---|
| `motion.css` | `:root { --lab-motion-* }` + блок `@media (prefers-reduced-motion)` | `@import "@labpics/ui-tokens/motion.css"` |
| `motion.dtcg.json` | канонический W3C DTCG-экспорт | `@labpics/ui-tokens/motion.dtcg.json` |
| сгенерированный TS | ссылки `var(--lab-motion-*)` + literal-union типы | `import { motionSemantic } from "@labpics/ui-tokens"` |

**Два яруса.** Физический (длительности, изинги, пружины) — конкретные значения.
Семантический (`entrance` / `exit` / `transition` / `emphasis`) — **ссылки** на
физический ярус, значения не дублируются. Переопределение физического токена на
`:root` доходит до каждой роли и каждого потребителя без пересборки.

**Характер: сдержанность уровня Apple.** Дефолты не кричат — `standard`,
`decelerate`, `accelerate` никогда не дают overshoot. Overshoot есть ровно в
одном месте — кривой `emphasized` и пружине `expressive`, зарезервированных под
роль `emphasis`. Никаких каруселей.

## Физический ярус

### Длительности `--lab-motion-duration-*`

Компактная шкала из 5 ступеней. Значения заземлены на сходящихся индустриальных
сетках (M3 50–1000ms, Fluent 50–500ms, Carbon 70–700ms) — спайн 100/200/300/500
там, где все три совпадают.

| Токен | ms | Назначение |
|---|---|---|
| `instant` | 0 | нет анимации — нулевой якорь и цель reduced-motion |
| `fast` | 100 | микровзаимодействия — hover, мелкая смена состояния |
| `base` | 200 | дефолт — большинство переходов компонентов |
| `slow` | 300 | элементы покрупнее, более намеренные перемещения |
| `slower` | 500 | полноэкранные / крупные переходы поверхностей |

### Изинги `--lab-motion-easing-*` (cubic-bezier)

Три сдержанных дефолта на официальных изингах M3 плюс единственная кривая с
overshoot.

| Токен | cubic-bezier | Назначение |
|---|---|---|
| `standard` | `0.2, 0, 0, 1` | универсальный — оба конца смягчены |
| `decelerate` | `0, 0, 0, 1` | входы — быстро внутрь, мягкая посадка |
| `accelerate` | `0.3, 0, 1, 1` | выходы — мягкий старт, быстрый уход |
| `emphasized` | `0.38, 1.21, 0.22, 1` | единственный сдержанный overshoot (`y1=1.21`) |

DTCG 2025.10 разрешает `y`-координаты вне `[0, 1]` (x — строго `[0, 1]`), поэтому
overshoot честно выражается как `y1 > 1`.

### Пружины `--lab-motion-spring-*`

Каноническая модель — человеко-понятная пара **(duration, bounce)** (модель
SwiftUI / Motion.dev, рекомендация Stage-0 исследования): единственное
представление, одновременно читаемое дизайнером и детерминированно
конвертируемое на любую платформу. Из неё выводится физическая тройка в
конвенции безразмерного `dampingRatio` (общей для Compose / iOS / SwiftUI):

```
dampingRatio ζ = 1 − bounce            (bounce = 1 − ζ)
mass m         = 1
ω₀             = 2π / duration
stiffness k    = ω₀²·m
damping c      = 2·ζ·√(k·m) = 2·ζ·ω₀·m
```

Cubic-bezier умеет максимум один overshoot; настоящая пружина может звенеть.
Поэтому точный веб-фолбэк — **CSS `linear()`**: пружина сэмплируется в набор
точек (как `spring()` в Motion.dev). `linear()` **генерируется** из параметров
(`src/motion/spring.ts`), не пишется руками, — фолбэк не может разойтись с
физикой.

| Токен | Категория | duration | bounce | Назначение |
|---|---|---|---|---|
| `smooth` | effects | 0.35s | 0 (ζ=1, крит.) | opacity/цвет, прерываемая, без отскока |
| `expressive` | spatial | 0.5s | 0.3 (ζ=0.7) | единственный сдержанный overshoot (~4.6%), под `emphasis` |

Категории по образцу M3: `spatial` (позиция/размер, overshoot разрешён) и
`effects` (цвет/прозрачность, `dampingRatio=1`, без overshoot — гарантируется
валидатором сборки). Каждой пружине эмитится парный `--lab-motion-spring-*-duration`
(в ms), чтобы потребитель применял `linear()` с правильной длительностью.

## Семантический ярус `--lab-motion-<роль>-*`

Роли ссылаются на физический ярус (`var(...)`), значения не дублируют. Направления
(`decelerate`→вход, `accelerate`→выход) заземлены на M3.

| Роль | duration | easing | spring | Смысл |
|---|---|---|---|---|
| `entrance` | `base` | `decelerate` | — | элемент появляется и садится на место |
| `exit` | `fast` | `accelerate` | — | элемент уходит, быстрее входа |
| `transition` | `base` | `standard` | — | смена состояния / перемещение на месте |
| `emphasis` | `slow` | `emphasized` | `expressive` | момент внимания — здесь живёт overshoot |

В DTCG каждая роль — composite `transition` (`{ duration, delay, timingFunction }`)
со **ссылками** (`{motion.duration.base}`), а не значениями.

## Reduced-motion — первоклассно

`motion.css` содержит блок `@media (prefers-reduced-motion: reduce)`, который
**переопределяет** переменные каждой семантической роли. Это часть контракта, а
не забота потребителя:

- все изинги → `linear` (весь overshoot и пружинность сняты);
- `entrance` / `exit` → короткий `fast` (безопасный для вестибулярного аппарата
  opacity-кроссфейд);
- `transition` / `emphasis` → `instant` (жёсткий снап);
- пружина роли схлопывается в `linear`.

Каждая роль получает явное reduced-значение (замок теста проверяет полноту). В
DTCG это несётся в `$extensions` (DTCG-механизм контекстов `full`/`reduced` пока
черновой), поле `reducedMotion` с `timingFunction: [0,0,1,1]`.

Гайд потребителю: под reduced-motion анимируйте у `entrance`/`exit` только
`opacity` (кроссфейд); токен гарантирует отсутствие изинг/пружинного движения и
время ≤100ms линейно.

## DTCG-формат

- `duration` → `$type: "duration"`, `$value: { value, unit: "ms" }` (2025.10).
- `easing` → `$type: "cubicBezier"`, `$value: [x1, y1, x2, y2]`.
- `transition` → composite со ссылками.
- **Пружины** первоклассного DTCG-типа не имеют. Эмитятся с **мягкой
  деградацией**: `$type: "cubicBezier"` с фолбэк-кривой в `$value` (инструмент
  без поддержки расширения получит рабочий изинг), а полная пружина честно
  объявлена в `$extensions."com.labpics.motion"` — каноническая пара, выведенная
  тройка и сгенерированный `linear()`.

Провенанс каждого токена тоже лежит в `$extensions."com.labpics.motion".provenance`.

## Таблица провенанса (ADR-0002)

Каждое значение — либо **(b)** заземлено на источник из исследования владельца,
либо **(e)** честный design-choice. Фейк-(b) (выдуманное число со ссылкой)
запрещён и блокируется валидатором сборки (`(b)` без источника → ошибка).

| Токен | Класс | Источник / обоснование |
|---|---|---|
| `duration.instant` (0ms) | **e** | нулевой якорь (закон репо: у каждой шкалы есть ноль) + цель reduced-motion |
| `duration.fast` (100ms) | **b** | Fluent durationFaster 100ms (§2); M3 short2 100ms (§1.1) |
| `duration.base` (200ms) | **b** | Fluent durationNormal 200ms (§2); M3 short4 200ms (§1.1) |
| `duration.slow` (300ms) | **b** | M3 medium2 300ms (§1.1); сосед Carbon moderate-02 240ms (§3) |
| `duration.slower` (500ms) | **b** | M3 long2 500ms (§1.1); верхняя полоса Fluent ≈500ms (§2) |
| `easing.standard` | **b** | M3 easing-standard `cubic-bezier(0.2,0,0,1)` (§1.1) |
| `easing.decelerate` | **b** | M3 easing-standard-decelerate `(0,0,0,1)` (§1.1) |
| `easing.accelerate` | **b** | M3 easing-standard-accelerate `(0.3,0,1,1)` (§1.1) |
| `easing.emphasized` | **b**\* | M3 Expressive Spatial default web-fallback `(0.38,1.21,0.22,1)` (§1.2) |
| `spring.smooth` bounce=0 | **b** | bounce 0 = критическое затухание, без overshoot (§6; M3 effects `dampingRatio=1`, §1.2) |
| `spring.smooth` duration 0.35s | **e** | design-choice, полоса base/slow |
| `spring.expressive` bounce=0.3 | **e** | design-choice: сдержанный overshoot ~4.6%; категория spatial заземлена (§1.2), модель (duration,bounce) заземлена (§6/Stage 0) |
| `spring.expressive` duration 0.5s | **e** | design-choice, полоса slower |
| модель пружины (duration,bounce)+тройка | **b** | исследование Stage 0 / §6 (`dampingRatio=1−bounce`, `mass=1`) |
| `entrance` (decelerate) | **b** | M3: входящие используют decelerate (§1.1) |
| `exit` (accelerate) | **b** | M3: выходящие используют accelerate (§1.1); «выход быстрее входа» — (e)-конвенция HIG/Material |
| `transition` (standard) | **b** | M3: standard для смены на месте (§1.1) |
| `emphasis` | **e** | design-choice: единственный момент с overshoot; изинг заземлён (§1.2) |

Итог: **13 (b)** и **5 (e)** (плюс строка «модель пружины» — методологическое
заземление, а не отдельный узел DTCG).

\* **Оговорка по `emphasized`.** Значение `0.38,1.21,0.22,1` взято из исследования
(§1.2), но там оно из вторичного источника (воспроизведение спеки M3 на CodePen),
помеченного «сверить с m3.material.io перед бампом». Это настоящий (b) (число
прослеживается до источника из исследования, не выдумано), но с оговоркой — при
изменении значения сверить с первоисточником Google.

Ссылки на разделы — по файлу исследования владельца (M3 §1.1/§1.2, Fluent §2,
Carbon §3, параметризация пружин §6, рекомендации Stage 0/2).

## Использование

```ts
import { motionSemantic, motionDuration, motionEasing } from '@labpics/ui-tokens';

// Семантика (рекомендуется): роль сама несёт длительность и изинг.
element.style.transition =
  `opacity ${motionSemantic.entrance.duration} ${motionSemantic.entrance.easing}`;

// Пружина как linear()-фолбэк: значение + парная длительность.
import { motionSpring, motionSpringDuration } from '@labpics/ui-tokens';
element.style.transition =
  `transform ${motionSpringDuration.expressive} ${motionSpring.expressive}`;
```

Или на CSS напрямую после `@import`:

```css
.dialog { transition: opacity var(--lab-motion-entrance-duration) var(--lab-motion-entrance-easing); }
```

## Сборка

```sh
pnpm --filter @labpics/ui-tokens generate   # регенерирует размерные + motion-артефакты
pnpm --filter @labpics/ui-tokens test       # vitest: физика, схема, reduced-motion, дрифт
```

Сгенерированные файлы в `src/generated/` закоммичены; гейт `check-generated`
ловит их дрейф от конфига.
