import '@labpics/ui-core/input';
import type { LabInput } from '@labpics/ui-core/input';
import type { Snippet } from 'svelte';
/** Пропы <lab-input> — типы взяты прямо из класса ядра (LabInput). */
interface Props {
    type?: LabInput['type'];
    size?: LabInput['size'];
    label?: LabInput['label'];
    labelHidden?: LabInput['labelHidden'];
    helper?: LabInput['helper'];
    error?: LabInput['error'];
    value?: LabInput['value'];
    placeholder?: LabInput['placeholder'];
    inputType?: LabInput['inputType'];
    autocomplete?: LabInput['autocomplete'];
    readonly?: LabInput['readonly'];
    disabled?: LabInput['disabled'];
    required?: LabInput['required'];
    invalid?: LabInput['invalid'];
    name?: LabInput['name'];
    onLabChange?: (event: CustomEvent) => void;
    onLabInput?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Input: import("svelte").Component<Props, {}, "">;
type Input = ReturnType<typeof Input>;
export default Input;
//# sourceMappingURL=Input.svelte.d.ts.map