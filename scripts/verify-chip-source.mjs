import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Compare the saved, immutable author extraction with the shipped profile.
// The extraction is supplied explicitly; no Figma connection or mutation is needed.
const source = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const { chip: profile } = JSON.parse(
  readFileSync(new URL('../packages/tokens/src/components.json', import.meta.url), 'utf8'),
);
assert.equal(source.variants.length, 56);
const variable = (id) => source.variables[id]?.name;
const fillRole = (node) =>
  variable(node?.fills?.find((paint) => paint.type === 'SOLID')?.boundVariables?.color?.id);
const text = (node) => (node.type === 'TEXT' ? node : node.children?.map(text).find(Boolean));
let loading = 0;
for (const root of source.variants) {
  const axes = root.variantProperties;
  const metrics = profile.sizes[axes.Size === 'Small' ? 's' : 'm'];
  assert.equal(root.height, metrics.height, root.name);
  assert.equal(root.paddingLeft, metrics.paddingX, root.name);
  assert.equal(root.paddingRight, metrics.paddingX, root.name);
  assert.equal(root.paddingTop, metrics.paddingY, root.name);
  assert.equal(root.paddingBottom, metrics.paddingY, root.name);
  assert.equal(root.itemSpacing, metrics.gap, root.name);
  assert.equal(
    root.cornerRadius,
    axes.Sharp === 'True' ? profile.sharpRadius : metrics.radius,
    root.name,
  );
  const label =
    root.children.find((node) => node.type === 'TEXT') ??
    text(root.children.find((node) => node.name === 'Wrap'));
  assert.equal(label.fontSize, metrics.fontSize, root.name);
  assert.equal(label.lineHeight.value, metrics.lineHeight, root.name);
  assert.equal(label.fontName.family, 'Geist', root.name);
  assert.equal(label.fontName.style, 'Medium', root.name);
  const leading = root.children.find((node) => node.name === 'Avatar');
  assert.equal(leading.width, metrics.leadingSize, root.name);
  assert.equal(leading.visible, false, root.name);
  assert.deepEqual(root.reactions, [], root.name);
  const close = root.children.find((node) => node.name === 'close');
  if (close) assert.equal(close.visible, axes.Selected === 'True', root.name);
  if (close?.visible) {
    assert.equal(close.width, metrics.closeSize, root.name);
    const glyph = profile.close[axes.Size === 'Small' ? 's' : 'm'];
    assert.equal(close.children[0].vectorPaths[0].data, glyph.data, root.name);
  }
  if (axes.State !== 'Active') {
    assert.equal(
      fillRole(root),
      axes.Selected === 'True'
        ? ['Default', 'Focus', 'Loading'].includes(axes.State)
          ? 'Fills/Neutral/Tertiary'
          : 'Fills/Neutral/Quaternary'
        : axes.State === 'Hover'
          ? 'Fills/Neutral/Quaternary'
          : undefined,
      root.name,
    );
    assert.equal(
      fillRole(label),
      axes.State === 'Disabled' ? 'Labels/Neutral/Quaternary' : 'Labels/Neutral/Primary',
      root.name,
    );
    assert.equal(
      variable(root.strokes[0]?.boundVariables?.color?.id),
      axes.Selected === 'True' ? undefined : 'Border/Neutral/Base',
      root.name,
    );
  }
  if (axes.State === 'Active') {
    assert.equal(
      fillRole(root),
      axes.Selected === 'True' ? 'Accent/Brand' : 'Fills/Brand/Primary',
      root.name,
    );
    assert.equal(
      fillRole(label),
      axes.Selected === 'True' ? 'Labels/Static/Light/Primary' : 'Labels/Brand/Primary',
      root.name,
    );
  }
  if (axes.State === 'Pressed') {
    const glow = root.children.find((node) => node.type === 'ELLIPSE');
    assert.equal(glow.width, profile.glow.diameter, root.name);
    assert.equal(glow.height, profile.glow.diameter, root.name);
    assert.equal(glow.effects[0].radius, profile.glow.blur, root.name);
    assert.ok(Math.abs(glow.opacity - profile.glow.opacity) < 1e-7, root.name);
    assert.equal(
      glow.x + glow.width / 2 - root.width / 2,
      axes.Selected === 'True' ? profile.glow.selectedCenterOffset : profile.glow.centerOffset,
      root.name,
    );
  }
  if (axes.State === 'Focus') {
    const ring = root.children.find((node) => node.name === 'focus-ring');
    assert.equal(ring.x, -profile.focus.offset, root.name);
    assert.equal(ring.y, -profile.focus.offset, root.name);
    assert.equal(ring.strokeWeight, profile.focus.width, root.name);
    assert.equal(ring.strokeAlign, 'OUTSIDE', root.name);
  }
  if (axes.State === 'Loading') {
    loading++;
    const wrap = root.children.find((node) => node.name === 'Wrap');
    assert.equal(
      wrap.cornerRadius,
      axes.Size === 'Small' && axes.Sharp === 'False'
        ? profile.skeleton.roundedSmallRadius
        : profile.skeleton.radius,
      root.name,
    );
    assert.equal(fillRole(wrap), 'FX/Skeleton/Base', root.name);
    assert.equal(label.opacity, 0, root.name);
    assert.equal(label.characters, 'Chip 1', root.name);
  }
}
process.stdout.write(
  `Verified ${source.variants.length} author variants, including ${loading} skeletons. Runtime keeps the actual label and Medium close width during loading; author loading masters use “Chip 1” and a 16px close.`,
);
