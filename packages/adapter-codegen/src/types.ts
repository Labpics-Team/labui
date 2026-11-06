/**
 * Типы манифеста компонентов — единый контракт между анализатором ядра и
 * генераторами обёрток. Манифест ВЫВОДИТСЯ из исходников @labpics/ui-core
 * (`analyze.ts`), поэтому здесь — только форма данных, без знания о фреймворках.
 *
 * Почему манифест, а не ручные обёртки: 27 элементов × 4 фреймворка = 108 файлов.
 * Ручной труд дрейфует от ядра. Манифест — SSOT: элемент добавлен в ядро →
 * перегенерация подхватывает его во всех адаптерах, а golden-тест ловит расхождение.
 */

/**
 * Способ передачи пропа на кастом-элемент. Определяет, как генерируемая обёртка
 * пробрасывает значение — атрибутом (SSR-безопасно, до upgrade) или JS-свойством
 * (единственный корректный путь для массивов/объектов после upgrade).
 *
 * Выводится ЧИСТО из `static properties` элемента (без чтения `declare`-типов):
 *   - 'boolean' — опция `type: Boolean`. Атрибут-флаг: `value || undefined`
 *     (голый `false` дал бы `attr="false"`, а Lit читает присутствие как true).
 *   - 'prop'    — опция `attribute: false` ИЛИ наличие `converter` (проп несёт
 *     массив/объект/контролируемое значение; атрибут из массива = "[object Object]").
 *   - 'string'  — всё остальное: примитивный строковый атрибут.
 */
export type PropKind = 'boolean' | 'prop' | 'string';

/** Один реактивный проп элемента, пригодный для проброса обёрткой. */
export interface PropMeta {
  /** Имя свойства (camelCase), как в классе и в TS-типе. Ключ для `Pick<Class, …>`. */
  readonly name: string;
  /** Имя атрибута на хосте (для 'string'/'boolean'). Явное из `attribute:` или =name. */
  readonly attr: string;
  /** Способ проброса — см. {@link PropKind}. */
  readonly kind: PropKind;
}

/** Слоты элемента — что проецируется в его shadow DOM. */
export interface SlotMeta {
  /** Есть безымянный `<slot>` (контент по умолчанию). */
  readonly default: boolean;
  /** Статические именованные слоты, напр. ['content','icon']. */
  readonly named: readonly string[];
  /** Есть динамические слоты `<slot name=${…}>` (tabs/accordion — имя = значение
   * элемента, перечислить нельзя). Форвардятся сырыми light-DOM детьми с `slot=`. */
  readonly dynamic: boolean;
  /**
   * <slot data-sizing="fill">: размер задаёт ядро, прямой ребёнок адаптерной
   * коробки заполняет его. Имена/размеры не выводятся из назначения компонента.
   */
  readonly fill?: readonly string[];
  /** <slot data-projection="direct"> принимает один настоящий элемент без коробки адаптера. */
  readonly direct?: readonly string[];
}

/** Один компонент ядра, представленный кастом-элементом `<lab-*>`. */
export interface ComponentMeta {
  /** Тег кастом-элемента, напр. 'lab-button'. */
  readonly tag: string;
  /** Subpath импорта = имя каталога = tag без 'lab-', напр. 'button'. Регистрация:
   * `import '@labpics/ui-core/<subpath>'`. */
  readonly subpath: string;
  /** Имя экспорта обёртки (PascalCase), напр. 'AlertDialog'. */
  readonly pascal: string;
  /** Имя класса элемента в ядре, напр. 'LabButton'. Источник TS-типов пропов. */
  readonly className: string;
  /** Реактивные пропы (исключая нативные aria-* — они проходят fall-through). */
  readonly props: readonly PropMeta[];
  /** Имена кастом-событий (kebab), напр. ['value-change','open-change']. */
  readonly events: readonly string[];
  /** Слоты элемента. */
  readonly slots: SlotMeta;
}

/** Полный манифест — отсортированный по subpath список компонентов. */
export interface Manifest {
  /** Версия формата — на случай эволюции генераторов. */
  readonly version: 1;
  readonly components: readonly ComponentMeta[];
}
