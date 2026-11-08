import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// Source guards и чистая математика. WinUI/Win2D не загружаются; пиксели не моделируются.
const source = await readFile(new URL('../Rendering/SheetLayers.cs', import.meta.url), 'utf8');
const profile = await readFile(
  new URL('../Rendering/SheetBlurProfile.cs', import.meta.url),
  'utf8',
);
const geometry = await readFile(new URL('../generated/Geometry.g.cs', import.meta.url), 'utf8');
const material = await readFile(
  new URL('../generated/SheetMaterial.g.cs', import.meta.url),
  'utf8',
);
const levels = [0, 1 / 64, 1 / 32, 1 / 16, 1 / 8, 1 / 4, 1 / 2, 1];

// Лексические фрагменты не зависят от отступов и комментариев. Это не C# executor.
function code(text) {
  return (
    text.match(
      /\/\/[^\r\n]*|\/\*[\s\S]*?\*\/|\$?"(?:\\.|[^"\\])*"|[A-Za-z_]\w*|\d+(?:\.\d+)?[fFdD]?|[^\s]/g,
    ) ?? []
  )
    .filter((token) => !token.startsWith('//') && !token.startsWith('/*'))
    .join(' ');
}

function includes(actual, ...snippets) {
  const normalized = ` ${code(actual)} `;
  for (const snippet of snippets)
    assert.ok(normalized.includes(` ${code(snippet)} `), `Sheet source law missing: ${snippet}`);
}

function section(candidate, start, end) {
  const first = candidate.indexOf(start);
  const last = candidate.indexOf(end, first);
  assert.ok(first >= 0 && last > first, `Sheet section missing: ${start}`);
  return candidate.slice(first, last);
}

const frameOf = (candidate) =>
  section(candidate, 'private Frame BuildFrame(', 'private CanvasGeometry BodyShape(');
const stagesOf = (candidate) =>
  section(
    candidate,
    'private sealed class SurfaceStages(',
    'private sealed class Frame : IDisposable',
  );
const build = frameOf(source);

function rejectsChanges(check, changes) {
  check(source); // Не допускаем vacuous mutants: исправный исходник обязан пройти тот же измеритель.
  for (const [before, after] of changes) {
    assert.ok(source.includes(before), `Mutation target missing: ${before}`);
    assert.throws(
      () => check(source.replace(before, after)),
      undefined,
      `Accepted mutation: ${after}`,
    );
  }
}

function assertProgressive(candidate) {
  const frame = frameOf(candidate);
  includes(
    frame,
    'IGraphicsEffectSource Branch(int index) => index == 0 ? Backdrop() : Blur(Backdrop(), SheetBlurProfile.Levels[index] * Geometry.SheetGhostBlurRadius * metrics.Scale, $"ghostBlur{index}");',
    'var intervals = new Visual[SheetBlurProfile.Levels.Length - 1];',
    'for (var index = 0; index < intervals.Length; index++)',
    'var ramp = result.Own(compositor.CreateLinearGradientBrush());',
    'ramp.MappingMode = CompositionMappingMode.Absolute;',
    'ramp.ExtendMode = CompositionGradientExtendMode.Clamp;',
    'ramp.StartPoint = new(0, (float)metrics.GhostHeight * SheetBlurProfile.Levels[index]);',
    'ramp.EndPoint = new(0, (float)metrics.GhostHeight * SheetBlurProfile.Levels[index + 1]);',
    'ramp.ColorStops.Add(result.Own(compositor.CreateColorGradientStop(0, Color.FromArgb(0, 255, 255, 255))));',
    'ramp.ColorStops.Add(result.Own(compositor.CreateColorGradientStop(1, maskInk)));',
    'Mode = CanvasComposite.DestinationOut, Sources = { Branch(index), Source("mask") }',
    'var upper = Mask(Branch(index + 1), Source("mask"));',
    'Mode = CanvasComposite.Add, Sources = { lower, upper }',
    'Brush($"progressiveInterval{index}", pair, ("backdrop", capturedBackdrop), ("mask", ramp))',
    'var clip = result.Own(compositor.CreateRectangleClip());',
    'clip.Left = 0;',
    'clip.Right = result.Visual.Size.X;',
    'clip.Top = (float)metrics.GhostHeight * SheetBlurProfile.Levels[index];',
    'clip.Bottom = (float)metrics.GhostHeight * SheetBlurProfile.Levels[index + 1];',
    'interval.BorderMode = CompositionBorderMode.Hard;',
    'interval.Clip = clip;',
    'intervals[index] = interval;',
    'var ghostBackdrop = stages.CreateLayer(intervals);',
  );
  // Единственный live input — сцена. Эффект не захватывает собственный результат.
  assert.deepEqual(
    [...code(frame).matchAll(/stages \. Capture \( (\w+)/g)].map((match) => match[1]),
    ['sceneVisual'],
  );
  assert.doesNotMatch(
    code(frame),
    /CreateBackdropBrush|progressiveSources|capturedProgressive|ghostMasks|CanvasLinearGradientBrush/,
  );
  const intervals = section(frame, 'var intervals =', 'var ghostPaint =');
  assert.doesNotMatch(code(intervals), /\bLayer \(|\batlasBrush\b/);
}

function assertSceneOwnership(candidate) {
  const frame = frameOf(candidate);
  const stages = stagesOf(candidate);
  includes(
    frame,
    'var sceneVisual = ElementCompositionPreview.GetElementVisual(scene!);',
    'if (!ReferenceEquals(sceneVisual.Compositor, compositor) || !ReferenceEquals(scene!.XamlRoot, XamlRoot))',
    'var transform = TransformToVisual(scene);',
    'var origin = transform.TransformPoint(new Point(0, 0));',
    'var right = transform.TransformPoint(new Point(metrics.Width, 0));',
    'var bottom = transform.TransformPoint(new Point(0, metrics.Height));',
    'var capturedBackdrop = stages.Capture(sceneVisual, new Vector2((float)origin.X, (float)origin.Y), new Vector2((float)(right.X - origin.X), (float)(bottom.Y - origin.Y)));',
    'var bodyBackdrop = stages.CreateVisual(capturedBackdrop);',
  );
  includes(
    stages,
    'var surface = frame.Own(compositor.CreateVisualSurface());',
    'surfaces.Add(surface);',
    'surface.SourceVisual = visual;',
    'surface.SourceOffset = offset;',
    'surface.SourceSize = size;',
    'var brush = frame.Own(compositor.CreateSurfaceBrush(surface));',
    'brush.Stretch = CompositionStretch.Fill;',
    'brush.HorizontalAlignmentRatio = 0;',
    'brush.VerticalAlignmentRatio = 0;',
    'var visual = frame.Own(compositor.CreateSpriteVisual());',
    'visuals.Add(visual);',
    'visual.Size = frame.Visual.Size;',
    'visual.CompositeMode = CompositionCompositeMode.SourceOver;',
    'visual.Opacity = opacity;',
    'visual.Brush = brush;',
  );
  assert.doesNotMatch(
    code(frame),
    /Own \( sceneVisual \)|CreateVisualSurface|CreateSpriteVisual|CreateLayerVisual/,
  );
}

function assertMaterials(candidate) {
  const frame = frameOf(candidate);
  const stages = stagesOf(candidate);
  includes(
    frame,
    'Mode = CanvasComposite.DestinationIn, Sources = { source, mask }',
    'Mask(Source("Backdrop"), Layer(index))',
    'var ghostTint = stages.CreateVisual(ghostPaint, (float)Ghost!.Opacity);',
    'var ghostNoise = stages.CreateVisual(noiseBrush, (float)Geometry.SheetGhostNoiseOpacity);',
    'var ghostVisual = stages.CreateLayer(ghostBackdrop, ghostTint, ghostNoise);',
    'var ghostClip = result.Own(compositor.CreateRectangleClip());',
    'ghostClip.Left = 0;',
    'ghostClip.Top = 0;',
    'ghostClip.Right = result.Visual.Size.X;',
    'ghostClip.Bottom = (float)metrics.GhostHeight;',
    'ghostVisual.BorderMode = CompositionBorderMode.Soft;',
    'ghostVisual.Clip = ghostClip;',
    'var bodyTint = stages.CreateVisual(tintPaint, (float)Tint!.Opacity);',
    'var bodyVisual = stages.CreateLayer(bodyBackdrop);',
    'foreach (var stage in SheetMaterialProfile.Stages)',
    'switch (stage)',
    'case SheetBodyStage.Tint:',
    'bodyVisual = stages.CreateLayer(bodyVisual, bodyTint);',
    'case SheetBodyStage.Blend:',
    'Background = Source("Backdrop"), Foreground = Paint(Blend!, "blendPaint"),',
    'Mode = SheetMaterialProfile.BlendMode(ActualTheme == ElementTheme.Dark),',
    'bodyVisual.Effect = Brush("body", blended, ("blendPaint", blendPaint));',
    'case SheetBodyStage.Blur:',
    'bodyVisual.Effect = Brush("body", Blur(Source("Backdrop"), Geometry.SheetBodyBlurRadius * metrics.Scale));',
    'var bodyNoise = stages.CreateVisual(noiseBrush, (float)Geometry.SheetBodyNoiseOpacity);',
    'bodyVisual = stages.CreateLayer(bodyVisual, bodyNoise);',
    'bodyVisual.Effect = MaskBrush("body", bodyMask);',
    'var output = stages.CreateLayer(ghostVisual, outerVisual, bodyVisual, borderVisual);',
    'result.Visual.Children.InsertAtTop(output);',
    'IGraphicsEffectSource Paint(SolidColorBrush brush, string sourceName) => Effect(new OpacityEffect { Opacity = (float)brush.Opacity, Source = Source(sourceName), });',
  );
  for (const [paint, name] of [
    ['Ghost', 'ghostPaint'],
    ['Tint', 'tintPaint'],
    ['Blend', 'blendPaint'],
  ])
    includes(frame, `var ${name} = result.Own(compositor.CreateColorBrush(${paint}!.Color));`);
  includes(
    stages,
    'var layer = frame.Own(compositor.CreateLayerVisual());',
    'layers.Add(layer);',
    'layer.Size = frame.Visual.Size;',
    'layer.CompositeMode = CompositionCompositeMode.SourceOver;',
    'foreach (var child in children) layer.Children.InsertAtTop(child);',
  );
}

function assertCleanup(candidate) {
  const stages = stagesOf(candidate);
  includes(
    stages,
    'var captured = surfaces.ToArray();',
    'var rendered = visuals.ToArray();',
    'var flattened = layers.ToArray();',
    'surfaces.Clear(); visuals.Clear(); layers.Clear();',
    'Frame.ThrowCleanup(errors);',
  );
  const unlink = [
    'frame.Visual.Children.RemoveAll()',
    'surface.SourceVisual = null',
    'layer.Clip = null',
    'layer.Effect = null',
    'layer.Children.RemoveAll()',
    'visual.Clip = null',
    'visual.Brush = null',
  ];
  for (const action of unlink)
    includes(stages, `try { ${action}; } catch (Exception error) { errors.Add(error); }`);
  for (let index = 1; index < unlink.length; index++)
    assert.ok(
      stages.indexOf(unlink[index - 1]) < stages.indexOf(unlink[index]),
      'Unlink before releasing dependent resources',
    );
  assert.doesNotMatch(code(stages), /\. (?:Dispose|Close) \(/);
  const frame = frameOf(candidate);
  const failure = frame.slice(frame.lastIndexOf('catch (Exception error)'));
  includes(
    failure,
    'List<Exception> errors = [error];',
    'try { stages?.Dispose(); } catch (Exception cleanup) { errors.Add(cleanup); }',
    'try { result.Dispose(); } catch (Exception cleanup) { errors.Add(cleanup); }',
    'if (errors.Count > 1) throw new AggregateException("Ошибка создания и освобождения Sheet.", errors);',
    'throw;',
  );
  assert.ok(failure.indexOf('stages?.Dispose()') < failure.indexOf('result.Dispose()'));
  includes(frame, 'result.Own(stages);');
  includes(candidate, 'for (var index = resources.Length - 1; index >= 0; index--)');
}

test('Sheet preserves eight authored levels and four raster cells beside native interval ramps', () => {
  const literals = profile.match(/levels\s*=\s*\[([^\]]+)\]/)?.[1];
  assert.ok(literals, 'Authored levels missing');
  const actual = literals.split(',').map((literal) => {
    const fraction = literal.trim().match(/^(\d+)f?(?:\s*\/\s*(\d+))?$/);
    assert.ok(fraction, 'Unexpected level expression');
    return Number(fraction[1]) / Number(fraction[2] ?? 1);
  });
  assert.deepEqual(actual, levels);
  includes(
    profile,
    'if (index > 1) stops.Add((0, 0));',
    'if (index > 0) stops.Add((levels[index - 1], 0));',
    'stops.Add((levels[index], 1));',
    'if (index + 1 < levels.Length) stops.Add((levels[index + 1], 0));',
    'if (index + 2 < levels.Length) stops.Add((1, 0));',
  );
  includes(
    build,
    'SheetAtlasLayout.Create(pixelWidth, pixelHeight, result.Visual.Size, scale, 4)',
    'Source = source, BlurAmount = (float)(radius * RadiusToSigma), BorderMode = EffectBorderMode.Hard,',
    'graph, Geometry.SheetGhostBlurRadius * metrics.Scale * RadiusToSigma, Geometry.SheetBodyBlurRadius * metrics.Scale * RadiusToSigma',
  );
  includes(geometry, 'SheetGhostBlurRadius = 24;', 'SheetBodyBlurRadius = 128;');
  includes(source, 'RadiusToSigma = SheetMaterialProfile.RadiusToSigma;');
  includes(
    material,
    'RadiusToSigma = 0.5;',
    '[SheetBodyStage.Tint, SheetBodyStage.Blend, SheetBodyStage.Blur]',
  );
});

// Идеальные кусочно-линейные веса; не утверждение о native raster seams/quantization.
function weight(index, position) {
  const center = levels[index];
  if (position === center) return 1;
  const neighbor = levels[index + (position < center ? -1 : 1)];
  if (neighbor === undefined) return 0;
  return Math.max(0, 1 - Math.abs((position - center) / (neighbor - center)));
}
const add = (left, right) => left.map((value, index) => value + right[index]);
const scale = (rgba, factor) => rgba.map((value) => value * factor);
const over = (front, back) => add(front, scale(back, 1 - front[3]));
const close = (actual, expected) =>
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < 1e-12));

test('Adjacent pair weights partition unity, retain knots and equal the full eight-level premultiplied sum', () => {
  const samples = levels.map((_, index) => {
    const alpha = (index + 1) / 9;
    return [(alpha * index) / 8, alpha / 3, (alpha * (8 - index)) / 8, alpha];
  });
  for (let interval = 0; interval < levels.length - 1; interval++) {
    for (const fraction of [0, 1 / 64, 1 / 4, 1 / 2, 3 / 4, 63 / 64, 1]) {
      const position = levels[interval] + fraction * (levels[interval + 1] - levels[interval]);
      const weights = levels.map((_, index) => weight(index, position));
      close([weights.reduce((sum, value) => sum + value, 0)], [1]);
      close([weights.reduce((sum, value, index) => sum + value * levels[index], 0)], [position]);
      assert.ok(
        weights.every(
          (value, index) => value === 0 || index === interval || index === interval + 1,
        ),
      );
      close([weights[interval], weights[interval + 1]], [1 - fraction, fraction]);
      const all = samples.reduce(
        (sum, rgba, index) => add(sum, scale(rgba, weights[index])),
        [0, 0, 0, 0],
      );
      const pair = add(
        scale(samples[interval], 1 - fraction),
        scale(samples[interval + 1], fraction),
      );
      close(pair, all);
    }
  }
});

test('A shared ramp preserves alpha where filtered triangle masks lose a third contribution at fractional DPI', () => {
  // Линейная реконструкция масок при прежней atlas-проекции 375x812, Half, 125%.
  // Это различающий математический пример, не модель native Gaussian или PNG.
  const dpi = 1.25;
  const ghostHeight = 422;
  const brushScale = Math.min(375 / Math.ceil(375 * dpi), 812 / Math.ceil(812 * dpi));
  const offset = (812 - Math.ceil(812 * dpi) * brushScale) / 2;
  const y = 16.5 / dpi;
  const sourceY = (y - offset) / brushScale - 0.5;
  const row = Math.floor(sourceY);
  const fraction = sourceY - row;
  const sample = (read) =>
    (1 - fraction) * read((row + 0.5) / dpi / ghostHeight) +
    fraction * read((row + 1.5) / dpi / ghostHeight);
  const weights = levels.map((_, index) => sample((position) => weight(index, position)));
  assert.ok(y >= ghostHeight * levels[2] && y < ghostHeight * levels[3]);
  close([weights.reduce((sum, value) => sum + value, 0)], [1]);
  assert.ok(weights[1] > 0.03, 'filtered third branch must make the old pair fail');
  assert.ok(weights[2] + weights[3] < 0.97, 'two independent triangle masks lose alpha');

  const m = sample((position) =>
    Math.max(0, Math.min(1, (position - levels[2]) / (levels[3] - levels[2]))),
  );
  for (const value of [0, m, Math.round(m * 255) / 255, 1]) {
    const lower = [0.5, 0, 0, 0.5];
    const upper = [0, 0, 0.25, 0.25];
    close(add(scale(lower, 1 - value), scale(upper, value)), [
      0.5 * (1 - value),
      0,
      0.25 * value,
      0.5 * (1 - value) + 0.25 * value,
    ]);
    close(add(scale([1, 1, 1, 1], 1 - value), scale([1, 1, 1, 1], value)), [1, 1, 1, 1]);
  }
});

test('Add retains transparent premultiplied interpolation; SourceOver attenuates color and alpha', () => {
  // W3C Compositing 1 §§5.1, 9.1.4, 9.1.13: https://www.w3.org/TR/compositing-1/
  const red = [0.5, 0, 0, 0.5];
  const blue = [0, 0, 0.25, 0.25];
  close(add(scale(red, 0.5), scale(blue, 0.5)), [0.25, 0, 0.125, 0.375]);
  close(over(scale(red, 0.5), scale(blue, 0.5)), [0.25, 0, 0.09375, 0.34375]);
  assert.notDeepEqual(
    over(scale(red, 0.5), scale(blue, 0.5)),
    over(scale(blue, 0.5), scale(red, 0.5)),
  );
  for (const rgba of [[0, 0, 0, 0], red, [0.2, 0.4, 0.8, 1]])
    for (const factor of [0, 0.25, 0.5, 0.75, 1])
      close(add(scale(rgba, factor), scale(rgba, 1 - factor)), rgba);
});

test('Sheet uses seven clipped Add intervals over one borrowed live scene', () => {
  assertProgressive(source);
  assertSceneOwnership(source);
});

test('Sheet guards reject a different pair, composition operator, interval coverage or capture source', () => {
  rejectsChanges(assertProgressive, [
    [
      'CanvasComposite.Add, Sources = { lower, upper }',
      'CanvasComposite.SourceOver, Sources = { lower, upper }',
    ],
    ['Mask(Branch(index + 1), Source("mask"))', 'Mask(Branch(index), Source("mask"))'],
    ['CanvasComposite.DestinationOut', 'CanvasComposite.DestinationIn'],
    ['Mask(Branch(index + 1), Source("mask"))', 'Mask(Branch(index + 1), Source("otherMask"))'],
    [
      'ramp.MappingMode = CompositionMappingMode.Absolute;',
      'ramp.MappingMode = CompositionMappingMode.Relative;',
    ],
    [
      'ramp.ExtendMode = CompositionGradientExtendMode.Clamp;',
      'ramp.ExtendMode = CompositionGradientExtendMode.Wrap;',
    ],
    ['("mask", ramp)', '("mask", atlasBrush)'],
    [
      'result.Own(compositor.CreateLinearGradientBrush())',
      'compositor.CreateLinearGradientBrush()',
    ],
    [
      'new Visual[SheetBlurProfile.Levels.Length - 1]',
      'new Visual[SheetBlurProfile.Levels.Length - 2]',
    ],
    ['clip.Top = (float)metrics.GhostHeight * SheetBlurProfile.Levels[index];', 'clip.Top = 0;'],
    [
      'clip.Bottom = (float)metrics.GhostHeight * SheetBlurProfile.Levels[index + 1];',
      'clip.Bottom = result.Visual.Size.Y - (float)metrics.GhostHeight * SheetBlurProfile.Levels[index + 1];',
    ],
    [
      'interval.BorderMode = CompositionBorderMode.Hard;',
      'interval.BorderMode = CompositionBorderMode.Soft;',
    ],
    ['interval.Clip = clip;', ''],
    ['stages.Capture(sceneVisual,', 'stages.Capture(result.Visual,'],
  ]);
  rejectsChanges(assertSceneOwnership, [
    ['surface.SourceVisual = visual;', 'surface.SourceVisual = frame.Visual;'],
    ['surface.SourceOffset = offset;', 'surface.SourceOffset = Vector2.Zero;'],
    ['surface.SourceSize = size;', 'surface.SourceSize = size / 2;'],
    ['visual.Size = frame.Visual.Size;', 'visual.Size = Vector2.One;'],
  ]);
});

test('Ghost/Body masks follow grouped paints, separate alpha/opacity and authored SourceOver order', () => {
  assertMaterials(source);
  rejectsChanges(assertMaterials, [
    [
      'stages.CreateLayer(ghostBackdrop, ghostTint, ghostNoise)',
      'stages.CreateLayer(ghostBackdrop, ghostNoise, ghostTint)',
    ],
    ['stages.CreateLayer(bodyVisual, bodyNoise)', 'stages.CreateLayer(bodyBackdrop, bodyNoise)'],
    [
      'stages.CreateLayer(ghostVisual, outerVisual, bodyVisual, borderVisual)',
      'stages.CreateLayer(ghostVisual, bodyVisual, outerVisual, borderVisual)',
    ],
    ['ghostVisual.Clip = ghostClip;', 'ghostBackdrop.Clip = ghostClip;'],
    [
      'ghostClip.Bottom = (float)metrics.GhostHeight;',
      'ghostClip.Bottom = (float)metrics.BodyTop;',
    ],
    ['Mask(Source("Backdrop"), Layer(index))', 'Mask(Layer(index), Source("Backdrop"))'],
    [
      'stages.CreateVisual(ghostPaint, (float)Ghost!.Opacity)',
      'stages.CreateVisual(ghostPaint, (float)Ghost!.Color.A / 255)',
    ],
    [
      'stages.CreateVisual(noiseBrush, (float)Geometry.SheetBodyNoiseOpacity)',
      'stages.CreateVisual(noiseBrush, (float)(Geometry.SheetBodyNoiseOpacity * Tint!.Opacity))',
    ],
    [
      'layer.CompositeMode = CompositionCompositeMode.SourceOver;',
      'layer.CompositeMode = CompositionCompositeMode.MinBlend;',
    ],
    ['Opacity = (float)brush.Opacity,', 'Opacity = 1,'],
  ]);
});

test('Atlas retains viewport projection, per-cell writes and owned resources', () => {
  includes(
    build,
    'var atlasSurface = result.Own(graphics!.CreateVirtualDrawingSurface(',
    'new Windows.Graphics.SizeInt32 { Width = atlas.Width, Height = atlas.Height }',
    'DirectXAlphaMode.Premultiplied',
    'TransformMatrix = atlas.Cell(index).EffectTransform,',
    'var atlasBrush = result.Own(compositor.CreateSurfaceBrush(atlasSurface));',
    'atlasBrush.Stretch = CompositionStretch.None;',
    'atlasBrush.HorizontalAlignmentRatio = 0;',
    'atlasBrush.VerticalAlignmentRatio = 0;',
    'atlasBrush.Scale = atlas.BrushScale;',
    'atlasBrush.Offset = atlas.BrushOffset;',
    'new Rect(cell.PixelX, cell.PixelY, pixelWidth, pixelHeight), (float)(96 * scale)',
    'drawing.Clear(Color.FromArgb(0, 0, 0, 0));',
    'atlasDrawings[index](drawing);',
    'for (var index = 0; index < atlasDrawings.Count; index++) DrawAtlasCell(index);',
    'DrawShadows(drawing, metrics, bodyShape)',
    'DrawNoise(drawing, pixelWidth, pixelHeight, scale)',
    'var factory = result.Own(SheetSourceTopologyProbe.CreateFactory(',
    'var brush = result.Own(factory.CreateBrush());',
    'foreach (var (name, source) in bindings) brush.SetSourceParameter(name, source);',
    'primary.Data["LabUI.SheetFactoryFailure"] = new Dictionary<string, object?> { ["name"] = factoryName, ["operation"] = operation };',
  );
  assert.doesNotMatch(code(build), /drawing \. Transform|DrawingOffset|MaximumBitmapSizeInPixels/);
  includes(source, 'ElementCompositionPreview.SetElementChildVisual(this, candidate.Visual)');
});

test('Frame unlinks captures, layers, clips and brushes before reverse resource disposal, including failure', () => {
  assertCleanup(source);
  rejectsChanges(assertCleanup, [
    ['surface.SourceVisual = null;', ''],
    ['layer.Clip = null;', ''],
    ['layer.Effect = null;', ''],
    ['layer.Children.RemoveAll();', ''],
    ['visual.Clip = null;', ''],
    ['visual.Brush = null;', ''],
    ['stages?.Dispose();', ''],
  ]);
});
