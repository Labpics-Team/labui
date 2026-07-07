import '@labpics/ui-core/radio-group';
import type { LabRadioGroup } from '@labpics/ui-core/radio-group';
import type { Snippet } from 'svelte';
/** Пропы <lab-radio-group> — типы взяты прямо из класса ядра (LabRadioGroup). */
interface Props {
    type?: LabRadioGroup['type'];
    size?: LabRadioGroup['size'];
    orientation?: LabRadioGroup['orientation'];
    value?: LabRadioGroup['value'];
    defaultValue?: LabRadioGroup['defaultValue'];
    disabled?: LabRadioGroup['disabled'];
    name?: LabRadioGroup['name'];
    label?: LabRadioGroup['label'];
    items?: LabRadioGroup['items'];
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const RadioGroup: import("svelte").Component<Props, {}, "">;
type RadioGroup = ReturnType<typeof RadioGroup>;
export default RadioGroup;
//# sourceMappingURL=RadioGroup.svelte.d.ts.map