using System.Diagnostics;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;
using LabMotion.WinUI;
using Microsoft.UI.Composition;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Hosting;
using Windows.UI.ViewManagement;

namespace LabUI.Buttons;

// Temporary native counterexample. It runs only in the existing hosted diagnostic.
internal sealed class SpaceBoundaryPage : Page
{
    private const int SampleLimit = 128;
    private const float EndpointTolerance = .001f;
    private static readonly TimeSpan Deadline = TimeSpan.FromSeconds(5);
    private static readonly Spring Smooth = new(350, 0);
    private readonly List<object> results = [];
    private SpriteVisual? witnessVisual;
    internal Window? HostWindow { get; set; }

    internal SpaceBoundaryPage()
    {
        if (Environment.GetEnvironmentVariable("GITHUB_ACTIONS") != "true" ||
            Environment.GetEnvironmentVariable("RUNNER_ENVIRONMENT") != "github-hosted")
            throw new InvalidOperationException("Boundary diagnosis requires the hosted runner.");
        Content = new TextBlock { Text = "LabUI · native spring boundaries", Margin = new Thickness(24) };
        Loaded += Run;
    }

    private async void Run(object sender, RoutedEventArgs args)
    {
        Loaded -= Run;
        string? failure = null;
        var passed = false;
        var visible = false;
        var handle = "0";
        try
        {
            await Task.Yield();
            visible = HostWindow!.AppWindow.IsVisible;
            handle = WinRT.Interop.WindowNative.GetWindowHandle(HostWindow).ToInt64().ToString(CultureInfo.InvariantCulture);
            if (!visible || handle == "0" || !new UISettings().AnimationsEnabled)
                throw new InvalidOperationException("The native window or animation setting is unavailable.");
            var compositor = ElementCompositionPreview.GetElementVisual(this).Compositor;
            witnessVisual = compositor.CreateSpriteVisual();
            witnessVisual.Size = new System.Numerics.Vector2(24, 24);
            witnessVisual.Offset = new System.Numerics.Vector3(64, 96, 0);
            using var brush = compositor.CreateColorBrush(Windows.UI.Color.FromArgb(255, 64, 128, 255));
            witnessVisual.Brush = brush;
            ElementCompositionPreview.SetElementChildVisual(this, witnessVisual);
            // x(t) = v0*t*exp(-omega*t): the boundary cases approach their target from outside.
            var lower = await Capture("lower", 0, -1f);
            var interior = await Capture("interior", .5f, -1f);
            var upper = await Capture("upper", 1, 1f);
            passed = lower && interior && upper;
        }
        catch (Exception error) { failure = error.GetType().Name; }
        finally
        {
            ElementCompositionPreview.SetElementChildVisual(this, null);
            witnessVisual?.Dispose();
            var output = Environment.GetEnvironmentVariable("LABUI_SPACE_BOUNDARY_OUTPUT")
                ?? throw new InvalidOperationException("Boundary output is required.");
            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase, IncludeFields = true,
                Converters = { new JsonStringEnumConverter() }
            };
            var bytes = JsonSerializer.SerializeToUtf8Bytes(new
            {
                schemaVersion = 1, source = Environment.GetEnvironmentVariable("LABUI_SPACE_BOUNDARY_SOURCE"),
                pid = Environment.ProcessId, visible, handle, passed, failure,
                expected = new { minimum = 0, maximum = 1, endpointTolerance = EndpointTolerance,
                    sampleLimit = SampleLimit, deadlineMs = Deadline.TotalMilliseconds,
                    end = "Finished", reason = "settled", idle = "matching native request",
                    inertiaMayLeaveRange = true },
                results
            }, options);
            if (bytes.Length > 256 * 1024) throw new InvalidOperationException("Boundary evidence exceeded its limit.");
            using (var stream = new FileStream(output + ".tmp", FileMode.CreateNew, FileAccess.Write)) stream.Write(bytes);
            File.Move(output + ".tmp", output);
            Environment.ExitCode = passed ? 0 : 1;
            Application.Current.Exit();
        }
    }

    private async Task<bool> Capture(string name, float target, float velocity)
    {
        var compositor = ElementCompositionPreview.GetElementVisual(this).Compositor;
        using var motion = ScalarMotion.CreateProgress(compositor, target);
        using var binding = motion.Bind(witnessVisual!, ScalarProperty.OffsetX, 64, 64);
        var initial = new TaskCompletionSource<MotionObservation>(TaskCreationOptions.RunContinuationsAsynchronously);
        var overflow = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var trace = new List<MotionObservation>();
        MotionObservation? firstDiscarded = null;
        MotionResult? outcome = null;
        long armedTicks = 0;
        string? failure = null;
        MotionObservation? initialObservation = null;
        motion.Observed += value =>
        {
            if (armedTicks == 0)
            {
                if (value.Origin == MotionOrigin.Initial && value.Phase is "value" or "idle") initial.TrySetResult(value);
                return;
            }
            if (trace.Count == SampleLimit)
            {
                firstDiscarded ??= value;
                overflow.TrySetResult(true);
            }
            else trace.Add(value);
        };
        try
        {
            initialObservation = await initial.Task.WaitAsync(Deadline);
            if (initialObservation.Value.Position != target || motion.Position != target)
                throw new InvalidOperationException("Native initial position was not admitted.");
            armedTicks = Stopwatch.GetTimestamp();
            var operation = motion.AnimateTo(target, Smooth, velocity);
            var completed = await Task.WhenAny(operation, overflow.Task).WaitAsync(Deadline);
            if (completed == overflow.Task) failure = "overflow";
            else outcome = await operation;
        }
        catch (TimeoutException) { failure = "timeout"; }
        catch (Exception error) { failure = error.GetType().Name; }
        var position = motion.Position;
        var incomingIdle = SpaceProbe.CaptureIncomingIdle(motion, armedTicks);
        var last = trace.LastOrDefault();
        var passed = failure is null && outcome is { End: MotionEnd.Finished, Reason: "settled" } end &&
            last.Phase == "idle" && last.Operation == end.Operation &&
            float.IsFinite(position) && Math.Abs(position - target) <= EndpointTolerance &&
            incomingIdle is { Status: "available", CompleteSinceArm: true } &&
            incomingIdle.NativeSnapshot!.Receipts.Any(receipt => receipt.TimestampTicks >= armedTicks &&
                receipt.CallbackRequestId == last.NativeRequestId && receipt.Operation == last.Operation &&
                receipt.Disposition == "accepted");
        results.Add(new { name, initial = target, target, velocity, spring = Smooth, initialObservation,
            armedTicks, outcome, position, passed, failure,
            outsideRangeObserved = trace.Any(value => value.Position < 0 || value.Position > 1),
            incomingIdle, trace, firstDiscarded });
        return passed;
    }
}
