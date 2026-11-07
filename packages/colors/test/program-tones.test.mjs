import * as owner from '@labpics/colors';
import * as abi from '@labpics/colors/program-wire/abi-v1.js';
import { beforeAll, describe, expect, it } from 'vitest';

import { addBackgroundTones, createLabuiEngine } from '../engine.mjs';
import config from '../labui.config.json' with { type: 'json' };
import { prepareEngineConfig } from '../prepare-config.mjs';

beforeAll(async () => {
  await createLabuiEngine();
});

function resolveTone(input, theme, alpha) {
  const model = prepareEngineConfig(input);
  const selected = model.themes[theme];
  const source = model.sources[selected.tone.source];
  const builder = new abi.ProgramWireBuilderV1()
    .source(11, source)
    .fixedTarget(21, 11)
    .solidPaint(41, 21)
    .surfaceInputPort(31)
    .inputSurface(51, 31)
    .output(91, 41);
  let serial = 100;
  const tones = addBackgroundTones(
    builder,
    {
      sourcePaint: 41,
      backdrop: 51,
      alphas: [alpha, alpha],
      viewingContext: [
        model.observation.adaptingLuminance,
        model.observation.backgroundRatio,
        {
          average: abi.SURROUND_AVERAGE_V1,
          dim: abi.SURROUND_DIM_V1,
          dark: abi.SURROUND_DARK_V1,
        }[model.observation.surround],
      ],
      reportCriterion: abi.WCAG22_SC143_TEXT_DEFAULT_V1,
    },
    () => serial++,
  );
  const runtime = owner.compileProgramWire(builder.finish(), 1);
  // Это исходный ID наблюдения, не позиция сценария в массиве.
  const scenarioId = 37;
  let snapshot;
  try {
    snapshot = runtime.updateObserved(
      1n,
      new Uint32Array([scenarioId]),
      Uint8Array.from(model.sources[selected.background]),
      1,
    );
    if (snapshot.state !== 'ready') return { state: snapshot.state, reason: snapshot.reason };
    const { root } = tones.get('bg-tone-2');
    return {
      state: snapshot.state,
      rgb: [...snapshot.presentationCompositeRgb(root, scenarioId)],
    };
  } finally {
    snapshot?.free();
    runtime.free();
  }
}

// Эти проверки квалифицируют только композицию фиксированных источников.
// Helper добавляет композиции в обычный Program V1; RGB читается из того же
// snapshot. Готовность этого малого графа не означает готовность всего CSS.
describe('Core-композиция фоновых тонов', () => {
  it.each(['light', 'dark'])('%s: непрозрачная краска даёт ровно источник', (theme) => {
    const input = structuredClone(config);
    input.policy.contrast = 'unresolved';
    const result = resolveTone(input, theme, 1);
    const selected = input.themes[theme];
    const bytes = (source) =>
      input.authored.sources[source]
        .slice(1)
        .match(/../g)
        .map((pair) => Number.parseInt(pair, 16));
    expect(result).toMatchObject({ state: 'ready', rgb: bytes(selected.tone.source) });
  });

  it('видимый encoded-sRGB композит отличается от исходной Paint', () => {
    const input = structuredClone(config);
    input.policy.contrast = 'unresolved';
    input.authored.sources['test-backdrop'] = '#0A141E';
    input.authored.sources['test-overlay'] = '#14283C';
    input.themes.light.background = 'test-backdrop';
    input.themes.light.tone = { source: 'test-overlay', alpha: [0.5, 1] };
    const tone = resolveTone(input, 'light', 0.5);
    // Равные доли дают точные целые байты, без допуска и локального конвертера.
    expect(tone).toMatchObject({ state: 'ready', rgb: [15, 30, 45] });
    expect(tone.rgb).not.toEqual([20, 40, 60]);
  });

  it.each([0, 0.078, 0.322, 0.5, 0.722, 1])(
    'совпадающие источник и фон сохраняют известный RGB при alpha=%s',
    (alpha) => {
      const input = structuredClone(config);
      input.policy.contrast = 'unresolved';
      input.authored.sources['test-same'] = '#274B93';
      input.themes.dark.background = 'test-same';
      input.themes.dark.tone = { source: 'test-same', alpha: [alpha, alpha] };
      // Прежний terminal readout возвращал blocked из-за пустой causal domain.
      // Это RED для общей проекции данных Core: известный композит не требует
      // materialization authority и не должен вычисляться локальным fallback.
      const result = resolveTone(input, 'dark', alpha);
      expect(result).toMatchObject({ state: 'ready', rgb: [39, 75, 147] });
    },
  );

  it.each(['light', 'dark'])(
    '%s: нулевая alpha сохраняет фон при отличающемся источнике',
    (theme) => {
      const input = structuredClone(config);
      const result = resolveTone(input, theme, 0);
      const background = input.authored.sources[input.themes[theme].background];
      const rgb = background
        .slice(1)
        .match(/../g)
        .map((pair) => Number.parseInt(pair, 16));
      expect(result).toMatchObject({ state: 'ready', rgb });
    },
  );
});
