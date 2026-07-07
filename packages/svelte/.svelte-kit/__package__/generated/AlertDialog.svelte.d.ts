import '@labpics/ui-core/alert-dialog';
import type { LabAlertDialog } from '@labpics/ui-core/alert-dialog';
import type { Snippet } from 'svelte';
/** Пропы <lab-alert-dialog> — типы взяты прямо из класса ядра (LabAlertDialog). */
interface Props {
    size?: LabAlertDialog['size'];
    modal?: LabAlertDialog['modal'];
    closable?: LabAlertDialog['closable'];
    heading?: LabAlertDialog['heading'];
    description?: LabAlertDialog['description'];
    onOpenChange?: (event: CustomEvent) => void;
    content?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
}
declare const AlertDialog: import("svelte").Component<Props, {}, "">;
type AlertDialog = ReturnType<typeof AlertDialog>;
export default AlertDialog;
//# sourceMappingURL=AlertDialog.svelte.d.ts.map