import '@labpics/ui-core/progress';
import type { LabProgress } from '@labpics/ui-core/progress';
import type { Snippet } from 'svelte';
/** Пропы <lab-progress> — типы взяты прямо из класса ядра (LabProgress). */
interface Props {
    size?: LabProgress['size'];
    value?: LabProgress['value'];
    min?: LabProgress['min'];
    max?: LabProgress['max'];
    label?: LabProgress['label'];
    showValueText?: LabProgress['showValueText'];
    children?: Snippet;
    [key: string]: unknown;
}
declare const Progress: import("svelte").Component<Props, {}, "">;
type Progress = ReturnType<typeof Progress>;
export default Progress;
//# sourceMappingURL=Progress.svelte.d.ts.map