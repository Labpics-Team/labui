import { mkdir, readFile, writeFile } from 'node:fs/promises';
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
const shadows = JSON.parse(
  await readFile(new URL('packages/shadow/dist/profile.json', root), 'utf8'),
);
if (shadows.version !== 1) throw new Error('Unsupported shadow profile');
const blendModes = { 'color-dodge': 'ColorDodge', overlay: 'Overlay', screen: 'Screen' };
const blendMode = (name) => {
  if (!blendModes[name]) throw new Error(`Unsupported authored blend mode: ${name}`);
  return `BlendMode.${blendModes[name]}`;
};
const lines = [
  '// Generated from packages/materials/src/profile.json. Do not edit.',
  'package pics.lab.ui',
  '',
  'import androidx.compose.ui.graphics.BlendMode',
  '',
  'public object LabMaterials {',
  `    internal val lightPaintBlend = ${blendMode(profile.paints.blendMode.light)}`,
  `    internal val darkPaintBlend = ${blendMode(profile.paints.blendMode.dark)}`,
  `    internal val noiseBlend = ${blendMode(profile.noise.blendMode)}`,
  `    internal const val noisePixelSize = ${profile.noise.size}f`,
  `    internal const val noiseOpacity = ${profile.noise.opacity}f`,
  `    internal const val veilNoiseOpacity = ${profile.progressive.styles.strong.noiseOpacity}f`,
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
lines.push('}', '', 'public object LabShadows {');
lines.push(
  `    internal const val lightAngle = ${shadows.lightAngle}f`,
  `    internal const val darkAlphaMultiplier = ${shadows.darkAlphaMultiplier}f`,
);
for (const [name, layers] of Object.entries(shadows.levels)) {
  lines.push(`    public val ${name} = listOf(`);
  for (const layer of layers)
    lines.push(
      `        LabShadowLayer(${layer.x}f, ${layer.y}f, ${layer.blur}f, ${layer.spread}f, ${JSON.stringify(layer.colorRole)}, ${layer.opacity}f),`,
    );
  lines.push('    )');
}
for (const [name, level] of Object.entries(shadows.roles))
  lines.push(`    public val ${name} = ${level}`);
lines.push('}', '', 'public object LabVeils {');
const progressive = profile.progressive;
lines.push(
  `    internal const val startX = ${progressive.startOffset[0]}f`,
  `    internal const val startY = ${progressive.startOffset[1]}f`,
  `    internal const val endX = ${progressive.endOffset[0]}f`,
  `    internal const val endY = ${progressive.endOffset[1]}f`,
);
for (const [name, steps] of Object.entries(progressive.compositions)) {
  const identifier = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  lines.push(`    public val ${identifier} = listOf(`);
  for (const step of steps) {
    const style = progressive.styles[step];
    lines.push(
      `        LabVeilPass(${progressive.startRadius}f, ${style.radius}f, ${style.noiseOpacity}f),`,
    );
  }
  lines.push('    )');
}
lines.push('}', '');
const sheet = profile.compositions.sheet;
if (!profile.tiers[sheet.body.tier] || !shadows.roles[sheet.body.shadow])
  throw new Error('Sheet references an unknown material or shadow');
if (sheet.body.stroke.align !== 'outside') throw new Error('Unsupported Sheet stroke alignment');
const orient = ([x, y], direction) => {
  switch (direction) {
    case 'top':
      return [x, y];
    case 'bottom':
      return [1 - x, 1 - y];
    case 'left':
      return [y, x];
    case 'right':
      return [1 - y, 1 - x];
    default:
      throw new Error(`Unsupported veil direction: ${direction}`);
  }
};
const start = orient(progressive.startOffset, sheet.ghost.direction);
const end = orient(progressive.endOffset, sheet.ghost.direction);
const ghost = sheet.ghost.profile.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
if (!progressive.compositions[sheet.ghost.profile])
  throw new Error('Sheet references an unknown veil');
lines.push(
  'internal object LabSheetMaterial {',
  `    val body = LabMaterials.${sheet.body.tier}`,
  `    val shadow = LabShadows.${sheet.body.shadow}`,
  `    const val strokeRole = ${JSON.stringify(sheet.body.stroke.role)}`,
  `    const val strokeWidth = ${sheet.body.stroke.width}f`,
  `    val ghost = LabVeils.${ghost}`,
  `    const val ghostOverlap = ${sheet.ghost.overlap}f`,
  `    const val ghostPaintRole = ${JSON.stringify(sheet.ghost.paintRole)}`,
  `    const val ghostStartX = ${start[0]}f`,
  `    const val ghostStartY = ${start[1]}f`,
  `    const val ghostEndX = ${end[0]}f`,
  `    const val ghostEndY = ${end[1]}f`,
  '}',
  '',
);
const output = new URL('../src/commonMain/kotlin/pics/lab/ui/LabMaterials.kt', import.meta.url);
const content = lines.join('\n');
if (process.argv.includes('--check')) {
  if ((await readFile(output, 'utf8')) !== content)
    throw new Error('Native material profile is stale');
} else await writeFile(output, content);
const resources = new URL('../src/commonMain/composeResources/drawable/', import.meta.url);
await mkdir(resources, { recursive: true });
for (const [source, target] of [
  ['noise.png', 'material_noise.png'],
  ['veil-noise.png', 'veil_noise.png'],
]) {
  const data = await readFile(new URL(`packages/materials/dist/${source}`, root));
  const destination = new URL(target, resources);
  if (process.argv.includes('--check')) {
    if (!(await readFile(destination)).equals(data)) throw new Error(`Native ${target} is stale`);
  } else await writeFile(destination, data);
}
