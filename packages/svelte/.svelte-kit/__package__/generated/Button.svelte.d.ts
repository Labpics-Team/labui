import '@labpics/ui-core/button';
import type { LabButton } from '@labpics/ui-core/button';
import type { Snippet } from 'svelte';
/** Пропы <lab-button> — типы взяты прямо из класса ядра (LabButton). */
interface Props {
    type?: LabButton['type'];
    kind?: LabButton['kind'];
    size?: LabButton['size'];
    icon?: LabButton['icon'];
    loading?: LabButton['loading'];
    disabled?: LabButton['disabled'];
    htmlType?: LabButton['htmlType'];
    children?: Snippet;
    [key: string]: unknown;
}
declare const Button: import("svelte").Component<Props, {}, "">;
type Button = ReturnType<typeof Button>;
export default Button;
//# sourceMappingURL=Button.svelte.d.ts.map