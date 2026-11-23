import '../foundation.css';
import '@labpics/ui-core/alert';
import { colors } from '@labpics/colors';
import { initializeColors } from '@labui/colors/runtime';
import { createAlertCompositionProbe } from '../../../../packages/colors/test/alert-composition-v3.mjs';

await initializeColors();
const modes = ['source', 'visible', 'reference'];
const probes = {};
let currentTheme;
window.alertColorsProbe = {
  update(theme, background) {
    const started = performance.now();
    if (theme !== currentTheme) {
      for (const probe of Object.values(probes)) probe.dispose();
      for (const mode of modes) probes[mode] = createAlertCompositionProbe(theme, mode);
      document.documentElement.dataset.theme = currentTheme = theme;
    }
    const reports = {};
    for (const mode of modes) {
      const report = probes[mode].update(background);
      reports[mode] = report;
      if (report.state !== 'ready') continue;
      const alert = document.getElementById(mode);
      // Publish the actual solid surface and the six parts in one synchronous turn.
      alert.style.setProperty(`--lab-${probes[mode].surfaceRole}`, `rgb(${background.join(' ')})`);
      for (const [part, [r, g, b, a]] of Object.entries(report.colors))
        alert.style.setProperty(`--probe-${part}`, `rgb(${r} ${g} ${b} / ${a})`);
    }
    return { ...reports, updateMs: performance.now() - started };
  },
  async sourceIdentityControl() {
    const c = colors({ reference: { canvas: '#007fff' } });
    const canvas = c.surface('canvas');
    const orange = c.role('orange material', '#ff8000').on(canvas, { opacity: 0.5 });
    const program = await c.compile({ orange });
    try {
      return ['#007fff', '#ffffff', '#007fff'].map((canvas) => {
        const frame = program.resolve({ canvas });
        return {
          canvas,
          state: frame.state,
          values: frame.values,
          reference: frame.reference?.map(({ role, outputs, preference, capacity, cases }) => ({
            role,
            outputs,
            preference,
            capacity,
            cases,
          })),
        };
      });
    } finally {
      program.dispose();
    }
  },
  dispose() {
    for (const probe of Object.values(probes)) probe.dispose();
  },
};
