import '../foundation.css';
import '@labpics/ui-core/alert';
Object.assign(window, {
  moveBackdrop: (center: number, radius: number) => {
    document.documentElement.style.setProperty('--near-edge', `${center - radius}px`);
    document.documentElement.style.setProperty('--far-edge', `${center + radius}px`);
  },
});
