import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root));
const json = (path: string) => JSON.parse(read(path).toString());
const hash = (data: Buffer) => createHash('sha256').update(data).digest('hex');
const source = json('assets/avatar/source.json');
const manifest = json('assets/avatar/manifest.generated.json');
const profile = json('packages/tokens/src/components.json').avatar;
const colors = profile.colors;
const largestSize = Math.max(
  ...Object.values(profile.sizes).map((size) => (size as { diameter: number }).diameter),
);
const palette = json('packages/colors/labui.config.json').anchors;

describe('shared compiled Avatar material', () => {
  it('retains immutable source layers and complete current palette modes', () => {
    for (const layer of Object.values(source.layers) as { file: string; sha256: string }[]) {
      expect(hash(read(`assets/avatar/${layer.file}`))).toBe(layer.sha256);
    }
    expect(manifest.variants).toHaveLength(
      Object.keys(colors).length * Object.keys(source.modes).length,
    );
    const keys = new Set();
    for (const variant of manifest.variants) {
      keys.add(`${variant.color}/${variant.mode}`);
      const mode = source.modes[variant.mode];
      expect(mode).toBeDefined();
      const anchor = palette[colors[variant.color].anchor];
      const values = mode.contrast === 'more' ? (anchor.increased ?? anchor) : anchor;
      expect(variant.tint).toEqual(values[mode.appearance]);
      expect(variant.kind).toBe('offline-derived');
      expect(variant.width).toBeGreaterThanOrEqual(48 * 2 * 2);
      expect(variant.height).toBe(variant.width);
      expect(hash(read(`packages/core/src/${variant.web}`))).toBe(variant.webSha256);
      for (const native of variant.nativeVariants) {
        expect(
          hash(read(`native/compose/src/commonMain/composeResources/${native.resource}`)),
        ).toBe(native.sha256);
        expect(native.pixels).toBe(largestSize * native.density);
      }
    }
    expect(keys.size).toBe(manifest.variants.length);
  });
});
