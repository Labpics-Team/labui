import '@labpics/ui-core/textarea';
import type { LabTextarea } from '@labpics/ui-core/textarea';
import type { Snippet } from 'svelte';
/** Пропы <lab-textarea> — типы взяты прямо из класса ядра (LabTextarea). */
interface Props {
    type?: LabTextarea['type'];
    size?: LabTextarea['size'];
    label?: LabTextarea['label'];
    labelHidden?: LabTextarea['labelHidden'];
    helper?: LabTextarea['helper'];
    error?: LabTextarea['error'];
    value?: LabTextarea['value'];
    placeholder?: LabTextarea['placeholder'];
    rows?: LabTextarea['rows'];
    autoResize?: LabTextarea['autoResize'];
    readonly?: LabTextarea['readonly'];
    disabled?: LabTextarea['disabled'];
    required?: LabTextarea['required'];
    invalid?: LabTextarea['invalid'];
    name?: LabTextarea['name'];
    onLabChange?: (event: CustomEvent) => void;
    onLabInput?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Textarea: import("svelte").Component<Props, {}, "">;
type Textarea = ReturnType<typeof Textarea>;
export default Textarea;
//# sourceMappingURL=Textarea.svelte.d.ts.map