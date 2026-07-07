import '@labpics/ui-core/pin-input';
import type { LabPinInput } from '@labpics/ui-core/pin-input';
import type { Snippet } from 'svelte';
/** Пропы <lab-pin-input> — типы взяты прямо из класса ядра (LabPinInput). */
interface Props {
    type?: LabPinInput['type'];
    size?: LabPinInput['size'];
    label?: LabPinInput['label'];
    labelHidden?: LabPinInput['labelHidden'];
    helper?: LabPinInput['helper'];
    error?: LabPinInput['error'];
    count?: LabPinInput['count'];
    valueType?: LabPinInput['valueType'];
    mask?: LabPinInput['mask'];
    otp?: LabPinInput['otp'];
    placeholder?: LabPinInput['placeholder'];
    value?: LabPinInput['value'];
    defaultValue?: LabPinInput['defaultValue'];
    readonly?: LabPinInput['readonly'];
    disabled?: LabPinInput['disabled'];
    required?: LabPinInput['required'];
    invalid?: LabPinInput['invalid'];
    name?: LabPinInput['name'];
    onValueChange?: (event: CustomEvent) => void;
    onValueComplete?: (event: CustomEvent) => void;
    onValueInvalid?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const PinInput: import("svelte").Component<Props, {}, "">;
type PinInput = ReturnType<typeof PinInput>;
export default PinInput;
//# sourceMappingURL=PinInput.svelte.d.ts.map