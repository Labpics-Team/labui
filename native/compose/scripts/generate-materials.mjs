import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceArg = process.argv.indexOf('--source');
const root =
  sourceArg < 0
    ? new URL('../../../', import.meta.url)
    : pathToFileURL(`${resolve(process.argv[sourceArg + 1])}/`);
const profile = JSON.parse(
  await readFile(new URL('packages/materials/src/profile.json', root), 'utf8'),
);
if (profile.version !== 1) throw new Error('Unsupported material profile');
const lines = [
  '// Generated from packages/materials/src/profile.json. Do not edit.',
  'package pics.lab.ui',
  '',
  'public object LabMaterials {',
];
for (const [name, tier] of Object.entries(profile.tiers)) {
  const role = (key) => JSON.stringify(profile.paints[key].replace('{tier}', name));
  const optics = tier.glass;
  lines.push(
    `    public val ${name} = LabMaterialRecipe(`,
    `        solidRole = ${JSON.stringify(tier.solidRole)}, normalRole = ${role('normalRole')}, blendRole = ${role('blendRole')},`,
    `        backdropRadius = ${tier.backdrop.radius}f, frost = ${optics.frost}f, depth = ${optics.depth}f,`,
    `        refraction = ${optics.refraction}f, dispersion = ${optics.dispersion}f, lightAngle = ${optics.lightAngle}f, lightIntensity = ${optics.lightIntensity}f,`,
    '    )',
  );
}
lines.push('}', '');
const output = new URL('../src/commonMain/kotlin/pics/lab/ui/LabMaterials.kt', import.meta.url);
const content = lines.join('\n');
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== content)
    throw new Error('Native material profile is stale');
} else await writeFile(output, content);
