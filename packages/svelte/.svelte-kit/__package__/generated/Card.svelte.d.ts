import '@labpics/ui-core/card';
import type { LabCard } from '@labpics/ui-core/card';
import type { Snippet } from 'svelte';
/** Пропы <lab-card> — типы взяты прямо из класса ядра (LabCard). */
interface Props {
    variant?: LabCard['variant'];
    padding?: LabCard['padding'];
    interactive?: LabCard['interactive'];
    footer?: Snippet;
    header?: Snippet;
    media?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Card: import("svelte").Component<Props, {}, "">;
type Card = ReturnType<typeof Card>;
export default Card;
//# sourceMappingURL=Card.svelte.d.ts.map