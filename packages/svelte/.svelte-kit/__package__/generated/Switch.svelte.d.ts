import '@labpics/ui-core/switch';
import type { LabSwitch } from '@labpics/ui-core/switch';
import type { Snippet } from 'svelte';
/** Пропы <lab-switch> — типы взяты прямо из класса ядра (LabSwitch). */
interface Props {
    type?: LabSwitch['type'];
    size?: LabSwitch['size'];
    checked?: LabSwitch['checked'];
    defaultChecked?: LabSwitch['defaultChecked'];
    disabled?: LabSwitch['disabled'];
    name?: LabSwitch['name'];
    onCheckedChange?: (event: CustomEvent) => void;
    iconOff?: Snippet;
    iconOn?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Switch: import("svelte").Component<Props, {}, "">;
type Switch = ReturnType<typeof Switch>;
export default Switch;
//# sourceMappingURL=Switch.svelte.d.ts.map