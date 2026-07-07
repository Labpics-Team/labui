import '@labpics/ui-core/checkbox';
import type { LabCheckbox } from '@labpics/ui-core/checkbox';
import type { Snippet } from 'svelte';
/** Пропы <lab-checkbox> — типы взяты прямо из класса ядра (LabCheckbox). */
interface Props {
    type?: LabCheckbox['type'];
    size?: LabCheckbox['size'];
    checked?: LabCheckbox['checked'];
    indeterminate?: LabCheckbox['indeterminate'];
    defaultChecked?: LabCheckbox['defaultChecked'];
    defaultIndeterminate?: LabCheckbox['defaultIndeterminate'];
    disabled?: LabCheckbox['disabled'];
    name?: LabCheckbox['name'];
    onCheckedChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Checkbox: import("svelte").Component<Props, {}, "">;
type Checkbox = ReturnType<typeof Checkbox>;
export default Checkbox;
//# sourceMappingURL=Checkbox.svelte.d.ts.map