import '@labpics/ui-core/avatar';
import type { LabAvatar } from '@labpics/ui-core/avatar';
import type { Snippet } from 'svelte';
/** Пропы <lab-avatar> — типы взяты прямо из класса ядра (LabAvatar). */
interface Props {
    size?: LabAvatar['size'];
    color?: LabAvatar['color'];
    status?: LabAvatar['status'];
    src?: LabAvatar['src'];
    name?: LabAvatar['name'];
    children?: Snippet;
    [key: string]: unknown;
}
declare const Avatar: import("svelte").Component<Props, {}, "">;
type Avatar = ReturnType<typeof Avatar>;
export default Avatar;
//# sourceMappingURL=Avatar.svelte.d.ts.map