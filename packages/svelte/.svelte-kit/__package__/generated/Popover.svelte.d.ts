import '@labpics/ui-core/popover';
import type { LabPopover } from '@labpics/ui-core/popover';
import type { Snippet } from 'svelte';
/** Пропы <lab-popover> — типы взяты прямо из класса ядра (LabPopover). */
interface Props {
    placement?: LabPopover['placement'];
    size?: LabPopover['size'];
    modal?: LabPopover['modal'];
    closable?: LabPopover['closable'];
    arrow?: LabPopover['arrow'];
    heading?: LabPopover['heading'];
    description?: LabPopover['description'];
    onOpenChange?: (event: CustomEvent) => void;
    content?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Popover: import("svelte").Component<Props, {}, "">;
type Popover = ReturnType<typeof Popover>;
export default Popover;
//# sourceMappingURL=Popover.svelte.d.ts.map