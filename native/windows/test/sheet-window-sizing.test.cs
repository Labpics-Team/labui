using LabUI.Buttons;
using Microsoft.UI.Windowing;
using Windows.Graphics;

void Check(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

Exception? Launch(AppWindow window)
{
    Fixture.Window = window;
    Fixture.ActivationBoundaryCalls = 0;
    try { new App().LaunchForTest(); }
    catch (Exception error) { return error; }
    return null;
}

void SizeSheet(AppWindow window)
{
    Check(ReferenceEquals(Launch(window), Fixture.StopAfterSizing),
        "Actual App sizing не дошёл до инертной границы либо скрыл resize failure.");
    Check(Fixture.ActivationBoundaryCalls == 1, "Размер не был установлен перед Activate.");
}

Check(Environment.GetCommandLineArgs().Contains("--sheet", StringComparer.Ordinal),
    "Передайте --sheet обычным аргументом managed test, без environment fixtures.");

// Квалификация модели: максимум кадра = screen768 + trackingFrame20 = 788.
// Собственный non-client delta39 даёт client749. Это модель, не OS probe.
var baseline = new AppWindow(screenHeight: 768, nonClientHeight: 39);
baseline.ResizeClient(new SizeInt32(375, 812));
Check(baseline.Size.Height == 788 && baseline.ClientSize.Height == 749 &&
    baseline.ClientSize.Width == 375, "Модель не воспроизвела исходный clamp.");

foreach (var nonClientHeight in new[] { 39, 0, 57 })
{
    var window = new AppWindow(screenHeight: 768, nonClientHeight: nonClientHeight);
    SizeSheet(window);
    var maximum = (OverlappedPresenter)window.Presenter;
    Check(window.ClientSize == new SizeInt32(375, 812),
        $"App не восстановил requested client375×812: actual{window.ClientSize.Width}×{window.ClientSize.Height}.");
    Check(maximum.PreferredMaximumHeight == 812 + nonClientHeight,
        "Maximum height не рассчитана из собственного non-client delta.");
    Check(maximum.Writes == 1 && window.Requests.Count == 2 &&
        window.Requests.All(request => request == new SizeInt32(375, 812)),
        "Коррекция изменила width/height запроса либо повторила его без границы.");
    var firstResize = window.Operations.IndexOf("resize-client");
    var clientReadback = window.Operations.IndexOf("read-client", firstResize + 1);
    var maximumWrite = window.Operations.IndexOf("write-maximum");
    var correction = window.Operations.IndexOf("resize-client", firstResize + 1);
    Check(firstResize < clientReadback && clientReadback < maximumWrite && maximumWrite < correction,
        "Maximum изменена до подтверждённого clamp либо после корректирующего resize.");
}

var largeDisplay = new AppWindow(screenHeight: 1440, nonClientHeight: 39);
SizeSheet(largeDisplay);
Check(largeDisplay.ClientSize == new SizeInt32(375, 812) && largeDisplay.Requests.Count == 1 &&
    ((OverlappedPresenter)largeDisplay.Presenter).PreferredMaximumHeight is null &&
    ((OverlappedPresenter)largeDisplay.Presenter).Writes == 0,
    "App снизил native default на большом desktop без подтверждённого clamp.");

var explicitLarger = new AppWindow(screenHeight: 768, nonClientHeight: 39, preferredMaximum: 1200);
SizeSheet(explicitLarger);
Check(explicitLarger.ClientSize == new SizeInt32(375, 812) && explicitLarger.Requests.Count == 1 &&
    ((OverlappedPresenter)explicitLarger.Presenter).PreferredMaximumHeight == 1200 &&
    ((OverlappedPresenter)explicitLarger.Presenter).Writes == 0,
    "App снизил более высокий explicit maximum.");

var explicitLower = new AppWindow(screenHeight: 768, nonClientHeight: 39, preferredMaximum: 500);
SizeSheet(explicitLower);
Check(explicitLower.ClientSize == new SizeInt32(375, 812) &&
    ((OverlappedPresenter)explicitLower.Presenter).PreferredMaximumHeight == 851,
    "Более низкий explicit maximum не поднят до requested frame height.");

foreach (var failedCall in new[] { 1, 2 })
{
    var primary = new ArgumentException("inert resize failure");
    var failureWindow = new AppWindow(screenHeight: 768, nonClientHeight: 39)
    { ResizeFailure = primary, ResizeFailureAt = failedCall };
    Check(ReferenceEquals(Launch(failureWindow), primary) && Fixture.ActivationBoundaryCalls == 0,
        "Первичная ошибка ResizeClient скрыта, заменена либо дошла до Activate.");
}

var otherPresenterWindow = new AppWindow(screenHeight: 768, nonClientHeight: 39,
    presenter: new OtherPresenter());
var otherPresenterFailure = Launch(otherPresenterWindow);
Check(otherPresenterFailure is InvalidOperationException &&
    !ReferenceEquals(otherPresenterFailure, Fixture.StopAfterSizing) &&
    Fixture.ActivationBoundaryCalls == 0 && otherPresenterWindow.Requests.Count == 1,
    "Неизвестный presenter скрыл неподдерживаемую коррекцию либо выполнил слепой повтор.");

var setterPrimary = new ArgumentException("inert maximum failure");
var setterFailureWindow = new AppWindow(screenHeight: 768, nonClientHeight: 39);
((OverlappedPresenter)setterFailureWindow.Presenter).WriteFailure = setterPrimary;
Check(ReferenceEquals(Launch(setterFailureWindow), setterPrimary) && Fixture.ActivationBoundaryCalls == 0,
    "Первичная ошибка maximum setter скрыта либо выполнен безосновательный повтор.");

Console.WriteLine("Sheet window sizing: actual App source, clamp749→812, own delta, large/default/explicit limits, order and primary errors PASS; managed types only.");

static class Fixture
{
    internal static AppWindow? Window;
    internal static int ActivationBoundaryCalls;
    internal static readonly Exception StopAfterSizing = new InvalidOperationException("inert boundary after sizing");
}

namespace Windows.Graphics
{
    public readonly record struct SizeInt32(int Width, int Height);
}

namespace Microsoft.UI.Windowing
{
    public abstract class AppWindowPresenter { }
    internal sealed class OtherPresenter : AppWindowPresenter { }

    public sealed class OverlappedPresenter(int? maximum, List<string> operations) : AppWindowPresenter
    {
        private int? preferredMaximum = maximum;
        internal int? EffectiveMaximum => preferredMaximum;
        internal int Writes;
        internal Exception? WriteFailure;
        public int? PreferredMaximumHeight
        {
            get => preferredMaximum;
            set
            {
                operations.Add("write-maximum");
                if (WriteFailure is not null) throw WriteFailure;
                preferredMaximum = value;
                Writes++;
            }
        }
    }

    // Чистая managed модель ограничения полного кадра. Native assemblies не нужны.
    public sealed class AppWindow
    {
        private readonly int defaultMaximum;
        private readonly int nonClientHeight;
        private SizeInt32 frame = new(760, 680);
        private SizeInt32 client;
        internal List<string> Operations { get; } = [];
        internal List<SizeInt32> Requests { get; } = [];
        internal Exception? ResizeFailure;
        internal int ResizeFailureAt;
        public AppWindowPresenter Presenter { get; }
        public SizeInt32 Size
        {
            get { Operations.Add("read-frame"); return frame; }
        }
        public SizeInt32 ClientSize
        {
            get { Operations.Add("read-client"); return client; }
        }
        public AppWindow(int screenHeight, int nonClientHeight, int? preferredMaximum = null,
            AppWindowPresenter? presenter = null)
        {
            defaultMaximum = screenHeight + 20;
            this.nonClientHeight = nonClientHeight;
            client = new SizeInt32(frame.Width - 16, frame.Height - nonClientHeight);
            Presenter = presenter ?? new OverlappedPresenter(preferredMaximum, Operations);
        }
        public void ResizeClient(SizeInt32 request)
        {
            Operations.Add("resize-client");
            Requests.Add(request);
            if (ResizeFailure is not null && Requests.Count == ResizeFailureAt) throw ResizeFailure;
            var maximum = (Presenter as OverlappedPresenter)?.EffectiveMaximum ?? defaultMaximum;
            var frameHeight = Math.Min(request.Height + nonClientHeight, maximum);
            frame = new SizeInt32(request.Width + 16, frameHeight);
            client = new SizeInt32(request.Width, frameHeight - nonClientHeight);
        }
        public void Resize(SizeInt32 request) => throw new InvalidOperationException("inert Sheet used frame resize");
    }
}

namespace Microsoft.UI.Xaml
{
    public class LaunchActivatedEventArgs { }
    public class Application
    {
        protected virtual void OnLaunched(LaunchActivatedEventArgs args) { }
        public void LaunchForTest() => OnLaunched(new LaunchActivatedEventArgs());
    }
    public sealed class Window
    {
        public string Title { get; set; } = "";
        public object? Content { get; set; }
        public AppWindow AppWindow { get; } = Fixture.Window
            ?? throw new InvalidOperationException("inert window not supplied");
        public void Activate()
        {
            // Не исполнять активацию/animation observation: интересующий код до границы.
            Fixture.ActivationBoundaryCalls++;
            throw Fixture.StopAfterSizing;
        }
    }
}

namespace LabUI.Buttons
{
    public partial class App { private void InitializeComponent() { } }
    public sealed class ButtonsPage { }
    public sealed class SheetPage(bool dark, bool solid, bool content)
    {
        internal bool Dark { get; } = dark;
        internal bool Solid { get; } = solid;
        internal bool Content { get; } = content;
        internal Microsoft.UI.Xaml.Window? HostWindow { get; set; }
        internal object? WindowAfterResize { get; set; }
        internal object? WindowAfterActivation { get; set; }
        internal static object ReadWindowGeometry(Microsoft.UI.Xaml.Window window)
            => new { client = window.AppWindow.ClientSize, frame = window.AppWindow.Size };
    }
}

namespace Windows.UI.ViewManagement
{
    public sealed class UISettings
    {
        public bool AnimationsEnabled => throw new InvalidOperationException("inert test left sizing boundary");
    }
}
