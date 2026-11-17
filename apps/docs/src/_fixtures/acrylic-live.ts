import { mountMaterialRuntime } from '@labpics/ui-materials';

interface AcrylicLiveHooks {
  /** Снять рантайм: поверхности возвращаются к CSS-фолбэку. */
  dispose(): void;
  /** Смонтировать заново (после dispose) — для симметрии A/B-замера. */
  mount(): void;
}

declare global {
  interface Window {
    __labAcrylicLive?: AcrylicLiveHooks;
  }
}

const status = document.querySelector<HTMLOutputElement>('[data-testid="live-status"]');

let dispose: (() => void) | null = mountMaterialRuntime();

window.__labAcrylicLive = {
  dispose(): void {
    dispose?.();
    dispose = null;
    if (status) status.value = 'runtime: disposed';
  },
  mount(): void {
    if (!dispose) dispose = mountMaterialRuntime();
    if (status) status.value = 'runtime: mounted';
  },
};

if (status) status.value = 'runtime: mounted';
