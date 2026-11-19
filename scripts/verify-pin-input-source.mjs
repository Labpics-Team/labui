import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';

// Read-only REST file/nodes response. Credentials and full library cache remain local.
const source = JSON.parse((await readFile(process.argv[2], 'utf8')).replace(/^\uFEFF/, ''));
const profile = JSON.parse(
  await readFile(new URL('../packages/tokens/src/components.json', import.meta.url), 'utf8'),
)['pin-input'];
const sets = [];
function visit(node) {
  if (node.type === 'COMPONENT_SET' && ['Input Pin', 'Input Pin / Cell'].includes(node.name))
    sets.push(node);
  for (const child of node.children ?? []) visit(child);
}
for (const node of Object.values(source.nodes)) visit(node.document);
const cells = sets.find((node) => node.name === 'Input Pin / Cell');
const groups = sets.find((node) => node.name === 'Input Pin');
assert.equal(cells.children.length, 6);
assert.equal(groups.children.length, 2);
const observations = [];
for (const cell of cells.children) {
  assert.equal(cell.absoluteBoundingBox.width, profile.sizes.m.width);
  assert.equal(cell.absoluteBoundingBox.height, profile.sizes.m.height);
  assert.equal(cell.cornerRadius, profile.sizes.m.radius);
  assert.equal(cell.strokeWeight, profile.strokeWidth);
  const dot = cell.children.find((node) => node.name === 'Dot');
  assert.equal(dot.absoluteBoundingBox.width, profile.sizes.m.dot);
  assert.equal(dot.absoluteBoundingBox.height, profile.sizes.m.dot);
  assert.equal(
    dot.visible !== false && (dot.opacity ?? 1) > 0.001,
    cell.name.includes('State=Active'),
  );
  assert.equal(cell.fills.length, cell.name.includes('Hover=True') ? 2 : 1);
  observations.push({
    variant: cell.name,
    width: cell.absoluteBoundingBox.width,
    height: cell.absoluteBoundingBox.height,
    radius: cell.cornerRadius,
    stroke: cell.strokeWeight,
    dot: profile.sizes.m.dot,
    dotOpacity: dot.opacity ?? 1,
  });
}
for (const group of groups.children) {
  const count = Number(group.name.split('=')[1]);
  assert.equal(group.children.length, count);
  assert.equal(group.itemSpacing, profile.sizes.m.gap);
  assert.equal(
    group.absoluteBoundingBox.width,
    count * profile.sizes.m.width + (count - 1) * profile.sizes.m.gap,
  );
  observations.push({
    variant: group.name,
    width: group.absoluteBoundingBox.width,
    height: group.absoluteBoundingBox.height,
    gap: group.itemSpacing,
  });
}
const result = {
  source:
    'https://www.figma.com/community/file/1527814209910933331/lab-ui-components-icons-guides-lab-ui-v2-1',
  observed: '2026-11-19',
  version: source.version,
  observations,
};
if (process.argv[3]) await writeFile(process.argv[3], `${JSON.stringify(result, null, 2)}\n`);
console.info('Verified all 6 authored cells and both 4/6-digit groups against the shared profile.');
