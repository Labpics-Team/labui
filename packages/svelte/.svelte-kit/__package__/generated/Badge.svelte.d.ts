import '@labpics/ui-core/badge';
import type { LabBadge } from '@labpics/ui-core/badge';
import type { Snippet } from 'svelte';
/** Пропы <lab-badge> — типы взяты прямо из класса ядра (LabBadge). */
interface Props {
    color?: LabBadge['color'];
    type?: LabBadge['type'];
    disabled?: LabBadge['disabled'];
    dot?: Snippet;
    children?: Snippet;
    [key: string]: unknown;
}
declare const Badge: import("svelte").Component<Props, {}, "">;
type Badge = ReturnType<typeof Badge>;
export default Badge;
//# sourceMappingURL=Badge.svelte.d.ts.map