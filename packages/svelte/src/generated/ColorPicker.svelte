<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/color-picker';
  import type { LabColorPicker } from '@labpics/ui-core/color-picker';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-color-picker> — типы взяты прямо из класса ядра (LabColorPicker). */
  interface Props {
    value?: LabColorPicker['value'];
    defaultValue?: LabColorPicker['defaultValue'];
    variant?: LabColorPicker['variant'];
    model?: LabColorPicker['model'];
    defaultVariant?: LabColorPicker['defaultVariant'];
    defaultModel?: LabColorPicker['defaultModel'];
    label?: LabColorPicker['label'];
    name?: LabColorPicker['name'];
    form?: LabColorPicker['form'];
    disabled?: LabColorPicker['disabled'];
    readonly?: LabColorPicker['readonly'];
    required?: LabColorPicker['required'];
    pickScreenColor?: LabColorPicker['pickScreenColor'];
    onCloseRequest?: (event: CustomEvent) => void;
    onModelChange?: (event: CustomEvent) => void;
    onValueChange?: (event: CustomEvent) => void;
    onValueChangeEnd?: (event: CustomEvent) => void;
    onVariantChange?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { value: prop_value, defaultValue: prop_defaultValue, variant: prop_variant, model: prop_model, defaultVariant: prop_defaultVariant, defaultModel: prop_defaultModel, label: prop_label, name: prop_name, form: prop_form, disabled: prop_disabled, readonly: prop_readonly, required: prop_required, pickScreenColor: prop_pickScreenColor, onCloseRequest, onModelChange, onValueChange, onValueChangeEnd, onVariantChange, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'value', attr: 'value', kind: 'prop' },
    { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
    { name: 'variant', attr: 'variant', kind: 'string' },
    { name: 'model', attr: 'model', kind: 'string' },
    { name: 'defaultVariant', attr: 'default-variant', kind: 'string' },
    { name: 'defaultModel', attr: 'default-model', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'form', attr: 'form', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'pickScreenColor', attr: 'pickScreenColor', kind: 'prop' },
  ];

  const server = untrack(() => renderElementParts('lab-color-picker', {
    specs, props: { value: prop_value, defaultValue: prop_defaultValue, variant: prop_variant, model: prop_model, defaultVariant: prop_defaultVariant, defaultModel: prop_defaultModel, label: prop_label, name: prop_name, form: prop_form, disabled: prop_disabled, readonly: prop_readonly, required: prop_required, pickScreenColor: prop_pickScreenColor }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'close-request': onCloseRequest, 'model-change': onModelChange, 'value-change': onValueChange, 'value-change-end': onValueChangeEnd, 'variant-change': onVariantChange }));
</script>

<lab-color-picker bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { value: prop_value, defaultValue: prop_defaultValue, variant: prop_variant, model: prop_model, defaultVariant: prop_defaultVariant, defaultModel: prop_defaultModel, label: prop_label, name: prop_name, form: prop_form, disabled: prop_disabled, readonly: prop_readonly, required: prop_required, pickScreenColor: prop_pickScreenColor } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-color-picker>
