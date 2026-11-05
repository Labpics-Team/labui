import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Только чтение исходников: тест не загружает WinUI/Win2D и не запускает UI.
const source = await readFile(new URL('../Rendering/SheetLayers.cs', import.meta.url), 'utf8');
const build = source.slice(
  source.indexOf('private Frame BuildFrame('),
  source.indexOf('private CanvasGeometry BodyShape('),
);
const profile = await readFile(
  new URL('../Rendering/SheetBlurProfile.cs', import.meta.url),
  'utf8',
);
const geometry = await readFile(new URL('../generated/Geometry.g.cs', import.meta.url), 'utf8');

test('Sheet atlas has two brush bindings and a fresh source parameter on each graph edge', () => {
  const names = [...build.matchAll(/brush\.SetSourceParameter\("([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(names.sort(), ['atlas', 'backdrop']);
  const graphNames = [...build.matchAll(/new CompositionEffectSourceParameter\("([^"]+)"\)/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(graphNames.sort(), names);
  assert.equal([...build.matchAll(/new CompositionEffectSourceParameter\(/g)].length, 2);
  assert.match(
    build,
    /IGraphicsEffectSource Backdrop\(\)\s*=>\s*new CompositionEffectSourceParameter\("backdrop"\)/,
  );
  assert.match(
    build,
    /IGraphicsEffectSource Layer\(int index\)\s*=>\s*Effect\(new Transform2DEffect\s*\{\s*Source = new CompositionEffectSourceParameter\("atlas"\)/,
  );
  assert.doesNotMatch(build, /var backdrop\s*=|Source = noise\b|parameters\.Add\(/);
});

test('Sheet virtual atlas uses the original Uniform projection and per-cell updateRect', () => {
  assert.match(build, /TransformMatrix = atlas\.Cell\(index\)\.EffectTransform/);
  assert.match(build, /atlasBrush\.Stretch = CompositionStretch\.None;/);
  assert.match(build, /atlasBrush\.HorizontalAlignmentRatio = 0;/);
  assert.match(build, /atlasBrush\.VerticalAlignmentRatio = 0;/);
  assert.match(build, /atlasBrush\.Scale = atlas\.BrushScale;/);
  assert.match(build, /atlasBrush\.Offset = atlas\.BrushOffset;/);
  assert.match(
    build,
    /void DrawAtlasCell\(int index\)\s*\{\s*var cell = atlas\.Cell\(index\);\s*using var drawing = CanvasComposition\.CreateDrawingSession\(atlasSurface,\s*new Rect\(cell\.PixelX, cell\.PixelY, pixelWidth, pixelHeight\), \(float\)\(96 \* scale\)\);/,
  );
  assert.match(
    build,
    /for \(var index = 0; index < atlasDrawings\.Count; index\+\+\) DrawAtlasCell\(index\);/,
  );
  assert.match(build, /drawing\.Clear\(Color\.FromArgb\(0, 0, 0, 0\)\);/);
  assert.match(build, /atlasDrawings\[index\]\(drawing\);/);
  assert.doesNotMatch(build, /drawing\.Transform|DrawingOffset|MaximumBitmapSizeInPixels/);
  assert.doesNotMatch(build, /new Rect\(0, 0, atlas\.Width, atlas\.Height\)/);
});

test('Sheet atlas keeps authored blur levels and paints under the common GeometryScale', () => {
  assert.match(
    profile,
    /levels = \[0, 1f \/ 64, 1f \/ 32, 1f \/ 16, 1f \/ 8, 1f \/ 4, 1f \/ 2, 1\]/,
  );
  assert.match(build, /index < SheetBlurProfile\.Levels\.Length/);
  assert.match(build, /SheetBlurProfile\.Stops\(level\)/);
  assert.match(
    build,
    /Blur\(Backdrop\(\), SheetBlurProfile\.Levels\[index\] \* Geometry\.SheetGhostBlurRadius \* metrics\.Scale\)/,
  );
  assert.match(build, /Blur\(Backdrop\(\), Geometry\.SheetBodyBlurRadius \* metrics\.Scale\)/);
  assert.match(geometry, /SheetGhostBlurRadius = 24;/);
  assert.match(geometry, /SheetBodyBlurRadius = 128;/);
  assert.match(source, /RadiusToSigma = 0\.5;/);
  for (const paint of ['Ghost', 'Tint', 'Blend'])
    assert.match(build, new RegExp(`Paint\\(${paint}!\\)`));
  assert.match(build, /DrawShadows\(drawing, metrics, bodyShape\)/);
  assert.match(build, /DrawNoise\(drawing, pixelWidth, pixelHeight, scale\)/);
  assert.match(build, /Mode = CanvasComposite\.Add/);
  assert.doesNotMatch(
    build,
    /new (AtlasEffect|PixelShaderEffect|CropEffect|ScaleEffect|ConvolveMatrixEffect)\b/,
  );
});

test('Sheet atlas preserves frame ownership and cleans failed candidates', () => {
  assert.match(build, /var atlasSurface = result\.Own\(graphics!\.CreateVirtualDrawingSurface\(/);
  assert.match(
    build,
    /new Windows\.Graphics\.SizeInt32 \{ Width = atlas\.Width, Height = atlas\.Height \}/,
  );
  assert.match(
    build,
    /var atlasBrush = result\.Own\(compositor\.CreateSurfaceBrush\(atlasSurface\)\)/,
  );
  assert.match(build, /var backdropBrush = result\.Own\(compositor\.CreateBackdropBrush\(\)\)/);
  assert.ok(
    build.indexOf('compositor.CreateBackdropBrush()') < build.indexOf('factory.CreateBrush()'),
  );
  assert.match(build, /var factory = result\.Own\(SheetSourceTopologyProbe\.CreateFactory\(/);
  assert.match(build, /var brush = result\.Own\(factory\.CreateBrush\(\)\)/);
  assert.match(build, /catch \(Exception error\)\s*\{\s*try \{ result\.Dispose\(\); \}/);
  assert.match(
    source,
    /ElementCompositionPreview\.SetElementChildVisual\(this, candidate\.Visual\)/,
  );
  assert.match(source, /Render\(recreate: true\)/);
  assert.match(source, /for \(var index = resources\.Length - 1; index >= 0; index--\)/);
});
