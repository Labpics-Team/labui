import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { kbdProfile } from '../src/kbd.js';

interface Node {
  name: string;
  type: string;
  width: number;
  height: number;
  cornerRadius?: number;
  paddingLeft?: number;
  paddingTop?: number;
  strokeWeight?: number;
  strokeAlign?: string;
  fontName?: { family: string; style: string };
  fontSize?: number;
  fontWeight?: number;
  lineHeight?: { value: number };
  children?: Node[];
}
const source = JSON.parse(
  readFileSync(
    new URL('../../../native/compose/evidence/kbd-20261118/figma-source.json', import.meta.url),
    'utf8',
  ),
) as { node: Node };
const walk = (node: Node): Node[] => [node, ...(node.children ?? []).flatMap(walk)];

describe('Kbd author profile', () => {
  it('preserves all eight source masters, including real Geist label geometry', () => {
    expect(source.node.children).toHaveLength(8);
    for (const variant of source.node.children ?? []) {
      const metrics = variant.name.includes('Large=True') ? kbdProfile.sizes.l : kbdProfile.sizes.s;
      const count = Number(variant.name.match(/Keys=(\d)/)?.[1]);
      expect(variant.width).toBe(metrics.height * count + kbdProfile.gap * (count - 1));
      expect(variant.height).toBe(metrics.height);
      const labels = walk(variant).filter((node) => node.type === 'TEXT');
      expect(labels).toHaveLength(count);
      for (const label of labels) {
        expect(label.fontName?.family).toBe('Geist');
        expect(label.fontName?.style).toBe('Medium');
        expect(label.fontWeight).toBe(kbdProfile.fontWeight);
        expect(label.fontSize).toBe(metrics.fontSize);
        expect(label.lineHeight?.value).toBe(metrics.lineHeight);
      }
      for (const container of walk(variant).filter((node) => node.name === 'Container')) {
        expect(container.cornerRadius).toBe(metrics.radius);
        expect(container.paddingLeft).toBe(metrics.paddingX);
        expect(container.paddingTop).toBe(metrics.paddingY);
        expect(container.strokeWeight).toBe(kbdProfile.strokeWidth);
        expect(container.strokeAlign).toBe('INSIDE');
      }
    }
  });
});
