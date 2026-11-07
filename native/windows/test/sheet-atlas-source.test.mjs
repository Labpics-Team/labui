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
  assert.doesNotMatch(frame, /CreateBackdropBrush|progressiveSeed/);
  assert.match(frame, /var sceneVisual = ElementCompositionPreview\.GetElementVisual\(scene!\);/);
  assert.match(frame, /var capturedBackdrop = stages\.Capture\(sceneVisual,/);
  assert.ok(
    !/(?:leaf|sum)\.(?:Opacity|IsVisible)\s*=\s*(?:0|false)\s*;/.test(frame),
    'Captured Sheet sources must remain visible; this is a source guard, not native pixel evidence',
  );
  assert.match(frame, /var progressiveSources = new CompositionSurfaceBrush\[branches\.Length\];/);
  assert.match(
    frame,
    /for \(var index = 0; index < branches\.Length; index\+\+\)\s*\{\s*var leaf = stages\.CreateVisual\(Brush\(\$"progressiveLeaf\{index\}", \(IGraphicsEffect\)branches\[index\],\s*\("backdrop", capturedBackdrop\), \("atlas", atlasBrush\)\)\);\s*progressiveSources\[index\] = stages\.Capture\(leaf\);\s*\}/,
  );
  assert.match(
    frame,
    /for \(var count = progressiveSources\.Length; count > 1; count \/= 2\)\s*for \(var index = 0; index < count; index \+= 2\)\s*\{\s*var pair = Effect\(new CompositeEffect\s*\{ Mode = CanvasComposite\.Add, Sources = \{ Source\("left"\), Source\("right"\) \} \}\);\s*var sum = stages\.CreateVisual\(Brush\("progressiveSum", pair,\s*\("left", progressiveSources\[index\]\), \("right", progressiveSources\[index \+ 1\]\)\)\);\s*progressiveSources\[index \/ 2\] = stages\.Capture\(sum\);\s*\}\s*var capturedProgressive = progressiveSources\[0\];/,
  );
  assert.match(frame, /var ghostBackdrop = stages\.CreateVisual\(capturedProgressive\);/);
  assert.match(
    frame,
    /var ghostTint = stages\.CreateVisual\(ghostPaint, \(float\)Ghost!\.Opacity\);/,
  );
  assert.match(
    frame,
    /var noiseBrush = Brush\("ghost", Layer\(noise\), \("atlas", atlasBrush\)\);\s*var ghostNoise = stages\.CreateVisual\(noiseBrush, \(float\)Geometry\.SheetGhostNoiseOpacity\);/,
  );
  assert.match(
    frame,
    /var ghostVisual = stages\.CreateLayer\(ghostBackdrop, ghostTint, ghostNoise\);\s*ghostVisual\.Effect = MaskBrush\("ghost", ghostMask\);/,
  );
  assert.match(
    frame,
    /CompositionEffectBrush MaskBrush\(string factoryName, int index\) =>\s*Brush\(factoryName, Mask\(Source\("Backdrop"\), Layer\(index\)\), \("atlas", atlasBrush\)\);/,
  );
  assert.match(
    frame,
    /var bodyBackdrop = stages\.CreateVisual\(Brush\("body",\s*Blur\(Backdrop\(\), Geometry\.SheetBodyBlurRadius \* metrics\.Scale\), \("backdrop", capturedBackdrop\)\)\);\s*var bodyTint = stages\.CreateVisual\(tintPaint, \(float\)Tint!\.Opacity\);\s*var tinted = stages\.CreateLayer\(bodyBackdrop, bodyTint\);/,
  );
  assert.match(
    frame,
    /var blended = Effect\(new BlendEffect\s*\{\s*Background = Source\("Backdrop"\), Foreground = Paint\(Blend!, "blendPaint"\),\s*Mode = ActualTheme == ElementTheme\.Dark \? BlendEffectMode\.Overlay : BlendEffectMode\.ColorDodge,\s*\}\);\s*tinted\.Effect = Brush\("body", blended, \("blendPaint", blendPaint\)\);/,
  );
  assert.match(
    frame,
    /var bodyNoise = stages\.CreateVisual\(noiseBrush, \(float\)Geometry\.SheetBodyNoiseOpacity\);\s*var bodyVisual = stages\.CreateLayer\(tinted, bodyNoise\);\s*bodyVisual\.Effect = MaskBrush\("body", bodyMask\);/,
  );
  assert.match(
    frame,
    /var outerVisual = stages\.CreateVisual\(Brush\("outer", Layer\(outer\),\s*\("atlas", atlasBrush\)\)\);\s*var borderVisual = stages\.CreateVisual\(Brush\("border", Layer\(border\),\s*\("atlas", atlasBrush\)\)\);/,
  );
  assert.match(
    frame,
    /var output = stages\.CreateLayer\(ghostVisual, outerVisual, bodyVisual, borderVisual\);\s*result\.Visual\.Children\.InsertAtTop\(output\);\s*result\.Own\(stages\);\s*return result;/,
  );
  assert.doesNotMatch(frame, /Brush\("final",|var graph = Over\(/);
  assert.equal([...frame.matchAll(/stages\.CreateLayer\(/g)].length, 4);
  assert.equal([...frame.matchAll(/\.Children\.InsertAtTop\(/g)].length, 1);
  assert.doesNotMatch(frame, /void Output\(|^\s*Output\(/m);
  assert.deepEqual(
    [...frame.matchAll(/stages\.Capture\((\w+)/g)].map((match) => match[1]),
    ['sceneVisual', 'leaf', 'sum'],
  );
  assert.match(
    candidate,
    /internal SpriteVisual CreateVisual\(CompositionBrush brush, float opacity = 1\)\s*\{\s*var visual = frame\.Own\(compositor\.CreateSpriteVisual\(\)\);\s*visuals\.Add\(visual\);\s*visual\.Size = frame\.Visual\.Size;\s*visual\.CompositeMode = CompositionCompositeMode\.SourceOver;\s*visual\.Opacity = opacity;\s*visual\.Brush = brush;\s*return visual;/,
  );
  assert.match(
    candidate,
    /internal LayerVisual CreateLayer\(params Visual\[\] children\)\s*\{\s*var layer = frame\.Own\(compositor\.CreateLayerVisual\(\)\);\s*layers\.Add\(layer\);\s*layer\.Size = frame\.Visual\.Size;\s*layer\.CompositeMode = CompositionCompositeMode\.SourceOver;\s*foreach \(var child in children\) layer\.Children\.InsertAtTop\(child\);\s*return layer;/,
  );
  assert.match(
    candidate,
    /var surface = frame\.Own\(compositor\.CreateVisualSurface\(\)\);\s*surfaces\.Add\(surface\);\s*surface\.SourceVisual = visual;\s*surface\.SourceOffset = offset;\s*surface\.SourceSize = size;\s*var brush = frame\.Own\(compositor\.CreateSurfaceBrush\(surface\)\);\s*brush\.Stretch = CompositionStretch\.Fill;\s*brush\.HorizontalAlignmentRatio = 0;\s*brush\.VerticalAlignmentRatio = 0;\s*return brush;/,
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
    /foreach \(var layer in flattened\)\s*\{\s*try \{ layer\.Effect = null; \}\s*catch \(Exception error\) \{ errors\.Add\(error\); \}\s*try \{ layer\.Children\.RemoveAll\(\); \}\s*catch \(Exception error\) \{ errors\.Add\(error\); \}\s*\}/,
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

test('Sheet native layers preserve Ghost and Body effects before raster masks and ancestor opacity', () => {
  assert.doesNotMatch(build, /compositor\.CreateBackdropBrush\(\)/);
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
  assert.equal([...build.matchAll(/stages\.CreateLayer\(/g)].length, 4);
  assert.doesNotMatch(build, /CompositeEffect Over\(|CompositeEffect WithNoise\(|var bodySource =/);
  assert.doesNotMatch(build, /LayerSource|LayerBinding|layerSources/);
  assert.doesNotMatch(
    build,
    /ghostPair|pairs|progressiveBrush|ghostBrush|bodyBrush|Source\("progressive"\)/,
  );
  assert.doesNotMatch(build, /var backdrop\s*=|Source = noise\b|parameters\.Add\(/);
  assert.doesNotMatch(build, /compositor\.Create(?:VisualSurface|SpriteVisual|LayerVisual)\(/);
});

test('Sheet materials share the host scene without recapturing their own backdrop brush', () => {
  assert.doesNotMatch(build, /CreateBackdropBrush|progressiveSeed|Own\(sceneVisual\)/);
  assert.match(build, /\("backdrop", capturedBackdrop\), \("atlas", atlasBrush\)/);
  assert.match(build, /\("backdrop", capturedBackdrop\)\)\);\s*var bodyTint/);
  assert.ok(build.indexOf('stages.Capture(sceneVisual,') < build.indexOf('var progressiveSources'));
  assert.ok(build.indexOf('stages.Capture(sceneVisual,') < build.indexOf('var bodyBackdrop'));
});

test('Sheet capture source guard rejects hiding intermediate pure-effect sources', () => {
  for (const name of ['leaf', 'sum'])
    for (const hidden of ['Opacity = 0', 'IsVisible = false']) {
      const capture = `stages.Capture(${name});`;
      assert.ok(source.includes(capture));
      const candidate = source.replace(capture, `${capture}\n            ${name}.${hidden};`);
      assert.throws(() => assertSurfaceStages(candidate));
    }
});

test('Sheet capture source guard rejects a root capture, repeated scene and bypassed leaf binding', () => {
  for (const [original, replacement] of [
    ['surface.SourceVisual = visual;', 'surface.SourceVisual = frame.Visual;'],
    ['stages.Capture(leaf)', 'stages.Capture(sceneVisual)'],
    ['stages.Capture(sum)', 'stages.Capture(sceneVisual)'],
    ['("right", progressiveSources[index + 1])', '("right", progressiveSources[index])'],
    ['MaskBrush("ghost", ghostMask)', 'MaskBrush("ghost", bodyMask)'],
    ['MaskBrush("body", bodyMask)', 'MaskBrush("body", ghostMask)'],
    [
      'stages.CreateVisual(ghostPaint, (float)Ghost!.Opacity)',
      'stages.CreateVisual(ghostPaint, (float)Ghost!.Color.A / 255)',
    ],
    [
      'stages.CreateVisual(noiseBrush, (float)Geometry.SheetGhostNoiseOpacity)',
      'stages.CreateVisual(noiseBrush, (float)(Geometry.SheetGhostNoiseOpacity * Ghost!.Opacity))',
    ],
    ['Mask(Source("Backdrop"), Layer(index))', 'Mask(Layer(index), Source("Backdrop"))'],
    [
      'stages.CreateVisual(tintPaint, (float)Tint!.Opacity)',
      'stages.CreateVisual(tintPaint, (float)Tint!.Color.A / 255)',
    ],
    [
      'stages.CreateVisual(noiseBrush, (float)Geometry.SheetBodyNoiseOpacity)',
      'stages.CreateVisual(noiseBrush, (float)(Geometry.SheetBodyNoiseOpacity * Tint!.Opacity))',
    ],
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
    [
      'stages.CreateLayer(ghostBackdrop, ghostTint, ghostNoise)',
      'stages.CreateLayer(ghostBackdrop, ghostNoise, ghostTint)',
    ],
    ['stages.CreateLayer(bodyBackdrop, bodyTint)', 'stages.CreateLayer(bodyTint, bodyBackdrop)'],
    ['stages.CreateLayer(tinted, bodyNoise)', 'stages.CreateLayer(bodyNoise, tinted)'],
    ['stages.CreateLayer(tinted, bodyNoise)', 'stages.CreateLayer(bodyBackdrop, bodyNoise)'],
    ['ghostVisual.Effect = MaskBrush(', 'output.Effect = MaskBrush('],
    ['bodyVisual.Effect = MaskBrush(', 'tinted.Effect = MaskBrush('],
    [
      'Background = Source("Backdrop"), Foreground = Paint(Blend!, "blendPaint")',
      'Foreground = Source("Backdrop"), Background = Paint(Blend!, "blendPaint")',
    ],
    [
      'BlendEffectMode.Overlay : BlendEffectMode.ColorDodge',
      'BlendEffectMode.ColorDodge : BlendEffectMode.Overlay',
    ],
    [
      'layer.CompositeMode = CompositionCompositeMode.SourceOver;',
      'layer.CompositeMode = CompositionCompositeMode.MinBlend;',
    ],
    [
      'visual.CompositeMode = CompositionCompositeMode.SourceOver;',
      'visual.CompositeMode = CompositionCompositeMode.MinBlend;',
    ],
    ['visual.Opacity = opacity;', 'visual.Opacity = 1;'],
    [
      'foreach (var child in children) layer.Children.InsertAtTop(child);',
      'foreach (var child in children.Reverse()) layer.Children.InsertAtTop(child);',
    ],
    [
      'stages.CreateLayer(ghostVisual, outerVisual, bodyVisual, borderVisual)',
      'stages.CreateLayer(ghostVisual, bodyVisual, outerVisual, borderVisual)',
    ],
  ]) {
    assert.ok(source.includes(original));
    assert.throws(() => assertSurfaceStages(source.replace(original, replacement)));
  }
});

test('Sheet surface source guard rejects changed coordinates and a SourceOver progressive sum', () => {
  for (const [original, replacement] of [
    ['surface.SourceOffset = offset;', 'surface.SourceOffset = Vector2.Zero;'],
    ['surface.SourceSize = size;', 'surface.SourceSize = size / 2;'],
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
    ['layer.Effect = null;', '', 'private sealed class SurfaceStages('],
    ['Frame.ThrowCleanup(errors);', '', 'private sealed class SurfaceStages('],
    ['stages?.Dispose();', '', 'private Frame BuildFrame('],
  ]) {
    const start = source.indexOf(owner);
    assert.ok(start >= 0 && source.slice(start).includes(original));
    const candidate = source.slice(0, start) + source.slice(start).replace(original, replacement);
    assert.throws(() => assertSurfaceStages(candidate));
  }
});

test('Sheet factories retain active failure metadata without the retired final graph diagnostics', () => {
  assert.match(
    build,
    /CompositionEffectBrush Brush\(string factoryName, IGraphicsEffect graph,\s*params \(string Name, CompositionBrush Source\)\[\] bindings\)/,
  );
  const start = build.indexOf('catch (Exception primary)');
  const end = build.indexOf('CompositionEffectBrush MaskBrush(');
  assert.ok(start >= 0 && end > start);
  const failure = build.slice(start, end);
  assert.match(
    failure,
    /primary\.Data\["LabUI\.SheetFactoryFailure"\] = new Dictionary<string, object\?>\s*\{ \["name"\] = factoryName, \["operation"\] = operation \};/,
  );
  assert.match(failure, /catch \{ \}\s*throw;/);
  assert.doesNotMatch(
    build,
    /inlineProgressive|progressiveGraph|ghostSourceGraph|progressiveBranches|SheetSourceTopologyProbe\.Record(?:Branches|SigmaFactories|Actual\w+)\(/,
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
  assert.match(build, /stages\.CreateVisual\(ghostPaint, \(float\)Ghost!\.Opacity\)/);
  assert.match(
    build,
    /stages\.CreateVisual\(noiseBrush, \(float\)Geometry\.SheetGhostNoiseOpacity\)/,
  );
  assert.match(build, /ghostVisual\.Effect = MaskBrush\("ghost", ghostMask\);/);
  assert.match(build, /bodyVisual\.Effect = MaskBrush\("body", bodyMask\);/);
  assert.doesNotMatch(build, /ghostSource|Source\("progressiveSurface"\)|Paint\(Ghost!/);
  assert.match(geometry, /SheetGhostBlurRadius = 24;/);
  assert.match(geometry, /SheetBodyBlurRadius = 128;/);
  assert.match(source, /RadiusToSigma = 0\.5;/);
  assert.match(build, /Paint\(Blend!, "blendPaint"\)/);
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
  assert.doesNotMatch(build, /Own\(sceneVisual\)/);
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
