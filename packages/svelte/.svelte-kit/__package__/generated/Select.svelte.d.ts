import '@labpics/ui-core/select';
import type { LabSelect } from '@labpics/ui-core/select';
import type { Snippet } from 'svelte';
/** Пропы <lab-select> — типы взяты прямо из класса ядра (LabSelect). */
interface Props {
    size?: LabSelect['size'];
    placement?: LabSelect['placement'];
    multiple?: LabSelect['multiple'];
    disabled?: LabSelect['disabled'];
    name?: LabSelect['name'];
    placeholder?: LabSelect['placeholder'];
    label?: LabSelect['label'];
    value?: LabSelect['value'];
    defaultValue?: LabSelect['defaultValue'];
    items?: LabSelect['items'];
    onOpenChange?: (event: CustomEvent) => void;
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Select: import("svelte").Component<Props, {}, "">;
type Select = ReturnType<typeof Select>;
export default Select;
//# sourceMappingURL=Select.svelte.d.ts.map