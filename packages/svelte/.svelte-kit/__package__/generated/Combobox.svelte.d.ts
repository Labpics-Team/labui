import '@labpics/ui-core/combobox';
import type { LabCombobox } from '@labpics/ui-core/combobox';
import type { Snippet } from 'svelte';
/** Пропы <lab-combobox> — типы взяты прямо из класса ядра (LabCombobox). */
interface Props {
    type?: LabCombobox['type'];
    size?: LabCombobox['size'];
    placement?: LabCombobox['placement'];
    multiple?: LabCombobox['multiple'];
    disabled?: LabCombobox['disabled'];
    readonly?: LabCombobox['readonly'];
    required?: LabCombobox['required'];
    invalid?: LabCombobox['invalid'];
    name?: LabCombobox['name'];
    placeholder?: LabCombobox['placeholder'];
    label?: LabCombobox['label'];
    labelHidden?: LabCombobox['labelHidden'];
    helper?: LabCombobox['helper'];
    error?: LabCombobox['error'];
    value?: LabCombobox['value'];
    defaultValue?: LabCombobox['defaultValue'];
    items?: LabCombobox['items'];
    onInputValueChange?: (event: CustomEvent) => void;
    onOpenChange?: (event: CustomEvent) => void;
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Combobox: import("svelte").Component<Props, {}, "">;
type Combobox = ReturnType<typeof Combobox>;
export default Combobox;
//# sourceMappingURL=Combobox.svelte.d.ts.map