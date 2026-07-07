import '@labpics/ui-core/tags-input';
import type { LabTagsInput } from '@labpics/ui-core/tags-input';
import type { Snippet } from 'svelte';
/** Пропы <lab-tags-input> — типы взяты прямо из класса ядра (LabTagsInput). */
interface Props {
    type?: LabTagsInput['type'];
    size?: LabTagsInput['size'];
    label?: LabTagsInput['label'];
    labelHidden?: LabTagsInput['labelHidden'];
    helper?: LabTagsInput['helper'];
    error?: LabTagsInput['error'];
    placeholder?: LabTagsInput['placeholder'];
    max?: LabTagsInput['max'];
    delimiter?: LabTagsInput['delimiter'];
    editable?: LabTagsInput['editable'];
    addOnPaste?: LabTagsInput['addOnPaste'];
    allowDuplicates?: LabTagsInput['allowDuplicates'];
    value?: LabTagsInput['value'];
    defaultValue?: LabTagsInput['defaultValue'];
    readonly?: LabTagsInput['readonly'];
    disabled?: LabTagsInput['disabled'];
    required?: LabTagsInput['required'];
    invalid?: LabTagsInput['invalid'];
    name?: LabTagsInput['name'];
    onInputValueChange?: (event: CustomEvent) => void;
    onValueChange?: (event: CustomEvent) => void;
    onValueInvalid?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const TagsInput: import("svelte").Component<Props, {}, "">;
type TagsInput = ReturnType<typeof TagsInput>;
export default TagsInput;
//# sourceMappingURL=TagsInput.svelte.d.ts.map