<!-- СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную. -->
<!-- Источник истины: packages/adapter-codegen/manifest.generated.json, -->
<!-- выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события). -->
<!-- Регенерация: pnpm --filter @labpics/adapter-codegen generate. -->
<!-- Правки вносить в генератор/манифест, иначе перегенерация их сотрёт. -->
<script lang="ts">
  import { renderElementParts } from '@labpics/ui-core/element-ssr';
  import '@labpics/ui-core/file-upload';
  import type { LabFileUpload } from '@labpics/ui-core/file-upload';
  import { type Snippet, untrack } from 'svelte';
  import { LAB_INPUTS_PROPERTY, type LabPropSpec, forwardEvents } from '../runtime/forward.js';
  import { slotProjectionShadowHtml } from '@labpics/ui-core/adapter-runtime';

  /** Пропы <lab-file-upload> — типы взяты прямо из класса ядра (LabFileUpload). */
  interface Props {
    view?: LabFileUpload['view'];
    size?: LabFileUpload['size'];
    label?: LabFileUpload['label'];
    labelHidden?: LabFileUpload['labelHidden'];
    helper?: LabFileUpload['helper'];
    error?: LabFileUpload['error'];
    name?: LabFileUpload['name'];
    accept?: LabFileUpload['accept'];
    multiple?: LabFileUpload['multiple'];
    maxFiles?: LabFileUpload['maxFiles'];
    maxFileSize?: LabFileUpload['maxFileSize'];
    minFileSize?: LabFileUpload['minFileSize'];
    disabled?: LabFileUpload['disabled'];
    readonly?: LabFileUpload['readonly'];
    required?: LabFileUpload['required'];
    invalid?: LabFileUpload['invalid'];
    acceptedFiles?: LabFileUpload['acceptedFiles'];
    defaultAcceptedFiles?: LabFileUpload['defaultAcceptedFiles'];
    translations?: LabFileUpload['translations'];
    onFileChange?: (event: CustomEvent) => void;
    onFileReject?: (event: CustomEvent) => void;
    children?: Snippet;
    slots?: Readonly<Record<string, Snippet | undefined>>;
    [key: string]: unknown;
  }

  let { view: prop_view, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, name: prop_name, accept: prop_accept, multiple: prop_multiple, maxFiles: prop_maxFiles, maxFileSize: prop_maxFileSize, minFileSize: prop_minFileSize, disabled: prop_disabled, readonly: prop_readonly, required: prop_required, invalid: prop_invalid, acceptedFiles: prop_acceptedFiles, defaultAcceptedFiles: prop_defaultAcceptedFiles, translations: prop_translations, onFileChange, onFileReject, children, slots, ...rest }: Props = $props();

  const specs: LabPropSpec[] = [
    { name: 'view', attr: 'view', kind: 'string' },
    { name: 'size', attr: 'size', kind: 'string' },
    { name: 'label', attr: 'label', kind: 'string' },
    { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
    { name: 'helper', attr: 'helper', kind: 'string' },
    { name: 'error', attr: 'error', kind: 'string' },
    { name: 'name', attr: 'name', kind: 'string' },
    { name: 'accept', attr: 'accept', kind: 'string' },
    { name: 'multiple', attr: 'multiple', kind: 'boolean' },
    { name: 'maxFiles', attr: 'max-files', kind: 'string' },
    { name: 'maxFileSize', attr: 'max-file-size', kind: 'string' },
    { name: 'minFileSize', attr: 'min-file-size', kind: 'string' },
    { name: 'disabled', attr: 'disabled', kind: 'boolean' },
    { name: 'readonly', attr: 'readonly', kind: 'boolean' },
    { name: 'required', attr: 'required', kind: 'boolean' },
    { name: 'invalid', attr: 'invalid', kind: 'boolean' },
    { name: 'acceptedFiles', attr: 'acceptedFiles', kind: 'prop' },
    { name: 'defaultAcceptedFiles', attr: 'defaultAcceptedFiles', kind: 'prop' },
    { name: 'translations', attr: 'translations', kind: 'prop' },
  ];

  const server = untrack(() => renderElementParts('lab-file-upload', {
    specs, props: { view: prop_view, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, name: prop_name, accept: prop_accept, multiple: prop_multiple, maxFiles: prop_maxFiles, maxFileSize: prop_maxFileSize, minFileSize: prop_minFileSize, disabled: prop_disabled, readonly: prop_readonly, required: prop_required, invalid: prop_invalid, acceptedFiles: prop_acceptedFiles, defaultAcceptedFiles: prop_defaultAcceptedFiles, translations: prop_translations }, attributes: rest,
  }));
  let namedContent: Readonly<Record<string, Snippet | undefined>> = $derived({ ...slots });

  let el: HTMLElement | undefined = $state();

  $effect(() => forwardEvents(el, { 'file-change': onFileChange, 'file-reject': onFileReject }));
</script>

<lab-file-upload bind:this={el} {...server?.attributes} {...rest} {...server ? {} : { [LAB_INPUTS_PROPERTY]: { specs, props: { view: prop_view, size: prop_size, label: prop_label, labelHidden: prop_labelHidden, helper: prop_helper, error: prop_error, name: prop_name, accept: prop_accept, multiple: prop_multiple, maxFiles: prop_maxFiles, maxFileSize: prop_maxFileSize, minFileSize: prop_minFileSize, disabled: prop_disabled, readonly: prop_readonly, required: prop_required, invalid: prop_invalid, acceptedFiles: prop_acceptedFiles, defaultAcceptedFiles: prop_defaultAcceptedFiles, translations: prop_translations } } }}>
  {@html server?.shadowHtml ?? ''}
  {#each Object.entries(namedContent) as [name, content] (name)}
    {#if content}<lab-slot {...{ slot: name }}>{@html server ? slotProjectionShadowHtml : ''}{@render content()}</lab-slot>{/if}
  {/each}
</lab-file-upload>
