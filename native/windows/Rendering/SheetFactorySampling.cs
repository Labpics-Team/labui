namespace LabUI.WinUI.Rendering;

internal enum SheetFactoryStage { Build, Factory }

internal readonly record struct SheetFactoryOutcome(SheetFactoryStage Stage, int HResult, int? CleanupHResult);

// Временный System-only участок sampler; удаляется вместе с диагностикой после RCA.
internal static class SheetFactorySampling
{
    internal static T PreservePrimary<T>(Func<T> create, Action<Exception> diagnose)
    {
        try { return create(); }
        catch (Exception primary)
        {
            try { diagnose(primary); }
            catch { }
            throw;
        }
    }

    internal static SheetFactoryOutcome Capture<T>(Func<Func<IDisposable, int>, T> build,
        Func<T, IDisposable> create)
    {
        List<IDisposable> owned = [];
        IDisposable? factory = null;
        var stage = SheetFactoryStage.Build;
        var hresult = 0;
        int? cleanupHresult = null;
        int Register(IDisposable resource)
        {
            ArgumentNullException.ThrowIfNull(resource);
            owned.Add(resource);
            return owned.Count;
        }
        try
        {
            var input = build(Register);
            stage = SheetFactoryStage.Factory;
            factory = create(input) ?? throw new InvalidOperationException("Factory не вернула ресурс.");
        }
        catch (Exception error) { hresult = error.HResult; }
        finally
        {
            void Dispose(IDisposable resource)
            {
                try { resource.Dispose(); }
                catch (Exception error) { cleanupHresult ??= error.HResult; }
            }
            if (factory is not null) Dispose(factory);
            for (var index = owned.Count - 1; index >= 0; index--) Dispose(owned[index]);
        }
        return new(stage, hresult, cleanupHresult);
    }
}
