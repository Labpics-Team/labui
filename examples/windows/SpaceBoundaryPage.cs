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
            var retarget = Environment.GetEnvironmentVariable("LABUI_SPACE_BOUNDARY_RETARGET") ?? "none";
            var late = Environment.GetEnvironmentVariable("LABUI_SPACE_BOUNDARY_LATE") == "true";
            var setter = Environment.GetEnvironmentVariable("LABUI_SPACE_BOUNDARY_SETTER") == "true";
            if (retarget is not ("none" or "interior" or "opposite" or "same"))
                throw new InvalidOperationException("Unknown retarget scenario.");
            var lower = await Capture("lower", 0, -1f,
                retarget switch { "interior" => .5f, "opposite" => 1, "same" => 0, _ => null }, late, setter);
            var interior = await Capture("interior", .5f, -1f,
                retarget switch { "interior" => .75f, "opposite" => .25f, "same" => .5f, _ => null }, late, setter);
            var upper = await Capture("upper", 1, 1f,
                retarget switch { "interior" => .5f, "opposite" => 0, "same" => 1, _ => null }, late, setter);
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
                    coordinates = "consumer progress q; native vectors retain executor units",
                    sampleLimit = SampleLimit, deadlineMs = Deadline.TotalMilliseconds,
                    animationEnd = "Finished/settled", setTargetEnd = "Stopped/target-changed", idle = "matching native request",
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

    private async Task<bool> Capture(string name, float target, float velocity, float? retargetTo, bool late, bool setter)
    {
        var compositor = ElementCompositionPreview.GetElementVisual(this).Compositor;
        var coordinates = Environment.GetEnvironmentVariable("LABUI_SPACE_BOUNDARY_COORDINATES") ?? "progress";
        var unitsPerProgress = coordinates == "progress" ? 1 : 320f;
        using var motion = coordinates switch
        {
            "progress" => ScalarMotion.CreateProgress(compositor, target),
            "raw-x" => new ScalarMotion(compositor, ScalarAxis.X, 0, unitsPerProgress, target * unitsPerProgress,
                endpointAccuracy: EndpointTolerance * unitsPerProgress),
            "raw-y" => new ScalarMotion(compositor, ScalarAxis.Y, 0, unitsPerProgress, target * unitsPerProgress,
                endpointAccuracy: EndpointTolerance * unitsPerProgress),
            _ => throw new InvalidOperationException("Unknown coordinate owner.")
        };
        using var binding = motion.Bind(witnessVisual!, ScalarProperty.OffsetX, 64 / unitsPerProgress, 64);
        var initial = new TaskCompletionSource<MotionObservation>(TaskCreationOptions.RunContinuationsAsynchronously);
        var overflow = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var departed = new TaskCompletionSource<MotionObservation>(TaskCreationOptions.RunContinuationsAsynchronously);
        var returned = new TaskCompletionSource<MotionObservation>(TaskCreationOptions.RunContinuationsAsynchronously);
        var setterTrigger = new TaskCompletionSource<bool>(TaskCreationOptions.RunContinuationsAsynchronously);
        var setterIdle = new TaskCompletionSource<MotionObservation>(TaskCreationOptions.RunContinuationsAsynchronously);
        var inertias = 0;
        var setterApplied = false;
        var trace = new List<MotionObservation>();
        MotionObservation? firstDiscarded = null;
        MotionResult? outcome = null;
        MotionResult? replacedOutcome = null;
        MotionObservation? departureObservation = null;
        float? retargetReadback = null;
        long armedTicks = 0;
        string? failure = null;
        MotionObservation? initialObservation = null;
        motion.Observed += original =>
        {
            // Compare the consumer's q coordinate; native vectors preserve original units.
            var value = original with { Position = original.Position / unitsPerProgress,
                ReadbackPosition = original.ReadbackPosition / unitsPerProgress,
                NativeVelocity = original.NativeVelocity / unitsPerProgress };
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
            if (value.Phase == "value" && Math.Abs(value.Position - target) > .005f) departed.TrySetResult(value);
            if (departed.Task.IsCompleted && value.Phase == "value" &&
                Math.Abs(value.Position - target) < EndpointTolerance / 4)
                returned.TrySetResult(value);
            if (setter && value.Phase == "inertia" && ++inertias == (target is 0 or 1 ? 2 : 1))
            {
                departureObservation = value;
                retargetReadback = motion.Position / unitsPerProgress;
                if (target is 0 or 1 && !(retargetReadback < 0 || retargetReadback > 1))
                    failure = "Native correction was not outside before SetTarget.";
                else
                {
                    try { motion.SetTarget(retargetTo!.Value * unitsPerProgress, Smooth); setterApplied = true; }
                    catch (Exception error) { failure = error.GetType().Name; }
                }
                setterTrigger.TrySetResult(true);
            }
            if (setterApplied && value.Phase == "idle") setterIdle.TrySetResult(value);
        };
        try
        {
            initialObservation = await initial.Task.WaitAsync(Deadline);
            if (initialObservation.Value.Position != target || motion.Position / unitsPerProgress != target)
                throw new InvalidOperationException("Native initial position was not admitted.");
            armedTicks = Stopwatch.GetTimestamp();
            var operation = motion.AnimateTo(target * unitsPerProgress, Smooth, velocity * unitsPerProgress);
            if (setter)
            {
                await setterTrigger.Task.WaitAsync(Deadline);
                if (failure is not null) throw new InvalidOperationException(failure);
                outcome = await operation;
                if (outcome is not { End: MotionEnd.Stopped, Reason: "target-changed" })
                    throw new InvalidOperationException("SetTarget did not stop the previous logical operation.");
            }
            else if (retargetTo is { } nextTarget)
            {
                var trigger = late ? returned.Task : departed.Task;
                var departure = await Task.WhenAny(trigger, operation, overflow.Task).WaitAsync(Deadline);
                if (departure != trigger) throw new InvalidOperationException("Native departure was not observed before retarget.");
                departureObservation = await trigger;
                retargetReadback = motion.Position / unitsPerProgress;
                if ((!late && Math.Abs(retargetReadback.Value - target) <= .005f) ||
                    (late && Math.Abs(retargetReadback.Value - target) >= EndpointTolerance / 4) ||
                    Math.Sign(retargetReadback.Value - target) != Math.Sign(velocity))
                    throw new InvalidOperationException("Native departure was not present at retarget.");
                var previous = operation;
                operation = motion.AnimateTo(nextTarget * unitsPerProgress, Smooth);
                replacedOutcome = await previous;
                if (replacedOutcome is not { End: MotionEnd.Stopped, Reason: "replaced" })
                    throw new InvalidOperationException("Retarget did not replace the previous operation.");
            }
            var remaining = Deadline - Stopwatch.GetElapsedTime(armedTicks);
            if (remaining <= TimeSpan.Zero) throw new TimeoutException();
            var terminal = setter ? (Task)setterIdle.Task : operation;
            var completed = await Task.WhenAny(terminal, overflow.Task).WaitAsync(remaining);
            if (completed == overflow.Task) failure = "overflow";
            else if (!setter) outcome = await operation;
        }
        catch (TimeoutException) { failure = "timeout"; }
        catch (Exception error) { failure = error.GetType().Name; }
        var position = motion.Position / unitsPerProgress;
        var incomingIdle = SpaceProbe.CaptureIncomingIdle(motion, armedTicks);
        var last = trace.LastOrDefault();
        var terminalValid = setter ? outcome is { End: MotionEnd.Stopped, Reason: "target-changed" }
            : outcome is { End: MotionEnd.Finished, Reason: "settled" };
        var passed = failure is null && terminalValid &&
            last.Phase == "idle" && last.Operation == outcome!.Value.Operation &&
            float.IsFinite(position) && Math.Abs(position - (retargetTo ?? target)) <= EndpointTolerance &&
            incomingIdle is { Status: "available", CompleteSinceArm: true } &&
            incomingIdle.NativeSnapshot!.Receipts.Any(receipt => receipt.TimestampTicks >= armedTicks &&
                receipt.CallbackRequestId == last.NativeRequestId && receipt.Operation == last.Operation &&
                receipt.Disposition == "accepted");
        results.Add(new { name, coordinates, unitsPerProgress, initial = target, target = retargetTo ?? target, velocity, spring = Smooth, initialObservation,
            late, setter, setterApplied, departureObservation, retargetReadback, replacedOutcome,
            armedTicks, outcome, position, passed, failure,
            outsideRangeObserved = trace.Any(value => value.Position < 0 || value.Position > 1),
            incomingIdle, trace, firstDiscarded });
        return passed;
    }
}
