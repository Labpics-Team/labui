import '@labpics/ui-core/loader';
import type { LabLoader } from '@labpics/ui-core/loader';
import type { Snippet } from 'svelte';
/** Пропы <lab-loader> — типы взяты прямо из класса ядра (LabLoader). */
interface Props {
    size?: LabLoader['size'];
    label?: LabLoader['label'];
    children?: Snippet;
    [key: string]: unknown;
}
declare const Loader: import("svelte").Component<Props, {}, "">;
type Loader = ReturnType<typeof Loader>;
export default Loader;
//# sourceMappingURL=Loader.svelte.d.ts.map