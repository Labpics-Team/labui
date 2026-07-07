import '@labpics/ui-core/tabs';
import type { LabTabs } from '@labpics/ui-core/tabs';
import type { Snippet } from 'svelte';
/** Пропы <lab-tabs> — типы взяты прямо из класса ядра (LabTabs). */
interface Props {
    orientation?: LabTabs['orientation'];
    size?: LabTabs['size'];
    activationMode?: LabTabs['activationMode'];
    value?: LabTabs['value'];
    defaultValue?: LabTabs['defaultValue'];
    items?: LabTabs['items'];
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Tabs: import("svelte").Component<Props, {}, "">;
type Tabs = ReturnType<typeof Tabs>;
export default Tabs;
//# sourceMappingURL=Tabs.svelte.d.ts.map