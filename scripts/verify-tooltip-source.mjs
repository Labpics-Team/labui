import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const read = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const { tooltip: p } = await read('../packages/tokens/src/components.json');
const source = await read('../docs/evidence/tooltip/figma-source.json');
const directions = source.components.filter((node) => node.name.startsWith('Horizontal='));
assert.equal(directions.length, 24);
for (const node of directions) {
  assert.equal(node.cornerRadius, p.radius);
  assert.ok(Math.abs(node.cornerSmoothing - p.cornerSmoothing) < 1e-6);
  for (const edge of ['Top', 'Right', 'Bottom', 'Left'])
    assert.equal(node[`padding${edge}`], p.padding);
  assert.equal(node.absoluteBoundingBox.height, 48);
  assert.equal(node.fills[0].type, 'SOLID');
  assert.equal(node.effects.length, p.shadow.length);
  for (let index = 0; index < p.shadow.length; index++) {
    const actual = node.effects[index];
    const expected = p.shadow[index];
    assert.equal(actual.offset.x, expected.x);
    assert.equal(actual.offset.y, expected.y);
    assert.equal(actual.radius, expected.blur);
    assert.equal(actual.spread ?? 0, expected.spread);
    assert.ok(Math.abs(actual.color.a - expected.opacity) < 1e-6);
  }
  const text = node.children.find((child) => child.type === 'TEXT');
  assert.equal(text.style.fontFamily, 'Geist');
  assert.equal(text.style.fontSize, 16);
  assert.equal(text.style.lineHeightPx, 24);
  assert.equal(text.style.letterSpacing, -0.25);
}
assert.equal(p.body.data, directions[0].fillGeometry[0].path);
for (const [kind, profile] of [
  ['Chevron', p.tail.chevron],
  ['Bubble', p.tail.bubble],
]) {
  const variants = source.components.filter((node) => node.name.startsWith(`Kind=${kind}`));
  assert.equal(variants.length, 3);
  for (const node of variants) {
    assert.equal(node.absoluteBoundingBox.width, p.tail.width);
    assert.equal(node.absoluteBoundingBox.height, p.tail.height);
    assert.equal(node.children[0].fillGeometry.map((path) => path.path).join(' '), profile.data);
  }
}
console.info(
  'Tooltip: 24 solid variants, Body, smoothing, all shadow plies and six tail source contours agree.',
);
