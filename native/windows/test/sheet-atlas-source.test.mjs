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
    /var seed = stages\.CreateVisual\(Brush\("progressiveSeed", seedGraph,\s*inlineProgressive, inlineProgressive, branches, \("backdrop", backdropBrush\)\)\);/,
  );
  assert.match(
    frame,
    /result\.Visual\.Children\.InsertAtBottom\(seed\);\s*var capturedBackdrop = stages\.Capture\(seed\);\s*seed\.Opacity = 0;/,
  );
  assert.match(frame, /var progressiveSources = new CompositionSurfaceBrush\[branches\.Length\];/);
  assert.match(
    frame,
    /for \(var index = 0; index < branches\.Length; index\+\+\)\s*\{\s*var leaf = stages\.CreateVisual\(Brush\(\$"progressiveLeaf\{index\}", \(IGraphicsEffect\)branches\[index\],\s*inlineProgressive, inlineProgressive, branches,\s*\("backdrop", capturedBackdrop\), \("atlas", atlasBrush\)\)\);\s*progressiveSources\[index\] = stages\.Capture\(leaf\);\s*\}/,
  );
  assert.match(
    frame,
    /for \(var count = progressiveSources\.Length; count > 1; count \/= 2\)\s*for \(var index = 0; index < count; index \+= 2\)\s*\{\s*var pair = Effect\(new CompositeEffect\s*\{ Mode = CanvasComposite\.Add, Sources = \{ Source\("left"\), Source\("right"\) \} \}\);\s*var sum = stages\.CreateVisual\(Brush\("progressiveSum", pair,\s*inlineProgressive, inlineProgressive, branches,\s*\("left", progressiveSources\[index\]\), \("right", progressiveSources\[index \+ 1\]\)\)\);\s*progressiveSources\[index \/ 2\] = stages\.Capture\(sum\);\s*\}\s*var capturedProgressive = progressiveSources\[0\];/,
  );
  assert.match(frame, /var ghost = Mask\(ghostSource, Layer\(ghostMask\)\);/);
  assert.match(
    frame,
    /var ghostVisual = stages\.CreateVisual\(Brush\("ghost", ghost, inlineProgressive, ghostSource, branches,\s*\("progressiveSurface", capturedProgressive\), \("ghostPaint", ghostPaint\), \("atlas", atlasBrush\)\)\);/,
  );
  assert.match(
    frame,
    /var bodyAlphaMask = Layer\(bodyMask\);\s*var body = Mask\(bodySource, bodyAlphaMask\);/,
  );
  assert.match(
    frame,
    /var bodyVisual = stages\.CreateVisual\(Brush\("body", body, inlineProgressive, ghostSource, branches,\s*\("backdrop", capturedBackdrop\), \("tintPaint", tintPaint\), \("blendPaint", blendPaint\),\s*\("atlas", atlasBrush\)\)\);/,
  );
  assert.match(
    frame,
    /var outerVisual = stages\.CreateVisual\(Brush\("outer", Layer\(outer\), inlineProgressive, ghostSource, branches,\s*\("atlas", atlasBrush\)\)\);\s*var borderVisual = stages\.CreateVisual\(Brush\("border", Layer\(border\), inlineProgressive, ghostSource, branches,\s*\("atlas", atlasBrush\)\)\);/,
  );
  assert.match(
    frame,
    /var output = stages\.CreateLayer\(\);\s*output\.Children\.InsertAtTop\(ghostVisual\);\s*output\.Children\.InsertAtTop\(outerVisual\);\s*output\.Children\.InsertAtTop\(bodyVisual\);\s*output\.Children\.InsertAtTop\(borderVisual\);\s*result\.Visual\.Children\.InsertAtTop\(output\);\s*result\.Own\(stages\);\s*return result;/,
  );
  assert.doesNotMatch(frame, /Brush\("final",|var graph = Over\(/);
  assert.equal([...frame.matchAll(/stages\.CreateLayer\(/g)].length, 1);
  assert.equal([...frame.matchAll(/\.Children\.InsertAtTop\(/g)].length, 5);
  assert.doesNotMatch(frame, /void Output\(|^\s*Output\(/m);
  assert.deepEqual(
    [...frame.matchAll(/stages\.Capture\(([^)]+)\)/g)].map((match) => match[1]),
    ['seed', 'leaf', 'sum'],
  );
  assert.match(
    candidate,
    /var visual = frame\.Own\(compositor\.CreateSpriteVisual\(\)\);\s*visuals\.Add\(visual\);\s*visual\.Size = frame\.Visual\.Size;\s*visual\.CompositeMode = CompositionCompositeMode\.SourceOver;\s*visual\.Brush = brush;\s*return visual;/,
  );
  assert.match(
    candidate,
    /var layer = frame\.Own\(compositor\.CreateLayerVisual\(\)\);\s*layers\.Add\(layer\);\s*layer\.Size = frame\.Visual\.Size;\s*layer\.CompositeMode = CompositionCompositeMode\.SourceOver;\s*return layer;/,
  );
  assert.match(
    candidate,
    /var surface = frame\.Own\(compositor\.CreateVisualSurface\(\)\);\s*surfaces\.Add\(surface\);\s*surface\.SourceVisual = visual;\s*surface\.SourceOffset = Vector2\.Zero;\s*surface\.SourceSize = visual\.Size;\s*var brush = frame\.Own\(compositor\.CreateSurfaceBrush\(surface\)\);\s*brush\.Stretch = CompositionStretch\.Fill;\s*brush\.HorizontalAlignmentRatio = 0;\s*brush\.VerticalAlignmentRatio = 0;\s*return brush;/,
  );
  const stages = candidate.slice(
    candidate.indexOf('private sealed class SurfaceStages('),
    candidate.indexOf('private sealed class Frame : IDisposable'),
  );
  assert.match(
    stages,
    /if \(visuals\.Count == 0 && surfaces\.Count == 0 && layers\.Count == 0\) return;/,
  );
  assert.match(stages, /var flattened = layers\.ToArray\(\);/);
  assert.match(stages, /surfaces\.Clear\(\);\s*visuals\.Clear\(\);\s*layers\.Clear\(\);/);
  assert.match(stages, /frame\.Visual\.Children\.RemoveAll\(\)/);
  assert.match(stages, /surface\.SourceVisual = null;/);
  assert.match(
    stages,
    /foreach \(var layer in flattened\)\s*try \{ layer\.Children\.RemoveAll\(\); \}\s*catch \(Exception error\) \{ errors\.Add\(error\); \}/,
  );
  assert.match(stages, /visual\.Brush = null;/);
  assert.match(stages, /Frame\.ThrowCleanup\(errors\);/);
  assert.ok(
    stages.indexOf('frame.Visual.Children.RemoveAll()') <
      stages.indexOf('surface.SourceVisual = null'),
  );
  assert.ok(
    stages.indexOf('surface.SourceVisual = null') < stages.indexOf('layer.Children.RemoveAll()'),
  );
  assert.ok(stages.indexOf('layer.Children.RemoveAll()') < stages.indexOf('visual.Brush = null'));
  assert.doesNotMatch(stages, /\.Dispose\(|\.Close\(|CanvasDevice/);
  const failure = frame.slice(frame.lastIndexOf('catch (Exception error)'));
  assert.match(failure, /List<Exception> errors = \[error\];/);
  assert.match(failure, /stages\?\.Dispose\(\)/);
  assert.match(failure, /result\.Dispose\(\)/);
  assert.ok(failure.indexOf('stages?.Dispose()') < failure.indexOf('result.Dispose()'));
  assert.match(
    failure,
    /throw new AggregateException\("Ошибка создания и освобождения Sheet\.", errors\)/,
  );
  assert.match(failure, /throw;/);
}

test('Sheet LayerVisual combines Ghost, shadow, Body and border before ancestor opacity', () => {
  assert.equal([...build.matchAll(/compositor\.CreateBackdropBrush\(\)/g)].length, 1);
  assertSurfaceStages(source);
  assert.match(
    build,
    /IGraphicsEffectSource Source\(string name\)\s*=>\s*new CompositionEffectSourceParameter\(name\)/,
  );
  assert.match(build, /IGraphicsEffectSource Backdrop\(\)\s*=>\s*Source\("backdrop"\)/);
  assert.match(
    build,
    /Transform2DEffect Layer\(int index\)\s*=>\s*Effect\(new Transform2DEffect\s*\{\s*Source = Source\("atlas"\)/,
  );
  assert.equal([...build.matchAll(/compositor\.CreateSurfaceBrush\(atlasSurface\)/g)].length, 1);
  assert.match(
    build,
    /foreach \(var \(name, source\) in bindings\) brush\.SetSourceParameter\(name, source\);/,
  );
  assert.equal([...build.matchAll(/stages\.CreateLayer\(/g)].length, 1);
  assert.doesNotMatch(build, /LayerSource|LayerBinding|layerSources/);
  assert.doesNotMatch(
    build,
    /ghostPair|pairs|progressiveBrush|ghostBrush|bodyBrush|Source\("progressive"\)/,
  );
  assert.doesNotMatch(build, /var backdrop\s*=|Source = noise\b|parameters\.Add\(/);
  assert.doesNotMatch(build, /compositor\.Create(?:VisualSurface|SpriteVisual|LayerVisual)\(/);
});

test('Sheet capture source guard rejects a root capture, repeated seed and bypassed leaf binding', () => {
  for (const [original, replacement] of [
    ['surface.SourceVisual = visual;', 'surface.SourceVisual = frame.Visual;'],
    ['stages.Capture(leaf)', 'stages.Capture(seed)'],
    ['stages.Capture(sum)', 'stages.Capture(seed)'],
    ['("right", progressiveSources[index + 1])', '("right", progressiveSources[index])'],
    ['Layer(ghostMask)', 'Layer(bodyMask)'],
    ['Mask(bodySource, bodyAlphaMask)', 'Mask(bodyAlphaMask, bodySource)'],
  ]) {
    assert.ok(source.includes(original));
    assert.throws(() => assertSurfaceStages(source.replace(original, replacement)));
  }
});

test('Sheet material source guard rejects a plain output container, bypassed grouping and changed SourceOver order', () => {
  for (const [original, replacement] of [
    ['compositor.CreateLayerVisual()', 'compositor.CreateContainerVisual()'],
    [
      'result.Visual.Children.InsertAtTop(output);',
      'result.Visual.Children.InsertAtTop(ghostVisual);',
    ],
    ['output.Children.InsertAtTop(bodyVisual);', 'result.Visual.Children.InsertAtTop(bodyVisual);'],
    [
      'layer.CompositeMode = CompositionCompositeMode.SourceOver;',
      'layer.CompositeMode = CompositionCompositeMode.MinBlend;',
    ],
    [
      'visual.CompositeMode = CompositionCompositeMode.SourceOver;',
      'visual.CompositeMode = CompositionCompositeMode.MinBlend;',
    ],
    [
      'output.Children.InsertAtTop(outerVisual);\n            output.Children.InsertAtTop(bodyVisual);',
      'output.Children.InsertAtTop(bodyVisual);\n            output.Children.InsertAtTop(outerVisual);',
    ],
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
      'Mode = CanvasComposite.Add, Sources = { Source("left"), Source("right") }',
      'Mode = CanvasComposite.SourceOver, Sources = { Source("left"), Source("right") }',
    ],
  ]) {
    assert.ok(source.includes(original));
    assert.throws(() => assertSurfaceStages(source.replace(original, replacement)));
  }
});

test('Sheet surface source guard rejects retained capture links and swallowed unlink errors', () => {
  for (const [original, replacement, owner] of [
    ['surface.SourceVisual = null;', '', 'private sealed class SurfaceStages('],
    ['layer.Children.RemoveAll();', '', 'private sealed class SurfaceStages('],
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
    /var pair = Effect\(new CompositeEffect\s*\{ Mode = CanvasComposite\.Add, Sources = \{ Source\("left"\), Source\("right"\) \} \}\)/,
  );
  assert.match(build, /for \(var index = 0; index < branches\.Length; index\+\+\)/);
  assert.match(build, /inlineProgressive\.Sources\.Add\(branches\[index\]\)/);
  assert.match(
    build,
    /var ghostSource = WithNoise\(Over\(Source\("progressiveSurface"\), Paint\(Ghost!, "ghostPaint"\)\),\s*Geometry\.SheetGhostNoiseOpacity\);/,
  );
  assert.match(build, /var ghost = Mask\(ghostSource, Layer\(ghostMask\)\);/);
  assert.match(geometry, /SheetGhostBlurRadius = 24;/);
  assert.match(geometry, /SheetBodyBlurRadius = 128;/);
  assert.match(source, /RadiusToSigma = 0\.5;/);
  for (const paint of ['Ghost', 'Tint', 'Blend'])
    assert.match(build, new RegExp(`Paint\\(${paint}!, "${paint.toLowerCase()}Paint"\\)`));
  assert.match(build, /DrawShadows\(drawing, metrics, bodyShape\)/);
  assert.match(build, /DrawNoise\(drawing, pixelWidth, pixelHeight, scale\)/);
  assert.match(build, /Mode = CanvasComposite\.Add/);
  assert.doesNotMatch(
    build,
    /new (AtlasEffect|PixelShaderEffect|CropEffect|ScaleEffect|ConvolveMatrixEffect)\b/,
  );
});

test('Sheet native paints retain original Color alpha and separate float opacity', () => {
  assert.match(
    build,
    /IGraphicsEffectSource Paint\(SolidColorBrush brush, string sourceName\) => Effect\(new OpacityEffect\s*\{\s*Opacity = \(float\)brush\.Opacity,\s*Source = Source\(sourceName\),\s*\}\);/,
  );
  for (const [paint, name] of [
    ['Ghost', 'ghostPaint'],
    ['Tint', 'tintPaint'],
    ['Blend', 'blendPaint'],
  ])
    assert.match(
      build,
      new RegExp(
        `var ${name} = result\\.Own\\(compositor\\.CreateColorBrush\\(${paint}!\\.Color\\)\\);`,
      ),
    );
  assert.equal([...build.matchAll(/compositor\.CreateColorBrush\(/g)].length, 3);
  assert.doesNotMatch(build, /new ColorSourceEffect\b/);
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
