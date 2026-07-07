import '@labpics/ui-core/accordion';
import type { LabAccordion } from '@labpics/ui-core/accordion';
import type { Snippet } from 'svelte';
/** Пропы <lab-accordion> — типы взяты прямо из класса ядра (LabAccordion). */
interface Props {
    orientation?: LabAccordion['orientation'];
    size?: LabAccordion['size'];
    multiple?: LabAccordion['multiple'];
    collapsible?: LabAccordion['collapsible'];
    disabled?: LabAccordion['disabled'];
    value?: LabAccordion['value'];
    defaultValue?: LabAccordion['defaultValue'];
    items?: LabAccordion['items'];
    onValueChange?: (event: CustomEvent) => void;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Accordion: import("svelte").Component<Props, {}, "">;
type Accordion = ReturnType<typeof Accordion>;
export default Accordion;
//# sourceMappingURL=Accordion.svelte.d.ts.map