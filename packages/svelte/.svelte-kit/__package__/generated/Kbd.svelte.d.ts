import '@labpics/ui-core/kbd';
import type { LabKbd } from '@labpics/ui-core/kbd';
import type { Snippet } from 'svelte';
/** Пропы <lab-kbd> — типы взяты прямо из класса ядра (LabKbd). */
interface Props {
    size?: LabKbd['size'];
    children?: Snippet;
    [key: string]: unknown;
}
declare const Kbd: import("svelte").Component<Props, {}, "">;
type Kbd = ReturnType<typeof Kbd>;
export default Kbd;
//# sourceMappingURL=Kbd.svelte.d.ts.map