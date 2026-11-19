import '../foundation.css';
import '@labpics/ui-core/alert';
import { mountMaterialRuntime } from '@labpics/ui-materials';
const shared = document.getElementById('shared');
if (!shared) throw new Error('Missing shared material fixture');
mountMaterialRuntime(shared);
Object.assign(window, {
  moveBackdrop: (x: number) => {
    for (const background of document.querySelectorAll<HTMLElement>('.backdrop'))
      background.style.transform = `translateX(${x}px)`;
  },
});
