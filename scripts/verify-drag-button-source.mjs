import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveTextStyles } from '../packages/tokens/src/resolve-text-styles.mjs';
const source = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const profiles = resolveTextStyles(
  JSON.parse(
    readFileSync(new URL('../packages/tokens/src/components.json', import.meta.url), 'utf8'),
  ),
);
const p = profiles['drag-button'];
function find(node, name) {
  if (node.name === name && (name !== 'Drag button' || node.type === 'COMPONENT_SET')) return node;
  for (const child of node.children ?? []) {
    const found = find(child, name);
    if (found) return found;
  }
}
const set = Object.values(source.nodes)
  .map(({ document }) => find(document, 'Drag button'))
  .find(Boolean);
assert.ok(set);
assert.deepEqual(
  set.children.map((node) => node.name),
  ['State=Default', 'State=Halfy dragged', 'State=Fully dragged', 'State=Success', 'State=Danger'],
);
for (const [index, variant] of set.children.entries()) {
  assert.equal(variant.absoluteBoundingBox.height, p.height);
  assert.equal(variant.cornerRadius, p.radius);
  for (const edge of ['Left', 'Right', 'Top', 'Bottom'])
    assert.equal(variant[`padding${edge}`], p.padding);
  const button = find(variant, 'Button');
  assert.equal(button.absoluteBoundingBox.height, profiles.button.sizes.m.height);
  assert.equal(button.cornerRadius, profiles.button.sizes.m.radius);
  assert.equal(button.absoluteBoundingBox.width, [48, 568, 1136, 1136, 1136][index]);
  const helper = find(variant, 'Swipe it');
  assert.equal(helper.style.fontSize, p.fontSize);
  assert.equal(helper.style.lineHeightPx, p.lineHeight);
  assert.equal(helper.style.fontWeight, p.fontWeight);
  assert.equal(helper.style.letterSpacing, p.letterSpacing);
  const mask = find(variant, 'mask left -> right');
  assert.equal(mask.isMask, true);
  assert.equal(mask.children.length, p.mask.count);
  for (const [maskIndex, item] of mask.children.entries()) {
    assert.equal(item.absoluteBoundingBox.width, p.mask.width);
    assert.equal(item.absoluteBoundingBox.height, p.mask.height);
    assert.equal(item.effects[0].radius, p.mask.blur);
    assert.equal(
      item.absoluteBoundingBox.x - mask.absoluteBoundingBox.x,
      maskIndex * (p.mask.width + p.mask.gap),
    );
  }
  assert.equal(
    mask.absoluteBoundingBox.x + mask.absoluteBoundingBox.width,
    variant.absoluteBoundingBox.x + variant.absoluteBoundingBox.width,
  );
  const glow = find(button, 'Interactive/Pressed/Glow');
  if (index === 1 || index === 2) {
    assert.ok(glow && glow.visible !== false);
    assert.equal(glow.type, 'ELLIPSE');
    assert.equal(glow.absoluteBoundingBox.width, p.glow.size);
    assert.equal(glow.absoluteBoundingBox.height, p.glow.size);
    assert.equal(
      glow.absoluteBoundingBox.x +
        p.glow.size / 2 -
        button.absoluteBoundingBox.x -
        button.absoluteBoundingBox.width / 2,
      p.glow.offsetX,
    );
    assert.equal(
      glow.absoluteBoundingBox.y +
        p.glow.size / 2 -
        button.absoluteBoundingBox.y -
        button.absoluteBoundingBox.height / 2,
      p.glow.offsetY,
    );
    assert.equal(glow.effects[0].radius, p.glow.blur);
    assert.ok(Math.abs(glow.opacity - p.glow.opacity) < 0.000001);
  }
  if (index >= 3) assert.ok(find(button, 'checkmark'), 'Both authored results retain checkmark');
}
console.log(
  `Drag Button source ${source.version}: five states, shared Button metrics, text, mask and pressed glow match.`,
);
