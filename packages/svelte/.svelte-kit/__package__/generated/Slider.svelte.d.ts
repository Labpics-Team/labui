import '@labpics/ui-core/slider';
import type { LabSlider } from '@labpics/ui-core/slider';
import type { Snippet } from 'svelte';
/** Пропы <lab-slider> — типы взяты прямо из класса ядра (LabSlider). */
interface Props {
    size?: LabSlider['size'];
    orientation?: LabSlider['orientation'];
    label?: LabSlider['label'];
    labelHidden?: LabSlider['labelHidden'];
    helper?: LabSlider['helper'];
    error?: LabSlider['error'];
    value?: LabSlider['value'];
    defaultValue?: LabSlider['defaultValue'];
    min?: LabSlider['min'];
    max?: LabSlider['max'];
    step?: LabSlider['step'];
    marks?: LabSlider['marks'];
    showValue?: LabSlider['showValue'];
    readonly?: LabSlider['readonly'];
    disabled?: LabSlider['disabled'];
    invalid?: LabSlider['invalid'];
    name?: LabSlider['name'];
    onValueChange?: (event: CustomEvent) => void;
    onValueChangeEnd?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Slider: import("svelte").Component<Props, {}, "">;
type Slider = ReturnType<typeof Slider>;
export default Slider;
//# sourceMappingURL=Slider.svelte.d.ts.map