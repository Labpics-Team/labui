import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Полный LabSheet исполняется с управляемыми XAML/renderer границами.
// Проба проверяет публичные уведомления, factory peer и перенос geometry к частям.
// Цикл WinUI measure/arrange, живой UIA, GPU и capture требуют hosted исполнения.
// Модель clipping/extent относится к публичному исходнику baf4916, а не к бинарной WinUI 2.6.4.
const source = await readFile(new URL('../LabSheet.cs', import.meta.url), 'utf8');
const template = await readFile(new URL('../Themes/Generic.xaml', import.meta.url), 'utf8');
const sheetTemplate = template.match(
  /<Style\b[^>]*TargetType="local:LabSheet"[^>]*>[\s\S]*?<\/Style>/,
)?.[0];
if (!sheetTemplate) throw new Error('Шаблон LabSheet отсутствует.');
const wrapsContent = sheetTemplate.includes('<ContentPresenter x:Name="PART_Content"');
const program = `using LabUI.WinUI;
using LabUI.WinUI.Rendering;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using System.Reflection;
using Windows.Foundation;

var failures = new List<string>();
void Run(string name, Action body) {
    try { body(); Console.WriteLine($"PASS {name}"); }
    catch (Exception error) { failures.Add(name); Console.WriteLine($"FAIL {name}: {error.Message}"); }
}
void Check(bool value, string message) { if (!value) throw new Exception(message); }
(LabSheet Sheet, SheetLayers Layers, List<LabSheetMaterial?> Events) Ready() {
    var sheet = new LabSheet { Material = LabSheetMaterial.Solid };
    var layer = new SheetLayers();
    var events = new List<LabSheetMaterial?>();
    sheet.EffectiveMaterialChanged += (_, _) => {
        Check((sheet.EffectiveMaterial is null) == (sheet.MaterialReason is null), "Partial material tuple");
        events.Add(sheet.EffectiveMaterial);
    };
    sheet.UseTemplate(layer);
    sheet.Load();
    Check(events.SequenceEqual(new LabSheetMaterial?[] { LabSheetMaterial.Solid }), "Initial ready missing");
    return (sheet, layer, events);
}

Run("public unload publishes loss and next attachment", () => {
    var (sheet, layer, events) = Ready();
    sheet.Unload();
    Check(events.SequenceEqual(new LabSheetMaterial?[] { LabSheetMaterial.Solid, null }), "Consumer retained ready after unload");
    Check(layer.Subscribers == 0, "Old subscription retained");
    sheet.Load();
    Check(events.SequenceEqual(new LabSheetMaterial?[] { LabSheetMaterial.Solid, null, LabSheetMaterial.Solid }), "Next ready missing");
});
Run("template replacement publishes loss then new material", () => {
    var (sheet, old, events) = Ready();
    var next = new SheetLayers();
    sheet.UseTemplate(next); sheet.ApplyTemplate();
    Check(events.SequenceEqual(new LabSheetMaterial?[] { LabSheetMaterial.Solid, null, LabSheetMaterial.Solid }), "Template readiness history lost");
    Check(old.Subscribers == 0 && next.Subscribers == 1, "Wrong template subscription owner");
});
Run("failed replacement retains public null", () => {
    var (sheet, old, events) = Ready();
    var error = new InvalidOperationException("new layer failed");
    sheet.UseTemplate(new SheetLayers { AttachError = error });
    try { sheet.ApplyTemplate(); throw new Exception("Expected layer failure"); }
    catch (Exception actual) when (ReferenceEquals(actual, error)) { }
    Check(events.SequenceEqual(new LabSheetMaterial?[] { LabSheetMaterial.Solid, null }), "Failure retained old ready notification");
    Check(sheet.EffectiveMaterial is null && sheet.MaterialReason is null && old.Subscribers == 0, "Failed successor retained old state");
});
foreach (var replace in new[] { false, true }) foreach (var throwAfter in new[] { false, true }) {
    Run($"reentrant replacement={replace} throw={throwAfter}", () => {
        var (sheet, old, events) = Ready();
        var next = replace ? new SheetLayers() : old;
        var expected = new InvalidOperationException("subscriber reattached then failed");
        var entered = false;
        sheet.EffectiveMaterialChanged += (_, _) => {
            if (sheet.EffectiveMaterial is not null || entered) return;
            entered = true;
            if (replace) sheet.UseTemplate(next);
            sheet.Load();
            if (throwAfter) throw expected;
        };
        try { sheet.Unload(); if (throwAfter) throw new Exception("Expected subscriber failure"); }
        catch (Exception actual) when (throwAfter && ReferenceEquals(actual, expected)) { }
        Check(entered, "Readiness loss was not forwarded");
        Check(sheet.EffectiveMaterial == LabSheetMaterial.Solid && next.Subscribers == 1, "Old cleanup disconnected successor");
        Check(events.SequenceEqual(new LabSheetMaterial?[] { LabSheetMaterial.Solid, null, LabSheetMaterial.Solid }), "Duplicate or absent successor notification");
        next.Change(LabSheetMaterial.Blur);
        Check(events.Count == 4 && events[^1] == LabSheetMaterial.Blur, "Successor stopped forwarding");
        if (replace) Check(old.Subscribers == 0, "Retired layer still subscribed");
    });
}
Run("automation factory belongs to the actual control", () => {
    var sheet = new LabSheet();
    var factory = typeof(LabSheet).GetMethod("OnCreateAutomationPeer", BindingFlags.Instance | BindingFlags.NonPublic)!;
    var peer = factory.Invoke(sheet, null);
    Check(peer is Microsoft.UI.Xaml.Automation.Peers.FrameworkElementAutomationPeer, "Control has no framework peer");
    var owner = typeof(Microsoft.UI.Xaml.Automation.Peers.FrameworkElementAutomationPeer)
        .GetProperty("Owner", BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(peer);
    Check(ReferenceEquals(owner, sheet), "Peer belongs to another control");
});
Run("state layout and renderer receive the same geometry", () => {
    var (sheet, layer, _) = Ready();
    foreach(var (state, top, height) in new[] {
        (LabSheetState.Full,36d,776d), (LabSheetState.TwoThirds,272d,540d),
        (LabSheetState.Half,390d,422d), (LabSheetState.OneThird,542d,270d), (LabSheetState.Flex,772d,40d)
    }) {
        sheet.State=state; sheet.Measure(new Size(375,812));
        var body=sheet.TemplatePart<Grid>("PART_Body");
        Check(body.Margin.T==top && body.Height==height, $"{state}: wrong XAML body");
        Check(layer.LastMetrics is { } metrics && metrics.State==state && metrics.BodyTop==top && metrics.BodyHeight==height,
            $"{state}: renderer diverges from XAML");
        Check(((Microsoft.UI.Xaml.Media.RectangleGeometry)body.Clip!).Rect.Height==height, "Body clip escaped viewport");
    }
});
Run("Flex measures content at its width, grows, shrinks and clamps", () => {
    var (sheet, layer, _) = Ready();
    var viewport=sheet.TemplatePart<ScrollViewer>("PART_ContentViewport");
    var content=new ContentWitness(100);
    sheet.State=LabSheetState.Flex; sheet.Content=content;
    sheet.Measure(new Size(375,812));
    Check(content.Constraints.All(size=>size.Width==343 && double.IsFinite(size.Height)), "Flex obscured the finite viewport");
    Check(layer.LastMetrics?.BodyHeight==164, "Flex did not hug content");
    content.NaturalHeight=200; sheet.Measure(new Size(375,812));
    Check(layer.LastMetrics?.BodyHeight==264, "Flex did not react to content growth");
    content.NaturalHeight=3000; sheet.Measure(new Size(375,400));
    Check(layer.LastMetrics?.BodyTop==0 && layer.LastMetrics?.BodyHeight==400 && layer.LastMetrics?.ContentHeight==336,
        "Overflow was not constrained to a scroll viewport");
    Check(viewport.ExtentHeight==3000, "Finite content measurement lost ordinary panel extent");
    sheet.Content=null; sheet.Measure(new Size(375,812));
    Check(layer.LastMetrics?.BodyHeight==40 && viewport.Visibility==Visibility.Collapsed, "Empty Flex retained a content gap");
});
Run("fill consumers retain finite measurement and their own viewport", () => {
    var (sheet, layer, _) = Ready();
    var viewport=sheet.TemplatePart<ScrollViewer>("PART_ContentViewport");
    var content=new ContentWitness(30000, selfScrolling:true);
    sheet.Content=content;
    foreach(var state in Enum.GetValues<LabSheetState>().OrderBy(state=>state==LabSheetState.Half?0:1)) {
        sheet.State=state; content.Constraints.Clear(); sheet.Measure(new Size(375,812));
        Check(content.Constraints.Count>0 && content.Constraints.All(size=>double.IsFinite(size.Height)), $"{state}: self-scrolling content received infinity");
        Check(content.Constraints[^1].Height==layer.LastMetrics?.ContentHeight, $"{state}: native fill lost its viewport");
        Check(viewport.ExtentHeight==layer.LastMetrics?.ContentHeight, $"{state}: outer scroll extent expanded a fill consumer");
    }
});
Run("public-source framework clips a raw desired height to the finite offer", () => {
    var content=new RawDesiredWitness(3000);
    content.Measure(new Size(343,358));
    Check(content.DesiredSize.Height==358, "Framework model did not clip raw DesiredSize");
});
foreach(var alignment in Enum.GetValues<VerticalAlignment>()) {
    Run($"public-source ordinary extent distinguishes {alignment}", () => {
        var (sheet, _, _) = Ready();
        var content=new ContentWitness(3000) { VerticalAlignment=alignment };
        sheet.Content=content; sheet.Measure(new Size(375,812));
        var viewport=sheet.TemplatePart<ScrollViewer>("PART_ContentViewport");
        Check(content.DesiredSize.Height==358, "Finite offer did not clip DesiredSize");
        Check(viewport.ExtentHeight==(alignment==VerticalAlignment.Stretch?3000:358),
            "Source-model extent ignored the Stretch-only ActualHeight fallback");
    });
}
foreach(var specified in new[] { "Height", "MinHeight", "MaxHeight" }) Run($"public-source specified {specified} disables the ActualHeight extent fallback", () => {
    var (sheet, _, _) = Ready();
    var content=new ContentWitness(3000);
    if(specified=="Height") content.Height=3000;
    if(specified=="MinHeight") content.MinHeight=1;
    if(specified=="MaxHeight") content.MaxHeight=4000;
    sheet.Content=content;
    sheet.Measure(new Size(375,812));
    Check(sheet.TemplatePart<ScrollViewer>("PART_ContentViewport").ExtentHeight==358,
        "Specified height entered the source-model ActualHeight fallback");
});
Run("native template replacement reapplies the finite content policy", () => {
    var viewport=Ready().Sheet.TemplatePart<ScrollViewer>("PART_ContentViewport");
    foreach(var _ in new[] { 0, 1 }) {
        viewport.UseNativeTemplate(); viewport.ApplyTemplate();
        Check(viewport.TemplatePart<ScrollContentPresenter>("ScrollContentPresenter").SizesContentToTemplatedParent,
            "A replaced native template restored infinite content measurement");
    }
});
Run("replacing the Sheet template retires its old viewport callback", () => {
    var (sheet, _, _) = Ready();
    var old=sheet.TemplatePart<ScrollViewer>("PART_ContentViewport");
    Check(old.CallbackCount(Control.TemplateProperty)==1, "Current native template has no policy owner");
    sheet.UseTemplate(new SheetLayers()); sheet.ApplyTemplate();
    var current=sheet.TemplatePart<ScrollViewer>("PART_ContentViewport");
    Check(old.CallbackCount(Control.TemplateProperty)==0 && current.CallbackCount(Control.TemplateProperty)==1,
        "Native policy leaked to the retired viewport or lost its successor");
});
Run("missing outer presenter never adopts the content's own viewport", () => {
    var (sheet, _, _) = Ready();
    var viewport=sheet.TemplatePart<ScrollViewer>("PART_ContentViewport");
    viewport.UseTemplate(new SheetLayers());
    var inner=viewport.TemplatePart<ScrollViewer>("PART_ContentViewport");
    try { sheet.Measure(new Size(375,812)); throw new Exception("Foreign presenter was accepted"); }
    catch(InvalidOperationException) { }
    Check(!inner.TemplatePart<ScrollContentPresenter>("ScrollContentPresenter").SizesContentToTemplatedParent,
        "Sheet changed the content's own scrolling policy");
});
Run("scale and resize preserve the body/renderer relation", () => {
    var (sheet, layer, _) = Ready();
    sheet.GeometryScale=2; sheet.Measure(new Size(375,812));
    Check(layer.LastMetrics?.BodyTop==374 && layer.LastMetrics?.ContentHeight==310, "Scale changed viewport rather than anatomy");
    var indicator=sheet.TemplatePart<Border>("PART_Indicator");
    Check(indicator.Width==72 && indicator.Height==8 && indicator.Margin.T==28, "Indicator did not scale");
    sheet.Resize(250,32);
    Check(layer.LastMetrics?.BodyTop==0 && layer.LastMetrics?.BodyHeight==32 && layer.LastMetrics?.ContentHeight==0,
        "Small viewport retains oversized body");
});
Run("invalid public state and scale do not change existing values", () => {
    var sheet=new LabSheet();
    try { sheet.State=(LabSheetState)99; throw new Exception("Invalid state accepted"); }
    catch(ArgumentOutOfRangeException) { }
    try { sheet.GeometryScale=double.PositiveInfinity; throw new Exception("Invalid scale accepted"); }
    catch(ArgumentOutOfRangeException) { }
    Check(sheet.State==LabSheetState.Half && sheet.GeometryScale==1, "Validation corrupted previous value");
});
Console.WriteLine($"RESULT failed={failures.Count}");
return failures.Count == 0 ? 0 : 1;
`;

const fakes = `namespace Microsoft.UI.Xaml {
    public class DependencyObject {
        private readonly Dictionary<DependencyProperty, object?> values = [];
        private readonly Dictionary<DependencyProperty, Dictionary<long, Action<DependencyObject, DependencyProperty>>> callbacks = [];
        private long nextToken;
        public virtual IReadOnlyList<DependencyObject> VisualChildren => [];
        public object GetValue(DependencyProperty p) => values.TryGetValue(p, out var value) ? value! : p.Metadata.DefaultValue!;
        public void SetValue(DependencyProperty p, object? value) { values[p] = value; p.Metadata.Changed?.Invoke(this, new()); }
        public long RegisterPropertyChangedCallback(DependencyProperty p, Action<DependencyObject, DependencyProperty> callback) {
            if(!callbacks.TryGetValue(p,out var listeners)) callbacks[p]=listeners=[];
            var token=++nextToken; listeners[token]=callback; return token;
        }
        public void UnregisterPropertyChangedCallback(DependencyProperty p, long token) => callbacks.GetValueOrDefault(p)?.Remove(token);
        protected void NotifyPropertyChanged(DependencyProperty p) {
            if(callbacks.TryGetValue(p,out var listeners)) foreach(var callback in listeners.Values.ToArray()) callback(this,p);
        }
        public int CallbackCount(DependencyProperty p) => callbacks.GetValueOrDefault(p)?.Count??0;
    }
    public sealed class DependencyProperty(PropertyMetadata metadata) {
        public PropertyMetadata Metadata { get; } = metadata;
        public static DependencyProperty Register(string n, Type t, Type o, PropertyMetadata m) => new(m);
    }
    public sealed class PropertyMetadata(object? value, Action<DependencyObject, DependencyPropertyChangedEventArgs>? changed = null) {
        public object? DefaultValue { get; } = value;
        public Action<DependencyObject, DependencyPropertyChangedEventArgs>? Changed { get; } = changed;
    }
    public sealed class DependencyPropertyChangedEventArgs : EventArgs { }
    public class RoutedEventArgs : EventArgs { }
    public sealed class SizeChangedEventArgs : EventArgs { }
    public delegate void RoutedEventHandler(object sender, RoutedEventArgs args);
    public delegate void SizeChangedEventHandler(object sender, SizeChangedEventArgs args);
    public readonly record struct Thickness(double L, double T, double R, double B);
    public readonly record struct CornerRadius(double Value);
    public class FrameworkElement : DependencyObject {
        public event RoutedEventHandler? Loaded, Unloaded;
        public event SizeChangedEventHandler? SizeChanged;
        public bool IsLoaded { get; private set; }
        public double ActualWidth { get; private set; } = 375;
        public double ActualHeight { get; private set; } = 812;
        public Visibility Visibility { get; set; }
        public double Height { get; set; } = double.NaN;
        public double MinHeight { get; set; }
        public double MaxHeight { get; set; } = double.PositiveInfinity;
        public VerticalAlignment VerticalAlignment { get; set; } = VerticalAlignment.Stretch;
        public string Name { get; set; } = "";
        public Windows.Foundation.Size DesiredSize { get; private set; }
        public virtual double ProjectedActualHeight => DesiredSize.Height;
        public void InvalidateMeasure() { }
        public void Measure(Windows.Foundation.Size size) {
            var available=size;
            if(double.IsFinite(Height)) size=new(size.Width, Math.Min(size.Height,Height));
            size=new(size.Width,Math.Min(size.Height,MaxHeight));
            var desired=MeasureOverride(size);
            var height=Math.Max(MinHeight,Math.Min(MaxHeight,double.IsFinite(Height)?Height:desired.Height));
            // framework.cpp 1813-1826: публичный DesiredSize ограничен исходным offer.
            DesiredSize=new(Math.Max(0,Math.Min(available.Width,desired.Width)),Math.Max(0,Math.Min(available.Height,height)));
        }
        protected virtual Windows.Foundation.Size MeasureOverride(Windows.Foundation.Size size) => size;
        public void Load() { IsLoaded = true; Loaded?.Invoke(this, new()); }
        public void Unload() { IsLoaded = false; Unloaded?.Invoke(this, new()); }
        public void Resize(double width=375, double height=812) {
            ActualWidth=width; ActualHeight=height; SizeChanged?.Invoke(this, new());
        }
        protected virtual Automation.Peers.AutomationPeer? OnCreateAutomationPeer() => null;
    }
    public enum Visibility { Visible, Collapsed }
    public enum VerticalAlignment { Top, Center, Bottom, Stretch }
}
namespace Microsoft.UI.Xaml.Controls {
    public class Control : FrameworkElement { public static readonly DependencyProperty TemplateProperty = new(new(null)); }
    public class ContentControl : Control {
        private readonly Dictionary<string, DependencyObject> parts = [];
        private bool applied;
        public Type? DefaultStyleKey { get; set; }
        public object? Content { get; set; }
        public Func<object?>? ContentBinding { get; set; }
        protected object? CurrentContent => ContentBinding?.Invoke() ?? Content;
        public override IReadOnlyList<DependencyObject> VisualChildren => parts.Values.ToArray();
        protected void ClearTemplateParts() { parts.Clear(); applied=false; }
        protected void SetTemplatePart(string name, DependencyObject value) {
            if(value is FrameworkElement element) element.Name=name;
            parts[name]=value; applied=false;
        }
        public T TemplatePart<T>(string name) => (T)(object)parts[name];
        public void UseTemplate(LabUI.WinUI.Rendering.SheetLayers layer) {
            ClearTemplateParts();
            parts["PART_Layers"] = layer; parts["PART_Body"] = new Grid();
            parts["PART_DragArea"] = new Grid(); parts["PART_Indicator"] = new Border();
            var viewport=new ScrollViewer();
            var presenter=new ContentPresenter { ContentBinding=()=>Content };
            ${wrapsContent ? 'viewport.Content=presenter;' : 'viewport.ContentBinding=()=>Content;'}
            parts["PART_ContentViewport"] = viewport; parts["PART_Content"] = presenter; applied = false;
        }
        protected DependencyObject? GetTemplateChild(string name) => parts.GetValueOrDefault(name);
        protected virtual void OnApplyTemplate() { }
        public bool ApplyTemplate() { if(applied) return false; applied=true; OnApplyTemplate(); return true; }
        protected override Windows.Foundation.Size MeasureOverride(Windows.Foundation.Size size) {
            if(parts.GetValueOrDefault("PART_ContentViewport") is ScrollViewer viewport
                && parts.GetValueOrDefault("PART_Body") is Grid body && parts.GetValueOrDefault("PART_DragArea") is Grid drag) {
                var height=Math.Max(0,body.Height-drag.Height-body.RowSpacing-body.Padding.B);
                viewport.Measure(new(size.Width-body.Padding.L-body.Padding.R,height));
            }
            return size;
        }
    }
    public class Grid : FrameworkElement {
        public Thickness Padding { get; set; }
        public Thickness Margin { get; set; }
        public double RowSpacing { get; set; }
        public Microsoft.UI.Xaml.Media.RectangleGeometry? Clip { get; set; }
    }
    public class Border : Grid {
        public double Width { get; set; }
        public CornerRadius CornerRadius { get; set; }
    }
    // Модель правил измерения и scroll extent SCP; живые layout и виртуализация проверяются отдельно.
    // Microsoft source baf4916: ScrollContentPresenter_Partial.cpp 1768-1789, 2422-2499, 3067-3113.
    public sealed class ScrollViewer : ContentControl {
        public double ExtentHeight { get; private set; }
        public ScrollViewer() => UseNativeTemplate();
        public void UseNativeTemplate() {
            ClearTemplateParts();
            SetTemplatePart("ScrollContentPresenter",new ScrollContentPresenter());
            NotifyPropertyChanged(TemplateProperty);
        }
        protected override Windows.Foundation.Size MeasureOverride(Windows.Foundation.Size size) {
            ApplyTemplate();
            var presenter=TemplatePart<ScrollContentPresenter>("ScrollContentPresenter");
            var child=CurrentContent as FrameworkElement;
            var childSize=presenter.SizesContentToTemplatedParent?size:new Windows.Foundation.Size(size.Width,double.PositiveInfinity);
            child?.Measure(childSize);
            // CanUseActualHeightAsExtent: Stretch, без заданных Height/MinHeight/MaxHeight.
            ExtentHeight=child is null?0:child.VerticalAlignment==VerticalAlignment.Stretch
                && double.IsNaN(child.Height) && child.MinHeight==0 && double.IsPositiveInfinity(child.MaxHeight)
                ? child.ProjectedActualHeight:child.DesiredSize.Height;
            return new(size.Width,Math.Min(size.Height,child?.DesiredSize.Height??0));
        }
    }
    public class ScrollContentPresenter : ContentPresenter { public bool SizesContentToTemplatedParent { get; set; } }
    public class ContentPresenter : FrameworkElement {
        public double NaturalHeight { get; set; }
        public Func<object?>? ContentBinding { get; set; }
        public Windows.Foundation.Size Available { get; private set; }
        protected override Windows.Foundation.Size MeasureOverride(Windows.Foundation.Size size) {
            Available=size;
            if(ContentBinding?.Invoke() is FrameworkElement child) { child.Measure(size); return child.DesiredSize; }
            return new(size.Width, Math.Min(size.Height,NaturalHeight));
        }
    }
    public sealed class RawDesiredWitness(double height) : FrameworkElement {
        protected override Windows.Foundation.Size MeasureOverride(Windows.Foundation.Size size) => new(size.Width,height);
    }
    public sealed class ContentWitness(double height, bool selfScrolling=false) : FrameworkElement {
        public double NaturalHeight { get; set; } = height;
        public List<Windows.Foundation.Size> Constraints { get; }=[];
        public override double ProjectedActualHeight => selfScrolling?DesiredSize.Height:NaturalHeight;
        protected override Windows.Foundation.Size MeasureOverride(Windows.Foundation.Size size) {
            Constraints.Add(size); return new(size.Width,selfScrolling?Math.Min(size.Height,NaturalHeight):NaturalHeight);
        }
    }
}
namespace Microsoft.UI.Xaml.Media {
    public static class VisualTreeHelper {
        public static int GetChildrenCount(Microsoft.UI.Xaml.DependencyObject parent) => parent.VisualChildren.Count;
        public static Microsoft.UI.Xaml.DependencyObject GetChild(Microsoft.UI.Xaml.DependencyObject parent, int index) => parent.VisualChildren[index];
    }
    public sealed class RectangleGeometry { public Windows.Foundation.Rect Rect { get; set; } }
}
namespace Windows.Foundation {
    public readonly record struct Size(double Width, double Height);
    public readonly record struct Rect(double X, double Y, double Width, double Height);
}
namespace Microsoft.UI.Xaml.Automation.Peers {
    public enum AutomationControlType { Group, Pane }
    public class AutomationPeer { }
    public class FrameworkElementAutomationPeer(FrameworkElement owner) : AutomationPeer {
        protected FrameworkElement Owner { get; } = owner;
        protected virtual string GetClassNameCore() => "FrameworkElement";
        protected virtual AutomationControlType GetAutomationControlTypeCore() => AutomationControlType.Pane;
    }
}
namespace LabUI.WinUI.Rendering {
    public sealed class SheetLayers : Microsoft.UI.Xaml.Controls.Grid {
        public event EventHandler? EffectiveMaterialChanged;
        public int Subscribers => EffectiveMaterialChanged?.GetInvocationList().Length ?? 0;
        public LabSheetMaterial? EffectiveMaterial { get; private set; }
        public LabSheetMaterialReason? MaterialReason { get; private set; }
        public Exception? AttachError { get; set; }
        internal SheetMetrics? LastMetrics { get; private set; }
        internal void SetMetrics(SheetMetrics metrics) => LastMetrics=metrics;
        internal void Attach(LabSheetMaterial material) {
            if(AttachError is { } error) throw error;
            Change(material);
        }
        internal void SetMaterial(LabSheetMaterial material) { if(EffectiveMaterial is not null) Change(material); }
        internal void Detach() {
            var ready = EffectiveMaterial is not null;
            EffectiveMaterial=null; MaterialReason=null;
            if(ready) EffectiveMaterialChanged?.Invoke(this, EventArgs.Empty);
        }
        public void Change(LabSheetMaterial material) {
            EffectiveMaterial=material; MaterialReason=LabSheetMaterialReason.Requested;
            EffectiveMaterialChanged?.Invoke(this, EventArgs.Empty);
        }
    }
}
`;

const temporaryRoot = await realpath(tmpdir());
const directory = await mkdtemp(path.join(temporaryRoot, 'labui-sheet-control-'));
try {
  await writeFile(
    path.join(directory, 'Boundary.csproj'),
    '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable><TreatWarningsAsErrors>true</TreatWarningsAsErrors></PropertyGroup></Project>',
  );
  await writeFile(path.join(directory, 'Source.cs'), source);
  await writeFile(path.join(directory, 'Program.cs'), program);
  await writeFile(path.join(directory, 'Fakes.cs'), fakes);
  for (const name of [
    'SheetMetrics.cs',
    'LabSheetState.cs',
    'ButtonMetrics.cs',
    'generated/Geometry.g.cs',
  ])
    await writeFile(
      path.join(directory, path.basename(name)),
      await readFile(new URL(`../${name}`, import.meta.url), 'utf8'),
    );
  const result = spawnSync(
    process.env.DOTNET_HOST_PATH || 'dotnet',
    ['run', '--project', path.join(directory, 'Boundary.csproj'), '--verbosity', 'quiet'],
    { encoding: 'utf8', windowsHide: true },
  );
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  const resolved = await realpath(directory);
  const relative = path.relative(temporaryRoot, resolved);
  assert.ok(
    relative &&
      !path.isAbsolute(relative) &&
      relative !== '..' &&
      !relative.startsWith(`..${path.sep}`) &&
      !relative.includes(path.sep) &&
      path.basename(resolved).startsWith('labui-sheet-control-'),
    `Unsafe cleanup target: ${resolved}`,
  );
  await rm(resolved, { recursive: true, force: true });
}
