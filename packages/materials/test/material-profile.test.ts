import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readMaterialCss } from '../scripts/material-css';
import { canNest } from '../src/background-policy';
import { mountMaterialRuntime } from '../src/engine/runtime';
import { MATERIAL_TIERS, materialProfile, materialRoles, webBackdropBlur } from '../src/profile';

interface SourceEffect {
  type: string;
  radius: number;
  depth: number;
  refraction: number;
  dispersion: number;
  lightAngle: number;
  lightIntensity: number;
}
const source = JSON.parse(
  readFileSync(
    new URL('../../../docs/evidence/materials-20261117/figma-source.json', import.meta.url),
    'utf8',
  ),
) as {
  tiers: { name: string; children: { name: string; effects: SourceEffect[] }[] }[];
};

describe('author material profile', () => {
  it('preserves every source tier and its distinct Backdrop and Glass effects', () => {
    expect(MATERIAL_TIERS).toEqual(source.tiers.map((tier) => tier.name.toLowerCase()));
    for (const tier of MATERIAL_TIERS) {
      const original = source.tiers.find((entry) => entry.name.toLowerCase() === tier);
      const backdrop = original?.children
        .find((child) => child.name === 'Backdrop')
        ?.effects.find((effect) => effect.type === 'BACKGROUND_BLUR');
      const glass = original?.children
        .find((child) => child.name === 'Glass')
        ?.effects.find((effect) => effect.type === 'GLASS');
      expect(backdrop).toBeDefined();
      expect(glass).toBeDefined();
      const recipe = materialProfile.tiers[tier];
      expect(recipe.backdrop.radius).toBe(backdrop?.radius);
      expect(recipe.glass.frost).toBe(glass?.radius);
      for (const key of [
        'depth',
        'refraction',
        'dispersion',
        'lightAngle',
        'lightIntensity',
      ] as const) {
        expect(recipe.glass[key]).toBeCloseTo(glass?.[key] ?? Number.NaN, 6);
      }
      expect(webBackdropBlur(tier)).toBe(recipe.backdrop.radius / 2);
      expect(materialRoles(tier).solid).not.toMatch(/material/);
    }
  });

  it('generates the CSS first frame from the same role references and tier values', () => {
    const css = readMaterialCss();
    for (const tier of MATERIAL_TIERS) {
      const block = css.match(new RegExp(`\\.lab-material--${tier} \\{([^}]+)\\}`))?.[1];
      expect(block).toContain(`--_backdrop-blur: ${webBackdropBlur(tier)}px;`);
      expect(block).toContain(`--_solid: var(--lab-${materialRoles(tier).solid});`);
      expect(block).toContain(`--_lg-depth: ${materialProfile.tiers[tier].glass.depth};`);
    }
    expect(css).not.toContain('saturate(180%)');
    expect(css).not.toContain('--_blur: 4px');
  });

  it('does not prohibit the cumulative stack based on mode names', () => {
    for (const outer of ['solid', 'glass', 'acrylic'] as const) {
      for (const inner of ['solid', 'glass', 'acrylic'] as const)
        expect(canNest(outer, inner)).toBe(true);
    }
  });

  it('mounts and disposes without a DOM for SSR', () => {
    const dispose = mountMaterialRuntime();
    expect(() => {
      dispose();
      dispose();
    }).not.toThrow();
  });

  it('retains the progressive author styles and their distinct nested compositions', () => {
    const extracted = JSON.parse(
      readFileSync(
        new URL(
          '../../../docs/evidence/materials-20261117/figma-progressive-source.json',
          import.meta.url,
        ),
        'utf8',
      ),
    ) as {
      styles: {
        name: string;
        effects: { type: string; radius?: number; color?: { a: number } }[];
      }[];
      instances: { id: string; parent: string; children: string[] }[];
    };
    for (const [name, recipe] of Object.entries(materialProfile.progressive.styles)) {
      const style = extracted.styles.find((entry) => entry.name.toLowerCase().endsWith(`/${name}`));
      expect(style?.effects.find((effect) => effect.type === 'BACKGROUND_BLUR')?.radius).toBe(
        recipe.radius,
      );
      expect(style?.effects.find((effect) => effect.type === 'NOISE')?.color?.a).toBeCloseTo(
        recipe.noiseOpacity,
        6,
      );
    }
    expect(extracted.instances.find((node) => node.id === '6236:41501')?.children).toContain(
      '6236:41502',
    );
    expect(extracted.instances.find((node) => node.id === '7533:2238')?.children).toEqual([]);
    expect(materialProfile.progressive.compositions.strong).toEqual(['strong', 'strong']);
    expect(materialProfile.progressive.compositions['overlay-ghost']).toEqual(['strong']);
  });

  it('retains Screen grain from REST, which the plugin effect schema omits', () => {
    const rest = JSON.parse(
      readFileSync(
        new URL('../../../docs/evidence/materials-20261117/figma-noise-rest.json', import.meta.url),
        'utf8',
      ),
    ) as { nodes: { effects: { type: string; blendMode?: string }[] }[] };
    expect(rest.nodes).toHaveLength(2);
    for (const node of rest.nodes)
      expect(node.effects.find((effect) => effect.type === 'NOISE')?.blendMode?.toLowerCase()).toBe(
        materialProfile.noise.blendMode,
      );
  });
});
