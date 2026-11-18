import { readFile } from 'node:fs/promises';
import { compileProgramWire } from '@labpics/colors';
import { beforeAll, describe, expect, it } from 'vitest';
import { initializeNodeColors } from '../engine.mjs';
import config from '../labui.config.json' with { type: 'json' };
import { themeProfile } from '../profile.mjs';
import { prepareThemeProgram } from '../program-source.mjs';
import { createThemeProgram } from '../program.mjs';
import materialSource from './fixtures/figma-material-colors-20261117.json' with { type: 'json' };

beforeAll(initializeNodeColors);

function resolved(values, name) {
  const value = values[`--lab-${name}`];
  const alias = /^var\(--lab-(.+)\)$/.exec(value);
  return alias ? resolved(values, alias[1]) : value;
}

describe('LabUI profile over the published Colors Program', () => {
  it('shares the native wire, output slots and aliases with every web theme', () => {
    for (const theme of ['light', 'dark']) {
      for (const contrast of ['normal', 'more']) {
        const source = prepareThemeProgram(theme, contrast);
        const runtime = compileProgramWire(source.bytes, 1);
        const web = createThemeProgram(theme, contrast);
        const snapshot = runtime.updateObserved(
          1n,
          new Uint32Array([1]),
          new Uint8Array(source.background),
          1,
        );
        try {
          expect(snapshot.state).toBe('ready');
          const values = web.update();
          const slots = new Map(source.outputs.map(({ slot, name }) => [slot, name]));
          expect(snapshot.outputCount()).toBe(slots.size);
          for (let index = 0; index < snapshot.outputCount(); index++) {
            const name = slots.get(snapshot.outputSlot(index));
            const rgb = snapshot.outputRgb(index);
            const alpha = snapshot.outputOpacity(index);
            expect(values[`--lab-${name}`]).toBe(
              `rgb(${rgb.join(' ')}${alpha === 1 ? '' : ` / ${alpha}`})`,
            );
          }
          for (const [name, value] of Object.entries(source.roles)) {
            if (typeof value !== 'string') continue;
            expect(values[`--lab-${name}`]).toBe(`var(--lab-${value.slice(1)})`);
            expect(resolved(values, name)).toMatch(/^rgb\(/);
          }
        } finally {
          snapshot.free();
          runtime.free();
          web.dispose();
        }
      }
    }
  });

  it('gives native generators an independent byte buffer and immutable role metadata', () => {
    const first = prepareThemeProgram();
    const expected = first.bytes.slice();
    first.bytes.fill(0);
    expect(prepareThemeProgram().bytes).toEqual(expected);
    expect(() => first.outputs.push({ slot: 0, name: 'foreign' })).toThrow();
    expect(() => {
      first.outputs[0].name = 'foreign';
    }).toThrow();
    expect(() => {
      first.roles['label-on-accent'] = '@foreign';
    }).toThrow();
  });

  for (const theme of ['light', 'dark']) {
    it(`${theme}: preserves the authored palette, primary and white on accent`, async () => {
      const program = createThemeProgram(theme);
      try {
        const values = program.update();
        const reference = await readFile(
          new URL('../figma-reference.css', import.meta.url),
          'utf8',
        );
        const body = new RegExp(`^\\[data-theme="${theme}"\\]\\s*\\{([^}]+)`, 'm').exec(
          reference,
        )[1];
        for (const [, name, value] of body.matchAll(/--lab-([a-z0-9-]+):\s*(rgb\([^;]+\));/g)) {
          // FX has a separate stack; materials use the live variable snapshot below.
          if (name.startsWith('fx-') || name.startsWith('bg-material-')) continue;
          expect(resolved(values, name), name).toBe(value);
        }
        expect(resolved(values, 'label-on-accent')).toBe('rgb(255 255 255)');
        expect(resolved(values, 'fill-accent')).toBe(resolved(values, 'border-brand-strong'));
      } finally {
        program.dispose();
      }
    });
  }

  it('preserves material opacity variables from live Figma without 8-bit quantization', () => {
    const alphas = new Map(
      materialSource.alphas.map((variable) => [
        variable.id,
        Object.values(variable.valuesByMode)[0] / 100,
      ]),
    );
    for (const [theme, mode] of [
      ['light', '4001:0'],
      ['dark', '4001:1'],
    ]) {
      const program = createThemeProgram(theme);
      try {
        const values = program.update();
        for (const variable of materialSource.materials) {
          const [, , tier, layer] = variable.name.split('/');
          const name = `bg-material-${tier.toLowerCase()}-${layer}`;
          const value = variable.valuesByMode[mode];
          const color = value.color ?? value;
          const rgb = ['r', 'g', 'b'].map((channel) => Math.round(color[channel] * 255));
          const opacity = value.opacity ? alphas.get(value.opacity.id) : color.a;
          expect(opacity).toBeTypeOf('number');
          expect(resolved(values, name), `${theme}/${name}`).toBe(
            `rgb(${rgb.join(' ')}${opacity === 1 ? '' : ` / ${opacity}`})`,
          );
        }
      } finally {
        program.dispose();
      }
    }
  });

  it('more selects primary polarity for actual backgrounds and rejects incompatible scenarios', () => {
    const program = createThemeProgram('light', 'more');
    try {
      expect(program.update([[255, 255, 255]])['--lab-label-primary']).toBe('rgb(16 16 18)');
      expect(program.update([[0, 0, 0]])['--lab-label-primary']).toBe('rgb(246 248 250)');
      expect(() =>
        program.update([
          [0, 0, 0],
          [255, 255, 255],
        ]),
      ).toThrow(/No palette/);
      expect(program.update([[255, 255, 255]])['--lab-label-primary']).toBe('rgb(16 16 18)');
    } finally {
      program.dispose();
    }
  });

  it('rejects invalid observations before byte conversion and remains usable', () => {
    const program = createThemeProgram();
    try {
      const before = program.update();
      for (const backgrounds of [
        [],
        [[256, 0, 0]],
        [[0.5, 1, 2]],
        [[Number.NaN, 0, 0]],
        [[1, 2]],
        Array(1),
        [Array(3)],
      ]) {
        expect(() => program.update(backgrounds)).toThrow(
          expect.objectContaining({ code: 'invalid_backgrounds' }),
        );
      }
      expect(program.update()).toEqual(before);
      program.dispose();
      expect(() => program.update()).toThrow(/disposed/);
      program.dispose();
    } finally {
      program.dispose();
    }
  });

  it('every relationship resolves, and semantic roles never depend on component roles', () => {
    for (const theme of ['light', 'dark']) {
      const profile = themeProfile(theme);
      for (const [name, value] of Object.entries(profile.roles)) {
        expect(profile.resolve(name), name).toBeDefined();
        if (!name.startsWith('badge-') && typeof value === 'string') {
          expect(value).not.toMatch(/^@badge-/);
        }
      }
    }
  });

  it('changing one brand anchor reaches text, fills, borders and glow without changing opacity or other families', () => {
    const changed = structuredClone(config);
    changed.anchors.brand.light = [10, 90, 240];
    const before = themeProfile('light');
    const after = themeProfile('light', 'normal', changed);
    for (const name of Object.keys(after.roles)) {
      const value = after.resolve(name);
      if (
        name.split('-').includes('brand') &&
        !name.includes('-on-') &&
        name !== 'badge-label-brand' &&
        Array.isArray(value)
      ) {
        expect(value.slice(0, 3), name).toEqual([10, 90, 240]);
        expect(value[3], name).toBe(before.resolve(name)[3]);
      }
    }
    expect(after.resolve('fill-accent').slice(0, 3)).toEqual([10, 90, 240]);
    expect(after.resolve('badge-label-on-brand')).toEqual(before.resolve('badge-label-on-brand'));
    expect(after.resolve('label-danger-primary')).toEqual(before.resolve('label-danger-primary'));
    expect(themeProfile('dark', 'normal', changed).resolve('label-brand-primary')).toEqual(
      themeProfile('dark').resolve('label-brand-primary'),
    );
  });
});
