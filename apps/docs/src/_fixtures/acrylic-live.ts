/*
 * Acrylic LIVE — провайдер рантайма материалов для фикстуры движка v2.
 *
 * Одна обязанность: смонтировать mountMaterialRuntime() (на поддерживающем
 * браузере он переводит acrylic-поверхности на luminosity-конвейер) и отдать
 * e2e-спеку два рычага: статус загрузки (boot-гейт) и пере-монтирование для
 * A/B-дифференциала «движок против CSS-фолбэка» на ОДНОЙ странице.
 */
import { mountMaterialRuntime } from '@labpics/ui-materials';

interface AcrylicLiveHooks {
  /** Снять рантайм: поверхности возвращаются к CSS-фолбэку (v1). */
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
