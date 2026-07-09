# NAMING — канон имён labui

Роль: канон (SSOT нейминга воркспейса; машинную сверку держит
`check:docs-drift`, факты ФС собирает `scripts/naming-inventory.mjs`).

Канон согласован с эталоном репо lab-icons (NAMING.md + docs-drift-гейт):
kebab для файлов и CSS, домен-префиксы, вариант-суффиксы; вторые имена
руками не заводятся — производные получаются только механической
трансформацией из канонического имени.

## Инвентарь (сверяется гейтом)

| Метрика | Значение |
|---|---|
| workspace-пакетов | 15 |
| кастомных элементов `lab-*` | 28 |
| деклараций `--lab-*` в packages/** | 406 |
| деклараций вне `--lab-*` в packages/** | 2 |

## Домены конвенций

| Домен | Форма | Пример |
|---|---|---|
| npm-пакет | scope `@labpics/`; рендер-поверхности с префиксом `ui-`, ассеты/инструменты без него | @labpics/ui-react, @labpics/fonts |
| директория пакета | kebab; имя без scope и без `ui-` | packages/react |
| кастомный элемент | `lab-<компонент>`, kebab | `lab-number-input` |
| класс элемента | Pascal с префиксом Lab | LabNumberInput |
| фреймворк-обёртка | Pascal без префикса | NumberInput |
| CSS-переменная | `--lab-<домен>[-<роль>][-<вариант>]` | --lab-font-size-2xl |
| файл кода/стилей | kebab; пара имя-компонента: `lab-button.ts` + стиль компонента | packages/core/src/components/button/ |
| одно-компонентный файл фреймворка (.astro, .svelte) | Pascal = имя компонента (механическая транскрипция) | Button.astro |
| док | kebab `.md`; ADR — `NNNN-slug.md` в docs/adr/ | docs/adr/0006-dimensional-contract.md |

Границы регистров:

- **kebab** — файлы, теги элементов, CSS-переменные, ключи JSON-реестров;
- **lowerCamel** — JS-идентификаторы, пропсы, параметры;
- **Pascal** — классы (Lab-префикс только у кастомных элементов ядра),
  типы, одно-компонентные файлы фреймворков (граница слоёв, не дрейф);
- **SCREAMING / snake** — нигде в публичных контрактах.

Смешение доменов — не дрейф, а стык слоёв: тег всегда kebab, класс всегда
Pascal, переход — только механической трансформацией (kebab → Pascal).

## Карта пакетов (директория → имя)

| Директория | Пакет |
|---|---|
| apps/docs | @labpics/ui-docs |
| packages/adapter-codegen | @labpics/adapter-codegen |
| packages/astro | @labpics/ui-astro |
| packages/colors | @labui/colors |
| packages/colors-stub | @labpics/colors |
| packages/core | @labpics/ui-core |
| packages/fonts | @labpics/fonts |
| packages/icons | @labpics/icons |
| packages/materials | @labpics/ui-materials |
| packages/react | @labpics/ui-react |
| packages/shadow | @labpics/ui-shadow |
| packages/solid | @labpics/ui-solid |
| packages/svelte | @labpics/ui-svelte |
| packages/tokens | @labpics/ui-tokens |
| packages/vue | @labpics/ui-vue |

## CSS-переменные

Закон: в packages/** каждая декларация кастом-свойства начинается с
`--lab-` — это неймспейс системы, гейт валит новые декларации вне него.
Словарь доменов и шкалы (размеры xs…6xl, веса regular/medium/semibold/bold,
letter-spacing 2xl…6xl) — docs/vocabulary.md; SSOT размерных токенов —
пакет @labpics/ui-tokens. Моушен-неймспейс `--lab-motion-*` (duration,
easing, spring) согласован с репо lab-motion — @labpics/motion потребляет
те же имена (см. docs/motion-tokens.md). apps/** под закон не подпадают
(публикуемых поверхностей там нет; демо-переменные --demo-* в apps/docs —
локальный неймспейс доков).

## Известные отступления (план)

1. Scope-коллизия цветов: packages/colors = @labui/colors (движок в чужом
   scope), packages/colors-stub = @labpics/colors (стаб контракта,
   0.0.0-stub.0). План: при стабилизации движка — свап имён
   координированным мажором (движок публикуется как @labpics/colors,
   стаб уходит).
2. packages/icons = @labpics/icons (0.0.0-stub.0) — имя занято стабом,
   реальный пакет живёт в репо lab-icons. План: заменить стаб зависимостью
   на реальный пакет и удалить.
3. `--arrow-size`, `--arrow-background` в packages/react/src/popover.css и
   packages/react/src/tooltip.css — приватная конвенция floating-ui-стрелки
   вне неймспейса. План: увести под `--lab-arrow-size` /
   `--lab-arrow-background` одним правочным заходом в оба компонента.
4. docs/core-CONTRACT.md — SCREAMING-сегмент в имени файла. План:
   переименовать в core-contract.md отдельным docs-PR с обновлением ссылок.
5. Двойной номер ADR: docs/adr/0003-appendix-renderer-swappability.md и
   docs/adr/0003-glass-engine-token-landing.md. План: перенумеровать
   appendix следующим свободным номером, старое имя оставить ссылкой.
6. docs/adr/level-law-triage.md — не-ADR имя в доме ADR (без NNNN-префикса).
   План: перенести в docs/decisions/ или присвоить номер.
