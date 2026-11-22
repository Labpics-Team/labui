import '../foundation.css';
import '@labpics/ui-core/alert';
import { initializeColors } from '@labui/colors/runtime';
import { createAlertCompositionProbe } from '../../../../packages/colors/test/alert-composition-v3.mjs';

await initializeColors();
const probes = {};
let currentTheme;
window.alertColorsProbe = {
  update(theme, background) {
    if (theme !== currentTheme) {
      for (const probe of Object.values(probes)) probe.dispose();
      for (const mode of ['source', 'visible'])
        probes[mode] = createAlertCompositionProbe(theme, mode);
      document.documentElement.dataset.theme = currentTheme = theme;
    }
    const reports = {};
    for (const mode of ['source', 'visible']) {
      const report = probes[mode].update(background);
      reports[mode] = report;
      if (report.state !== 'ready') continue;
      const alert = document.getElementById(mode);
      // Update the actual solid material and its contents as one accepted composition.
      alert.style.setProperty('--lab-bg-grouped-secondary', `rgb(${background.join(' ')})`);
      for (const [part, [r, g, b, a]] of Object.entries(report.colors)) {
        alert.style.setProperty(`--probe-${part}`, `rgb(${r} ${g} ${b} / ${a})`);
      }
    }
    return reports;
  },
  dispose() {
    for (const probe of Object.values(probes)) probe.dispose();
  },
};
