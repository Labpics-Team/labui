import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveTextStyles } from '../packages/tokens/src/resolve-text-styles.mjs';

const path = process.argv[2];
if (!path) throw new Error('Pass the read-only Figma nodes JSON cache as the first argument.');
const cache = JSON.parse(readFileSync(path, 'utf8'));
const profiles = resolveTextStyles(
  JSON.parse(
    readFileSync(new URL('../packages/tokens/src/components.json', import.meta.url), 'utf8'),
  ),
);
const p = profiles.segmented;
const sets = Object.values(cache.nodes).map((entry) => entry.document);
const group = sets.find(
  (node) => node.type === 'COMPONENT_SET' && node.name === 'Segmented Control',
);
const part = sets.find(
  (node) =>
    node.type === 'COMPONENT_SET' &&
    node.name === 'control' &&
    node.componentPropertyDefinitions?.['Icon-control'],
);
assert.ok(group && part, 'Cache must include both Segmented component sets');
const variants = (node) => node.children.filter((child) => child.type === 'COMPONENT');
const close = (actual, expected, message) =>
  assert.ok(Math.abs(actual - expected) < 0.001, `${message}: ${actual} != ${expected}`);
assert.equal(variants(group).length, 42);
assert.equal(variants(part).length, 24);
for (const variant of variants(group)) {
  const properties = Object.fromEntries(variant.name.split(', ').map((entry) => entry.split('=')));
  const shape = p.shapes[properties.Style.toLowerCase()];
  assert.ok(shape, variant.name);
  close(variant.cornerRadius ?? 0, shape.trackRadius, `${variant.name}: track radius`);
  for (const edge of ['Left', 'Right', 'Top', 'Bottom'])
    close(variant[`padding${edge}`], p.padding, `${variant.name}: padding`);
  close(
    variant.absoluteBoundingBox.height,
    p.controlHeight + 2 * p.padding,
    `${variant.name}: height`,
  );
  const controls = variant.children.filter(
    (child) => child.name === 'control' && child.visible !== false,
  );
  assert.equal(controls.length, Number(properties.Segments), variant.name);
  for (const control of controls) {
    close(control.cornerRadius ?? 0, shape.controlRadius, `${variant.name}: control radius`);
    close(control.absoluteBoundingBox.height, p.controlHeight, `${variant.name}: control height`);
    close(
      control.absoluteBoundingBox.width,
      (variant.absoluteBoundingBox.width - p.padding * 2) / controls.length,
      `${variant.name}: equal widths`,
    );
  }
  assert.equal(
    controls.findIndex((control) => control.fills.length > 0),
    Number(properties.Selected) - 1,
    variant.name,
  );
}
for (const variant of variants(part)) {
  const properties = Object.fromEntries(variant.name.split(', ').map((entry) => entry.split('=')));
  const iconOnly = properties['Icon-control'] === 'True';
  close(variant.absoluteBoundingBox.height, p.controlHeight, `${variant.name}: height`);
  close(
    variant.cornerRadius ?? 0,
    p.shapes[properties.Style.toLowerCase()].controlRadius,
    `${variant.name}: radius`,
  );
  close(
    variant.paddingLeft,
    iconOnly ? p.iconOnlyPadding : p.controlPadding,
    `${variant.name}: padding`,
  );
  for (const child of variant.children) {
    if (child.type === 'TEXT') {
      close(child.style.fontSize, p.fontSize, `${variant.name}: font size`);
      close(child.style.lineHeightPx, p.lineHeight, `${variant.name}: line height`);
      close(child.style.fontWeight, p.fontWeight, `${variant.name}: weight`);
      close(child.style.letterSpacing, p.letterSpacing, `${variant.name}: tracking`);
    } else if (child.type === 'INSTANCE')
      close(
        child.absoluteBoundingBox.height,
        iconOnly ? p.iconOnlySize : p.iconSize,
        `${variant.name}: icon`,
      );
  }
}
process.stdout.write(
  `Segmented source ${cache.version}: 42 groups and 24 parts match shared geometry and Caption/S.\n`,
);
