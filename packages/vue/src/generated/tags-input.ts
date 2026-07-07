/**
 * СГЕНЕРИРОВАНО @labpics/adapter-codegen — НЕ РЕДАКТИРОВАТЬ вручную.
 * Источник истины: packages/adapter-codegen/manifest.generated.json,
 * выведенный из исходников @labpics/ui-core (тэги lab-*, @property, события).
 * Регенерация: pnpm --filter @labpics/adapter-codegen generate.
 * Правки вносить в генератор/манифест, иначе перегенерация их сотрёт.
 */
import '@labpics/ui-core/tags-input';
import type { LabTagsInput } from '@labpics/ui-core/tags-input';
import { type LabComponent, createLabComponent } from '../runtime/create-lab-component.js';

/** Пропы <lab-tags-input>, взятые прямо из класса ядра (LabTagsInput). */
export type TagsInputProps = Pick<LabTagsInput, 'type' | 'size' | 'label' | 'labelHidden' | 'helper' | 'error' | 'placeholder' | 'max' | 'delimiter' | 'editable' | 'addOnPaste' | 'allowDuplicates' | 'value' | 'defaultValue' | 'readonly' | 'disabled' | 'required' | 'invalid' | 'name'>;

/**
 * <TagsInput> — тонкая Vue-обёртка над <lab-tags-input>.
 * События: onInputValueChange, onValueChange, onValueInvalid.
 */
export const TagsInput: LabComponent<TagsInputProps, 'input-value-change' | 'value-change' | 'value-invalid'> = createLabComponent<
  TagsInputProps,
  'input-value-change' | 'value-change' | 'value-invalid'
>('lab-tags-input', {
  props: ['type', 'size', 'label', 'labelHidden', 'helper', 'error', 'placeholder', 'max', 'delimiter', 'editable', 'addOnPaste', 'allowDuplicates', 'value', 'defaultValue', 'readonly', 'disabled', 'required', 'invalid', 'name'],
  specs: [
      { name: 'type', attr: 'type', kind: 'string' },
      { name: 'size', attr: 'size', kind: 'string' },
      { name: 'label', attr: 'label', kind: 'string' },
      { name: 'labelHidden', attr: 'label-hidden', kind: 'boolean' },
      { name: 'helper', attr: 'helper', kind: 'string' },
      { name: 'error', attr: 'error', kind: 'string' },
      { name: 'placeholder', attr: 'placeholder', kind: 'string' },
      { name: 'max', attr: 'max', kind: 'string' },
      { name: 'delimiter', attr: 'delimiter', kind: 'string' },
      { name: 'editable', attr: 'editable', kind: 'boolean' },
      { name: 'addOnPaste', attr: 'add-on-paste', kind: 'boolean' },
      { name: 'allowDuplicates', attr: 'allow-duplicates', kind: 'boolean' },
      { name: 'value', attr: 'value', kind: 'prop' },
      { name: 'defaultValue', attr: 'default-value', kind: 'prop' },
      { name: 'readonly', attr: 'readonly', kind: 'boolean' },
      { name: 'disabled', attr: 'disabled', kind: 'boolean' },
      { name: 'required', attr: 'required', kind: 'boolean' },
      { name: 'invalid', attr: 'invalid', kind: 'boolean' },
      { name: 'name', attr: 'name', kind: 'string' },
  ],
  events: ['input-value-change', 'value-change', 'value-invalid'],
});
