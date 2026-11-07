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

function assertSurfaceStages(candidate) {
  const frame = candidate.slice(
    candidate.indexOf('private Frame BuildFrame('),
    candidate.indexOf('private CanvasGeometry BodyShape('),
  );
  assert.match(
    frame,
    /var seedGraph = Effect\(new OpacityEffect \{ Source = Backdrop\(\), Opacity = 1 \}\);/,
  );
  assert.match(
    frame,
    /var seed = stages\.CreateVisual\(Brush\("progressive", seedGraph,\s*inlineProgressive, inlineProgressive, branches, \("backdrop", backdropBrush\)\)\);/,
  );
  assert.match(
    frame,
    /result\.Visual\.Children\.InsertAtBottom\(seed\);\s*var capturedBackdrop = stages\.Capture\(seed\);\s*seed\.Opacity = 0;/,
  );
  assert.match(
    frame,
    /List<\(string Name, CompositionBrush Source\)> bindings =\s*\[\s*\("backdrop", capturedBackdrop\), \("atlas", atlasBrush\), \("bodyMaskAtlas", atlasBrush\),\s*\];/,
  );
  assert.match(
    frame,
    /var progressive = Effect\(new CompositeEffect \{ Mode = CanvasComposite\.Add \}\);/,
  );
  assert.match(
    frame,
    /for \(var index = 0; index < branches\.Length; index\+\+\)\s*\{\s*var leaf = stages\.CreateVisual\(Brush\("progressive", \(IGraphicsEffect\)branches\[index\],\s*inlineProgressive, inlineProgressive, branches,\s*\("backdrop", capturedBackdrop\), \("atlas", atlasBrush\)\)\);\s*var capturedLeaf = stages\.Capture\(leaf\);\s*var name = \$"progressive\{index\}";\s*progressive\.Sources\.Add\(Source\(name\)\);\s*bindings\.Add\(\(name, capturedLeaf\)\);\s*\}/,
  );
  assert.match(
    frame,
    /var output = stages\.CreateVisual\(Brush\("final", graph, inlineProgressive, ghostSource, branches,\s*bindings\.ToArray\(\)\)\);\s*result\.Visual\.Children\.InsertAtTop\(output\);\s*result\.Own\(stages\);\s*return result;/,
  );
  assert.deepEqual(
    [...frame.matchAll(/stages\.Capture\(([^)]+)\)/g)].map((match) => match[1]),
    ['seed', 'leaf'],
  );
  assert.match(
    candidate,
    /var visual = frame\.Own\(compositor\.CreateSpriteVisual\(\)\);\s*visuals\.Add\(visual\);\s*visual\.Size = frame\.Visual\.Size;\s*visual\.Brush = brush;\s*return visual;/,
  );
  assert.match(
    candidate,
    /var surface = frame\.Own\(compositor\.CreateVisualSurface\(\)\);\s*surfaces\.Add\(surface\);\s*surface\.SourceVisual = visual;\s*surface\.SourceOffset = Vector2\.Zero;\s*surface\.SourceSize = visual\.Size;\s*var brush = frame\.Own\(compositor\.CreateSurfaceBrush\(surface\)\);\s*brush\.Stretch = CompositionStretch\.Fill;\s*brush\.HorizontalAlignmentRatio = 0;\s*brush\.VerticalAlignmentRatio = 0;\s*return brush;/,
  );
  const stages = candidate.slice(
    candidate.indexOf('private sealed class SurfaceStages('),
    candidate.indexOf('private sealed class Frame : IDisposable'),
  );
  assert.match(stages, /if \(visuals\.Count == 0 && surfaces\.Count == 0\) return;/);
  assert.match(stages, /surfaces\.Clear\(\);\s*visuals\.Clear\(\);/);
  assert.match(stages, /frame\.Visual\.Children\.RemoveAll\(\)/);
  assert.match(stages, /surface\.SourceVisual = null;/);
  assert.match(stages, /visual\.Brush = null;/);
  assert.match(stages, /Frame\.ThrowCleanup\(errors\);/);
  assert.ok(
    stages.indexOf('frame.Visual.Children.RemoveAll()') < stages.indexOf('surface.SourceVisual = null'),
  );
  assert.ok(stages.indexOf('surface.SourceVisual = null') < stages.indexOf('visual.Brush = null'));
  assert.doesNotMatch(stages, /\.Dispose\(|\.Close\(|CanvasDevice/);
  const failure = frame.slice(frame.lastIndexOf('catch (Exception error)'));
  assert.match(failure, /List<Exception> errors = \[error\];/);
  assert.match(failure, /stages\?\.Dispose\(\)/);
  assert.match(failure, /result\.Dispose\(\)/);
  assert.ok(failure.indexOf('stages?.Dispose()') < failure.indexOf('result.Dispose()'));
  assert.match(failure, /throw new AggregateException\("Ошибка создания и освобождения Sheet\.", errors\)/);
  assert.match(failure, /throw;/);
}

test('Sheet graph shares the original atlas with a separate fresh Body mask input', () => {
  assert.equal([...build.matchAll(/compositor\.CreateBackdropBrush\(\)/g)].length, 1);
  assertSurfaceStages(source);
  assert.match(
    build,
    /IGraphicsEffectSource Source\(string name\)\s*=>\s*new CompositionEffectSourceParameter\(name\)/,
  );
  assert.match(build, /IGraphicsEffectSource Backdrop\(\)\s*=>\s*Source\("backdrop"\)/);
  assert.match(
    build,
    /Transform2DEffect Layer\(int index, string sourceName = "atlas"\)\s*=>\s*Effect\(new Transform2DEffect\s*\{\s*Source = Source\(sourceName\)/,
  );
  assert.match(build, /var bodyAlphaMask = Layer\(bodyMask, "bodyMaskAtlas"\);/);
  assert.equal([...build.matchAll(/compositor\.CreateSurfaceBrush\(atlasSurface\)/g)].length, 1);
  assert.match(
    build,
    /foreach \(var \(name, source\) in bindings\) brush\.SetSourceParameter\(name, source\);/,
  );
  assert.equal([...build.matchAll(/Brush\("final", graph,/g)].length, 1);
  assert.doesNotMatch(build, /LayerSource|LayerBinding|layerSources/);
  assert.doesNotMatch(
    build,
    /ghostPair|pairs|progressiveBrush|ghostBrush|bodyBrush|Source\("progressive"\)/,
  );
  assert.doesNotMatch(build, /var backdrop\s*=|Source = noise\b|parameters\.Add\(/);
  assert.doesNotMatch(build, /CreateVisualSurface|CreateSpriteVisual|LayerVisual/);
});

test('Sheet capture source guard rejects a root capture, repeated seed and bypassed leaf binding', () => {
  for (const [original, replacement] of [
    ['surface.SourceVisual = visual;', 'surface.SourceVisual = frame.Visual;'],
    ['stages.Capture(leaf)', 'stages.Capture(seed)'],
    ['progressive.Sources.Add(Source(name));', 'progressive.Sources.Add(Backdrop());'],
  ]) {
    assert.ok(source.includes(original));
    assert.throws(() => assertSurfaceStages(source.replace(original, replacement)));
  }
});

test('Sheet surface source guard rejects changed coordinates and a SourceOver progressive sum', () => {
  for (const [original, replacement] of [
    ['surface.SourceOffset = Vector2.Zero;', 'surface.SourceOffset = Vector2.One;'],
    ['surface.SourceSize = visual.Size;', 'surface.SourceSize = visual.Size / 2;'],
    [
      'var progressive = Effect(new CompositeEffect { Mode = CanvasComposite.Add });',
      'var progressive = Effect(new CompositeEffect { Mode = CanvasComposite.SourceOver });',
    ],
  ]) {
    assert.ok(source.includes(original));
    assert.throws(() => assertSurfaceStages(source.replace(original, replacement)));
  }
});

test('Sheet surface source guard rejects retained capture links and swallowed unlink errors', () => {
  for (const [original, replacement, owner] of [
    ['surface.SourceVisual = null;', '', 'private sealed class SurfaceStages('],
    ['Frame.ThrowCleanup(errors);', '', 'private sealed class SurfaceStages('],
    ['stages?.Dispose();', '', 'private Frame BuildFrame('],
  ]) {
    const start = source.indexOf(owner);
    assert.ok(start >= 0 && source.slice(start).includes(original));
    const candidate = source.slice(0, start) + source.slice(start).replace(original, replacement);
    assert.throws(() => assertSurfaceStages(candidate));
  }
});

test('Sheet factory slots observe actual progressive and Ghost input before its structural mask', () => {
  assert.match(
    build,
    /CompositionEffectBrush Brush\(string factoryName, IGraphicsEffect graph,\s*IGraphicsEffect progressiveGraph, IGraphicsEffect ghostSourceGraph,/,
  );
  const failure = build.slice(
    build.indexOf('catch (Exception primary)'),
    build.indexOf('CompositeEffect WithNoise('),
  );
  assert.match(
    failure,
    /if \(operation == "factory"\)\s*\{[^{}]*SheetSourceTopologyProbe\.RecordBranches\(primary, compositor,\s*progressiveGraph, ghostSourceGraph\);/,
  );
  assert.equal([...failure.matchAll(/SheetSourceTopologyProbe\.RecordBranches\(/g)].length, 1);
  assert.doesNotMatch(
    failure,
    /BodyMaskControl|new (AlphaMaskEffect|Transform2DEffect|CompositionEffectSourceParameter)\b/,
  );
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
    /Blur\(Backdrop\(\), SheetBlurProfile\.Levels\[index\] \* Geometry\.SheetGhostBlurRadius \* metrics\.Scale,\s*\$"ghostBlur\{index\}"\)/,
  );
  assert.match(build, /Blur\(Backdrop\(\), Geometry\.SheetBodyBlurRadius \* metrics\.Scale\)/);
  assert.match(
    build,
    /graph, Geometry\.SheetGhostBlurRadius \* metrics\.Scale \* RadiusToSigma,\s*Geometry\.SheetBodyBlurRadius \* metrics\.Scale \* RadiusToSigma/,
  );
  assert.match(build, /branches\[index\] = Mask\(index == 0 \? Backdrop\(\)/);
  assert.match(build, /Layer\(ghostMasks\[index\]\)/);
  assert.match(
    build,
    /var progressive = Effect\(new CompositeEffect \{ Mode = CanvasComposite\.Add \}\)/,
  );
  assert.match(build, /for \(var index = 0; index < branches\.Length; index\+\+\)/);
  assert.match(build, /inlineProgressive\.Sources\.Add\(branches\[index\]\)/);
  assert.match(
    build,
    /var ghostSource = WithNoise\(Over\(progressive, Paint\(Ghost!\)\), Geometry\.SheetGhostNoiseOpacity\);/,
  );
  assert.match(build, /var ghost = Mask\(ghostSource, Layer\(ghostMask\)\);/);
  assert.match(build, /var sheet = Over\(Over\(ghost, Layer\(outer\)\), body\)/);
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
  assertSurfaceStages(source);
  assert.match(
    source,
    /ElementCompositionPreview\.SetElementChildVisual\(this, candidate\.Visual\)/,
  );
  assert.match(source, /Render\(recreate: true\)/);
  assert.match(source, /for \(var index = resources\.Length - 1; index >= 0; index--\)/);
});
