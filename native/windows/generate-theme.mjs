// Сборочная проекция LabUI: Colors назначает краски, нативный renderer читает ресурсы.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLabuiEngine } from '../../packages/colors/engine.mjs';
import { BUTTON_INSET } from '../../packages/shadow/src/config.ts';
import { ELEVATION_SHAPES } from '../../packages/shadow/src/domain/elevation.ts';
import { SHADOW_SLOTS, SLOT_ALPHA } from '../../packages/shadow/src/domain/layer.ts';
import { defaultConfig } from '../../packages/tokens/src/config/default-config.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '../..');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const sources = [
  'packages/tokens/src/config/default-config.ts',
  'packages/tokens/src/generated/tokens.dtcg.json',
  'packages/tokens/src/generated/motion.dtcg.json',
  'packages/shadow/src/config.ts',
  'packages/shadow/src/domain/elevation.ts',
  'packages/shadow/src/domain/layer.ts',
];

export const brushRoles = Object.freeze({
  LabFillAccentBrush: '--lab-fill-accent',
  LabLabelOnAccentBrush: '--lab-label-on-accent',
  LabLabelSecondaryOnAccentBrush: '--lab-label-static-light-secondary',
  LabLightBrush: '--lab-bg-static-light',
  LabDarkBrush: '--lab-bg-static-dark',
  LabFocusBrush: '--lab-border-focus',
  LabPageBrush: '--lab-bg-primary',
  LabLabelPrimaryBrush: '--lab-label-primary',
  LabSheetTintBrush: '--lab-bg-material-elevated-01',
  LabSheetBlendBrush: '--lab-bg-material-elevated-02',
  LabSheetGhostBrush: '--lab-bg-overlay-ghost',
  LabSheetBorderBrush: '--lab-border-base',
  LabSheetHandleBrush: '--lab-label-tertiary',
  LabSheetNoiseBrush: '--lab-fx-noise',
  LabSheetSolidBrush: '--lab-bg-grouped-secondary',
});

function finite(value, name, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum) throw new Error(`Некорректное значение ${name}`);
  return value;
}

function unit(value, name) {
  finite(value, name);
  if (value > 1) throw new Error(`Вне диапазона 0…1: ${name}`);
  return value;
}

/** Никаких цветовых fallback: отсутствующая роль делает всю проекцию непригодной. */
export function renderThemeResources(results, provenance, inset = BUTTON_INSET) {
  const dictionaries = [];
  for (const [name, theme] of [
    ['Light', 'light'],
    ['Dark', 'dark'],
  ]) {
    const result = results[theme];
    if (result?.state !== 'ready' || !(result.paints instanceof Map)) {
      throw new Error(
        `${theme}: Colors не вернул ready paints (${result?.state ?? 'нет результата'})`,
      );
    }
    const lines = [];
    for (const [key, role] of Object.entries(brushRoles)) {
      const paint = result.paints.get(role);
      if (
        !paint ||
        !Array.isArray(paint.rgb) ||
        paint.rgb.length !== 3 ||
        ![...paint.rgb].every((value) => Number.isInteger(value) && value >= 0 && value <= 255)
      ) {
        throw new Error(`${theme}: отсутствует или повреждена краска ${role}`);
      }
      const opacity = unit(paint.opacity, `${theme}/${role}/opacity`);
      const rgb = paint.rgb
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase();
      lines.push(`      <SolidColorBrush x:Key="${key}" Color="#${rgb}" Opacity="${opacity}" />`);
    }
    lines.push(
      `      <x:Double x:Key="LabButtonShadowOpacity">${unit(inset.alpha[theme], `shadow/${theme}`)}</x:Double>`,
    );
    dictionaries.push(
      `    <ResourceDictionary x:Key="${name}">\n${lines.join('\n')}\n    </ResourceDictionary>`,
    );
  }
  return `<!-- СГЕНЕРИРОВАНО. Не править вручную. normal; ${provenance} -->
<ResourceDictionary xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">
  <ResourceDictionary.ThemeDictionaries>
${dictionaries.join('\n')}
  </ResourceDictionary.ThemeDictionaries>
</ResourceDictionary>
`;
}

/** Размеры читаются из DTCG; семантические ссылки остаются у config владельца. */
export function renderGeometry(
  tokens,
  motion,
  provenance,
  config = defaultConfig,
  inset = BUTTON_INSET,
) {
  const value = (group, name) => {
    const token = tokens[group]?.[name];
    if (!token) throw new Error(`Нет токена ${group}/${name}`);
    if (token.$type === 'dimension') {
      if (token.$value?.unit !== 'px') throw new Error(`Неподдержанная единица ${group}/${name}`);
      return finite(token.$value.value, `${group}/${name}`);
    }
    if (token.$type !== 'number') throw new Error(`Неподдержанный тип ${group}/${name}`);
    return finite(
      token.$value,
      `${group}/${name}`,
      group === 'letter-spacing' ? Number.NEGATIVE_INFINITY : 0,
    );
  };
  const space = (alias) => value('space', config.spacing.aliases[alias]);
  const opacity = (alias) => unit(value('opacity', config.opacity.aliases[alias]), alias);
  const metrics = [];
  for (const [size, name] of [
    ['s', 'Small'],
    ['m', 'Medium'],
    ['l', 'Large'],
  ]) {
    const label = size === 's' ? 'button-label-s' : 'button-label';
    const description = size === 's' ? label : 'button-description';
    const font = value('font-size', label);
    const descriptionFont = value('font-size', description);
    const values = [
      value('size', `button-h-${size}`),
      value('radius', size === 's' ? 'full' : config.radii.aliases.button),
      space(size === 'l' ? 'md' : 'button-inset'),
      space(size === 'l' ? 'md' : size === 's' ? 'sm' : 'button-inset'),
      value('size', size === 's' ? 'button-content-s' : 'button-content'),
      font,
      font * value('line-height', label),
      value('letter-spacing', label),
      descriptionFont,
      descriptionFont * value('line-height', description),
      value('letter-spacing', description),
      value('font-weight', size === 's' ? 'medium' : 'regular'),
      size === 's'
        ? -value('size', 'button-glow-shift-s')
        : size === 'l'
          ? value('size', 'button-glow-shift-l')
          : space('none'),
    ];
    metrics.push(`        LabButtonSize.${name} => new(${values.join(', ')}),`);
  }
  const spring = motion.motion?.spring?.smooth?.$extensions?.['com.labpics.motion'];
  if (
    spring?.type !== 'spring' ||
    spring.model !== 'duration-bounce' ||
    spring.duration?.unit !== 's'
  ) {
    throw new Error('Нет поддержанной smooth-пружины у владельца motion');
  }
  const duration = finite(spring.duration.value, 'smooth duration');
  const bounce = unit(spring.bounce, 'smooth bounce');
  const response = finite(duration * 1000, 'smooth response');
  // Native Spring принимает float: допустимость нужна и после преобразования double → float.
  if (
    Math.fround(response) <= 0 ||
    !Number.isFinite(Math.fround(response)) ||
    Math.fround(bounce) >= 1
  ) {
    throw new Error('Smooth требует конечный response > 0 и bounce < 1 в float LabMotion');
  }
  const constants = {
    LabelInset: space('sm'),
    LabelGap: space('sm'),
    GlowSize: value('size', 'button-glow'),
    GlowBlur: value('size', 'button-glow-blur'),
    SheenOpacity: opacity('button-sheen'),
    SheenHoverOpacity: opacity('button-sheen-hover'),
    ShadeOpacity: opacity('button-shade-pressed'),
    GlowOpacity: opacity('button-glow') * opacity('button-glow-fill'),
    ShadowOffset: finite(inset.offsetPx, 'shadow offset'),
    ShadowBlur: finite(inset.blurPx, 'shadow blur'),
    DisabledOpacity: opacity('disabled'),
    FocusWidth: value('focus-ring', 'width'),
    FocusOffset: value('focus-ring', 'offset'),
    SmoothResponse: response,
    SmoothBounce: bounce,
    SheetRadius: value('radius', config.radii.aliases.sheet),
    SheetInset: space('sheet-inset'),
    SheetGap: space('sheet-gap'),
    SheetOverlap: space('sheet-overlap'),
    SheetBodyFull: value('size', 'sheet-body-full'),
    SheetBodyTwoThirds: value('size', 'sheet-body-two-thirds'),
    SheetBodyOneThird: value('size', 'sheet-body-one-third'),
    SheetDragArea: value('size', 'sheet-drag-area'),
    SheetIndicatorWidth: value('size', 'sheet-indicator-w'),
    SheetIndicatorHeight: value('size', 'sheet-indicator-h'),
    SheetIndicatorOffset: value('size', 'sheet-indicator-y'),
    SheetIndicatorShift: value('size', 'sheet-indicator-x'),
    SheetBorderWidth: value('stroke', 'hairline'),
    SheetBodyBlurRadius: value('size', 'sheet-body-blur'),
    SheetGhostBlurRadius: value('size', 'sheet-ghost-blur'),
    SheetBodyNoiseOpacity: opacity('sheet-body-noise'),
    SheetGhostNoiseOpacity: opacity('sheet-ghost-noise'),
  };
  const elevation = ELEVATION_SHAPES.find((shape) => shape.name === 'xl');
  const shadows = SHADOW_SLOTS.map((slot) => {
    const ply = elevation?.slots[slot];
    return `        new(${finite(ply?.blur, `sheet/${slot}/blur`)}, ${finite(ply?.offsetY, `sheet/${slot}/offset`)}, ${unit(SLOT_ALPHA[slot], `sheet/${slot}/alpha`)}),`;
  });
  return `// СГЕНЕРИРОВАНО. Не править вручную. ${provenance}
// Размеры — DIP при масштабе 100%; tracking — em, line height — DIP.
namespace LabUI.WinUI;

internal static class Geometry
{
    internal static ButtonMetrics Button(LabButtonSize size) => size switch
    {
${metrics.join('\n')}
        _ => throw new System.ArgumentOutOfRangeException(nameof(size)),
    };

${Object.entries(constants)
  .map(([key, value]) => `    internal const double ${key} = ${value};`)
  .join('\n')}
    internal const ushort FontWeightMedium = ${value('font-weight', 'medium')};
    private static readonly SheetShadow[] sheetShadows =
    [
${shadows.join('\n')}
    ];
    internal static System.ReadOnlySpan<SheetShadow> SheetShadows => sheetShadows;
}
`;
}

export async function generateNativeTheme() {
  const data = await Promise.all(sources.map((path) => readFile(join(root, path), 'utf8')));
  const tokens = JSON.parse(data[1]);
  const motion = JSON.parse(data[2]);
  const ownerHash = hash(data.join('\n'));
  const engine = await createLabuiEngine();
  const results = {
    light: engine.resolve('light', 'normal'),
    dark: engine.resolve('dark', 'normal'),
  };
  const provenance = `Colors source ${engine.metadata.sourceSha}; WASM ${engine.metadata.wasmSha256}; input ${engine.fingerprint}; geometry ${ownerHash}`;
  // Обе строки полностью проверяются до первого файлового эффекта.
  return {
    'ThemeResources.g.xaml': renderThemeResources(results, provenance),
    'Geometry.g.cs': renderGeometry(tokens, motion, `owners ${ownerHash}`),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.slice(2);
  if (check.length > 1 || (check.length && check[0] !== '--check'))
    throw new Error('Ожидалось --check или отсутствие аргументов');
  const files = await generateNativeTheme();
  const output = join(here, 'generated');
  if (!check.length) await mkdir(output, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const target = join(output, name);
    if (check.length) {
      if ((await readFile(target, 'utf8')) !== content)
        throw new Error(`Требуется регенерация ${name}`);
    } else await writeFile(target, content);
  }
  console.info(
    check.length
      ? 'Native theme: drift отсутствует'
      : 'Native theme: записаны ready paints и геометрия',
  );
}
