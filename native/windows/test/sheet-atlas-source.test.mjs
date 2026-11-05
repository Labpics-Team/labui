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

test('Sheet factories share the original backdrop and atlas with fresh source edges', () => {
  assert.equal([...build.matchAll(/compositor\.CreateBackdropBrush\(\)/g)].length, 1);
  assert.equal([...source.matchAll(/compositor\.CreateSpriteVisual\(\)/g)].length, 1);
  assert.match(
    build,
    /IGraphicsEffectSource Source\(string name\)\s*=>\s*new CompositionEffectSourceParameter\(name\)/,
  );
  assert.match(build, /IGraphicsEffectSource Backdrop\(\)\s*=>\s*Source\("backdrop"\)/);
  assert.match(
    build,
    /IGraphicsEffectSource Layer\(int index\)\s*=>\s*Effect\(new Transform2DEffect\s*\{\s*Source = Source\("atlas"\)/,
  );
  assert.match(
    build,
    /foreach \(var \(name, source\) in bindings\) brush\.SetSourceParameter\(name, source\);/,
  );
  assert.match(build, /var name = \$"ghostPair\{index \/ 2\}";/);
  assert.match(
    build,
    /Brush\(name, pair, \("backdrop", backdropBrush\), \("atlas", atlasBrush\)\)/,
  );
  assert.match(
    build,
    /Brush\("body", body, \("backdrop", backdropBrush\), \("atlas", atlasBrush\)\)/,
  );
  assert.doesNotMatch(build, /var backdrop\s*=|Source = noise\b|parameters\.Add\(/);
  assert.doesNotMatch(build, /CreateVisualSurface|CreateSpriteVisual|InsertAtTop/);
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
  assert.match(
    build,
    /\(IGraphicsEffect\)graph, Geometry\.SheetGhostBlurRadius \* metrics\.Scale \* RadiusToSigma,\s*Geometry\.SheetBodyBlurRadius \* metrics\.Scale \* RadiusToSigma/,
  );
  assert.match(build, /branches\[index\] = Mask\(index == 0 \? Backdrop\(\)/);
  assert.match(build, /Layer\(ghostMasks\[index\]\)/);
  assert.match(
    build,
    /var progressive = Effect\(new CompositeEffect \{ Mode = CanvasComposite\.Add \}\)/,
  );
  assert.match(build, /for \(var index = 0; index < branches\.Length; index \+= 2\)/);
  assert.match(
    build,
    /Mode = CanvasComposite\.Add, Sources = \{ branches\[index\], branches\[index \+ 1\] \}/,
  );
  assert.match(build, /progressive\.Sources\.Add\(Source\(name\)\)/);
  assert.match(
    build,
    /var progressiveBrush = Brush\("progressive", progressive, pairs\.ToArray\(\)\)/,
  );
  assert.match(
    build,
    /Brush\("ghost", ghost, \("progressive", progressiveBrush\), \("atlas", atlasBrush\)\)/,
  );
  assert.match(build, /Over\(Source\("progressive"\), Paint\(Ghost!\)\)/);
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
  assert.match(
    build,
    /result\.Visual\.Brush = Brush\("final", graph, \("ghost", ghostBrush\), \("body", bodyBrush\), \("atlas", atlasBrush\)\)/,
  );
  assert.match(build, /catch \(Exception error\)\s*\{\s*try \{ result\.Dispose\(\); \}/);
  assert.match(
    source,
    /ElementCompositionPreview\.SetElementChildVisual\(this, candidate\.Visual\)/,
  );
  assert.match(source, /Render\(recreate: true\)/);
  assert.match(source, /for \(var index = resources\.Length - 1; index >= 0; index--\)/);
});
