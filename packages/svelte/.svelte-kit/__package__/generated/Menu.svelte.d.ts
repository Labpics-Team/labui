import '@labpics/ui-core/menu';
import type { LabMenu } from '@labpics/ui-core/menu';
import type { Snippet } from 'svelte';
/** Пропы <lab-menu> — типы взяты прямо из класса ядра (LabMenu). */
interface Props {
    size?: LabMenu['size'];
    placement?: LabMenu['placement'];
    disabled?: LabMenu['disabled'];
    label?: LabMenu['label'];
    items?: LabMenu['items'];
    onOpenChange?: (event: CustomEvent) => void;
    onSelect?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Menu: import("svelte").Component<Props, {}, "">;
type Menu = ReturnType<typeof Menu>;
export default Menu;
//# sourceMappingURL=Menu.svelte.d.ts.map