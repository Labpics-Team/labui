import '../foundation.css';
import '@labpics/ui-core/alert';
Object.assign(window, {
  moveBackdrop: (edge: number) => {
    document.documentElement.style.setProperty('--edge', `${edge}px`);
  },
});
