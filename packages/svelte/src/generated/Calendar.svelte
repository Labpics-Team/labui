<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/calendar';
  import type { LabCalendar } from '@labpics/ui-core/calendar';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-calendar> — типы взяты прямо из класса ядра (LabCalendar). */
  interface Props {
    dir?: LabCalendar['dir'];
    size?: LabCalendar['size'];
    selection?: LabCalendar['selection'];
    value?: LabCalendar['value'];
    defaultValue?: LabCalendar['defaultValue'];
    month?: LabCalendar['month'];
    defaultMonth?: LabCalendar['defaultMonth'];
    locale?: LabCalendar['locale'];
    firstDayOfWeek?: LabCalendar['firstDayOfWeek'];
    today?: LabCalendar['today'];
    min?: LabCalendar['min'];
    max?: LabCalendar['max'];
    disabled?: LabCalendar['disabled'];
    readonly?: LabCalendar['readonly'];
    required?: LabCalendar['required'];
    name?: LabCalendar['name'];
    label?: LabCalendar['label'];
    events?: LabCalendar['events'];
    markers?: LabCalendar['markers'];
    isDateUnavailable?: LabCalendar['isDateUnavailable'];
    unavailableDates?: LabCalendar['unavailableDates'];
    translations?: LabCalendar['translations'];
    onMonthChange?: (event: CustomEvent) => void;
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { dir: prop_dir, size: prop_size, selection: prop_selection, value: prop_value, defaultValue: prop_defaultValue, month: prop_month, defaultMonth: prop_defaultMonth, locale: prop_locale, firstDayOfWeek: prop_firstDayOfWeek, today: prop_today, min: prop_min, max: prop_max, disabled: prop_disabled, readonly: prop_readonly, required: prop_required, name: prop_name, label: prop_label, events: prop_events, markers: prop_markers, isDateUnavailable: prop_isDateUnavailable, unavailableDates: prop_unavailableDates, translations: prop_translations, onMonthChange, onValueChange, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'dir', attr: 'dir', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'selection', attr: 'selection', kind: 'string' },
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'defaultValue', kind: 'prop' },
    { name: 'month', attr: 'month', kind: 'string' },
    { name: 'defaultMonth', attr: 'default-month', kind: 'string' },
    { name: 'locale', attr: 'locale', kind: 'string' },
    { name: 'firstDayOfWeek', attr: 'first-day-of-week', kind: 'string' },
    { name: 'today', attr: 'today', kind: 'string' },
    { name: 'min', attr: 'min', kind: 'string' },
    { name: 'max', attr: 'max', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'events', attr: 'events', kind: 'prop' },
    { name: 'markers', attr: 'markers', kind: 'prop' },
    { name: 'isDateUnavailable', attr: 'isDateUnavailable', kind: 'prop' },
    { name: 'unavailableDates', attr: 'unavailableDates', kind: 'prop' },
    { name: 'translations', attr: 'translations', kind: 'prop' },
  ];

  const server = untrack(() => renderElementParts('lab-calendar', {
    specs, props: { dir: prop_dir, size: prop_size, selection: prop_selection, value: prop_value, defaultValue: prop_defaultValue, month: prop_month, defaultMonth: prop_defaultMonth, locale: prop_locale, firstDayOfWeek: prop_firstDayOfWeek, today: prop_today, min: prop_min, max: prop_max, disabled: prop_disabled, readonly: prop_readonly, required: prop_required, name: prop_name, label: prop_label, events: prop_events, markers: prop_markers, isDateUnavailable: prop_isDateUnavailable, unavailableDates: prop_unavailableDates, translations: prop_translations }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'month-change': onMonthChange, 'value-change': onValueChange }));
</script>

<lab-calendar bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { dir: prop_dir, size: prop_size, selection: prop_selection, value: prop_value, defaultValue: prop_defaultValue, month: prop_month, defaultMonth: prop_defaultMonth, locale: prop_locale, firstDayOfWeek: prop_firstDayOfWeek, today: prop_today, min: prop_min, max: prop_max, disabled: prop_disabled, readonly: prop_readonly, required: prop_required, name: prop_name, label: prop_label, events: prop_events, markers: prop_markers, isDateUnavailable: prop_isDateUnavailable, unavailableDates: prop_unavailableDates, translations: prop_translations } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-calendar>
