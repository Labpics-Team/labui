import '@labpics/ui-core/tooltip';
import type { LabTooltip } from '@labpics/ui-core/tooltip';
import type { Snippet } from 'svelte';
/** Пропы <lab-tooltip> — типы взяты прямо из класса ядра (LabTooltip). */
interface Props {
    placement?: LabTooltip['placement'];
    size?: LabTooltip['size'];
    content?: LabTooltip['content'];
    openDelay?: LabTooltip['openDelay'];
    closeDelay?: LabTooltip['closeDelay'];
    disabled?: LabTooltip['disabled'];
    arrow?: LabTooltip['arrow'];
    onOpenChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Tooltip: import("svelte").Component<Props, {}, "">;
type Tooltip = ReturnType<typeof Tooltip>;
export default Tooltip;
//# sourceMappingURL=Tooltip.svelte.d.ts.map