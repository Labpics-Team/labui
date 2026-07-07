import '@labpics/ui-core/dialog';
import type { LabDialog } from '@labpics/ui-core/dialog';
import type { Snippet } from 'svelte';
/** Пропы <lab-dialog> — типы взяты прямо из класса ядра (LabDialog). */
interface Props {
    size?: LabDialog['size'];
    modal?: LabDialog['modal'];
    closable?: LabDialog['closable'];
    heading?: LabDialog['heading'];
    description?: LabDialog['description'];
    onOpenChange?: (event: CustomEvent) => void;
    content?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Dialog: import("svelte").Component<Props, {}, "">;
type Dialog = ReturnType<typeof Dialog>;
export default Dialog;
//# sourceMappingURL=Dialog.svelte.d.ts.map