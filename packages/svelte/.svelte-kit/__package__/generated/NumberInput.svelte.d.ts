import '@labpics/ui-core/number-input';
import type { LabNumberInput } from '@labpics/ui-core/number-input';
import type { Snippet } from 'svelte';
/** Пропы <lab-number-input> — типы взяты прямо из класса ядра (LabNumberInput). */
interface Props {
    type?: LabNumberInput['type'];
    size?: LabNumberInput['size'];
    label?: LabNumberInput['label'];
    labelHidden?: LabNumberInput['labelHidden'];
    helper?: LabNumberInput['helper'];
    error?: LabNumberInput['error'];
    value?: LabNumberInput['value'];
    defaultValue?: LabNumberInput['defaultValue'];
    placeholder?: LabNumberInput['placeholder'];
    min?: LabNumberInput['min'];
    max?: LabNumberInput['max'];
    step?: LabNumberInput['step'];
    scrubber?: LabNumberInput['scrubber'];
    allowMouseWheel?: LabNumberInput['allowMouseWheel'];
    readonly?: LabNumberInput['readonly'];
    disabled?: LabNumberInput['disabled'];
    required?: LabNumberInput['required'];
    invalid?: LabNumberInput['invalid'];
    name?: LabNumberInput['name'];
    onValueChange?: (event: CustomEvent) => void;
    onValueCommit?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const NumberInput: import("svelte").Component<Props, {}, "">;
type NumberInput = ReturnType<typeof NumberInput>;
export default NumberInput;
//# sourceMappingURL=NumberInput.svelte.d.ts.map