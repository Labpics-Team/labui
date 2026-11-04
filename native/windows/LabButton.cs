using LabMotion.WinUI;
using LabUI.WinUI.Rendering;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Controls.Primitives;
using Microsoft.UI.Xaml.Input;
using Windows.UI.Text;
using Windows.UI.ViewManagement;

namespace LabUI.WinUI;

/// <summary>Нативная accent/fill кнопка LabUI. Content — строка; поведение принадлежит Button.</summary>
public sealed class LabButton : Button
{
    public static readonly DependencyProperty SizeProperty = DependencyProperty.Register(
        nameof(Size), typeof(LabButtonSize), typeof(LabButton),
        new PropertyMetadata(LabButtonSize.Medium, AppearanceChanged));
    public static readonly DependencyProperty DescriptionProperty = DependencyProperty.Register(
        nameof(Description), typeof(string), typeof(LabButton), new PropertyMetadata(string.Empty, AppearanceChanged));
    public static readonly DependencyProperty LeadingIconProperty = DependencyProperty.Register(
        nameof(LeadingIcon), typeof(IconSource), typeof(LabButton), new PropertyMetadata(null, AppearanceChanged));
    public static readonly DependencyProperty TrailingIconProperty = DependencyProperty.Register(
        nameof(TrailingIcon), typeof(IconSource), typeof(LabButton), new PropertyMetadata(null, AppearanceChanged));

    public LabButtonSize Size { get => (LabButtonSize)GetValue(SizeProperty); set => SetValue(SizeProperty, value); }
    public string Description { get => (string)GetValue(DescriptionProperty); set => SetValue(DescriptionProperty, value); }
    public IconSource? LeadingIcon { get => (IconSource?)GetValue(LeadingIconProperty); set => SetValue(LeadingIconProperty, value); }
    public IconSource? TrailingIcon { get => (IconSource?)GetValue(TrailingIconProperty); set => SetValue(TrailingIconProperty, value); }

    /// <summary>Отказ исполнителя движения. Без обработчика ошибка передаётся приложению.</summary>
    public event EventHandler<Exception>? MotionFailed;

    private Grid? root;
    private ButtonLayers? layers;
    private StackPanel? content;
    private StackPanel? labelGroup;
    private TextBlock? label;
    private TextBlock? description;
    private Viewbox? leading;
    private Viewbox? trailing;
    private Border? focus;
    private ScalarMotion? hoverMotion;
    private ScalarMotion? pressedMotion;
    private float? hoverTarget;
    private float? pressedTarget;
    private IDisposable? hoverBinding;
    private IDisposable? pressedBinding;
    private UISettings? settings;
    private readonly List<(DependencyProperty Property, long Token)> callbacks = [];
    private bool attached;
    private bool hovered;
    private bool animationsEnabled;
    private long generation;

    public LabButton()
    {
        DefaultStyleKey = typeof(LabButton);
        Loaded += LoadedControl;
        Unloaded += UnloadedControl;
    }

    protected override void OnApplyTemplate()
    {
        DetachParts();
        base.OnApplyTemplate();
        root = Part<Grid>("PART_Root");
        layers = Part<ButtonLayers>("PART_Layers");
        content = Part<StackPanel>("PART_Content");
        labelGroup = Part<StackPanel>("PART_LabelGroup");
        label = Part<TextBlock>("PART_Label");
        description = Part<TextBlock>("PART_Description");
        leading = Part<Viewbox>("PART_Leading");
        trailing = Part<Viewbox>("PART_Trailing");
        focus = Part<Border>("PART_Focus");
        ApplyMetrics();
        if (IsLoaded) AttachParts();
    }

    private T Part<T>(string name) where T : DependencyObject => GetTemplateChild(name) as T
        ?? throw new InvalidOperationException($"Шаблон LabButton требует {name} ({typeof(T).Name}).");

    private void LoadedControl(object sender, RoutedEventArgs args)
    {
        ApplyTemplate();
        AttachParts();
    }

    private void UnloadedControl(object sender, RoutedEventArgs args) => DetachParts();

    private void AttachParts()
    {
        if (attached || layers is null) return;
        ValidateContent();
        attached = true;
        generation++;
        settings = new UISettings();
        animationsEnabled = settings.AnimationsEnabled;
        settings.AnimationsEnabledChanged += AnimationsChanged;
        PointerEntered += Entered;
        PointerExited += Exited;
        GotFocus += FocusChanged;
        LostFocus += FocusChanged;
        callbacks.Add((IsPressedProperty, RegisterPropertyChangedCallback(IsPressedProperty, StateChanged)));
        callbacks.Add((IsEnabledProperty, RegisterPropertyChangedCallback(IsEnabledProperty, StateChanged)));
        callbacks.Add((ContentProperty, RegisterPropertyChangedCallback(ContentProperty, (_, _) => ValidateContent())));
        layers.VisualsChanging += ReleaseMotion;
        layers.VisualsChanged += BindMotion;
        layers.Attach(Geometry.Button(Size));
        UpdateState(false);
    }

    private void DetachParts()
    {
        if (!attached) return;
        attached = false;
        generation++;
        PointerEntered -= Entered;
        PointerExited -= Exited;
        GotFocus -= FocusChanged;
        LostFocus -= FocusChanged;
        foreach (var (property, token) in callbacks) UnregisterPropertyChangedCallback(property, token);
        callbacks.Clear();
        if (settings is not null) settings.AnimationsEnabledChanged -= AnimationsChanged;
        settings = null;
        ReleaseMotion(this, EventArgs.Empty);
        if (layers is not null)
        {
            layers.VisualsChanging -= ReleaseMotion;
            layers.VisualsChanged -= BindMotion;
            layers.Detach();
        }
        hovered = false;
    }

    private void BindMotion(object? sender, EventArgs args)
    {
        if (!attached || layers is null) return;
        hoverMotion = ScalarMotion.CreateProgress(layers.HoverVisual.Compositor);
        pressedMotion = ScalarMotion.CreateProgress(layers.PressedVisual.Compositor);
        hoverBinding = hoverMotion.Bind(layers.HoverVisual, ScalarProperty.Opacity);
        pressedBinding = pressedMotion.Bind(layers.PressedVisual, ScalarProperty.Opacity);
        UpdateState(false);
    }

    private void ReleaseMotion(object? sender, EventArgs args)
    {
        hoverBinding?.Dispose();
        pressedBinding?.Dispose();
        hoverMotion?.Dispose();
        pressedMotion?.Dispose();
        hoverBinding = null;
        pressedBinding = null;
        hoverMotion = null;
        pressedMotion = null;
        hoverTarget = null;
        pressedTarget = null;
    }

    private static void AppearanceChanged(DependencyObject sender, DependencyPropertyChangedEventArgs args)
        => ((LabButton)sender).ApplyMetrics();

    private void ApplyMetrics()
    {
        var value = Geometry.Button(Size);
        MinHeight = value.MinHeight;
        if (layers is null || content is null || labelGroup is null || label is null
            || description is null || leading is null || trailing is null || focus is null) return;
        content.Margin = new Thickness(value.InsetX, value.InsetY, value.InsetX, value.InsetY);
        labelGroup.Margin = new Thickness(Geometry.LabelInset, 0, Geometry.LabelInset, 0);
        var hasDescription = !string.IsNullOrEmpty(Description);
        var lineHeight = Math.Max(value.LineHeight, hasDescription ? value.DescriptionLineHeight : 0);
        // Авторская строка задаёт минимум слота; высоту увеличенного текста измеряет WinUI.
        labelGroup.MinHeight = Math.Max(value.ContentSize, lineHeight);
        labelGroup.Spacing = Geometry.LabelGap;
        label.FontSize = value.FontSize;
        label.FontWeight = new FontWeight { Weight = Geometry.FontWeightMedium };
        label.LineHeight = 0;
        label.LineStackingStrategy = LineStackingStrategy.MaxHeight;
        // DTCG хранит em; WinUI принимает целое число тысячных em.
        label.CharacterSpacing = (int)Math.Round(value.Tracking * 1000);
        description.FontSize = value.DescriptionFontSize;
        description.FontWeight = new FontWeight { Weight = value.DescriptionWeight };
        description.LineHeight = 0;
        description.LineStackingStrategy = LineStackingStrategy.MaxHeight;
        description.CharacterSpacing = (int)Math.Round(value.DescriptionTracking * 1000);
        description.Visibility = hasDescription ? Visibility.Visible : Visibility.Collapsed;
        leading.Width = trailing.Width = value.ContentSize;
        leading.Height = trailing.Height = value.ContentSize;
        leading.Visibility = LeadingIcon is null ? Visibility.Collapsed : Visibility.Visible;
        trailing.Visibility = TrailingIcon is null ? Visibility.Collapsed : Visibility.Visible;
        focus.BorderThickness = new Thickness(Geometry.FocusWidth);
        focus.Margin = new Thickness(-Geometry.FocusOffset - Geometry.FocusWidth);
        focus.CornerRadius = new CornerRadius(value.Radius + Geometry.FocusOffset + Geometry.FocusWidth);
        layers.SetMetrics(value);
    }

    private void ValidateContent()
    {
        if (Content is not null and not string)
            throw new ArgumentException("Content LabButton должен быть строкой; графика задаётся через LeadingIcon/TrailingIcon.");
    }

    private void Entered(object sender, PointerRoutedEventArgs args)
    {
        hovered = true;
        UpdateState(true);
    }

    private void Exited(object sender, PointerRoutedEventArgs args)
    {
        hovered = false;
        UpdateState(true);
    }

    private void StateChanged(DependencyObject sender, DependencyProperty property) => UpdateState(true);
    private void FocusChanged(object sender, RoutedEventArgs args) => UpdateState(true);

    private void AnimationsChanged(UISettings sender, object args)
    {
        var current = generation;
        DispatcherQueue.TryEnqueue(() =>
        {
            if (!attached || current != generation || settings is null) return;
            animationsEnabled = settings.AnimationsEnabled;
            UpdateState(false);
        });
    }

    private void UpdateState(bool animate)
    {
        if (!attached) return;
        if (root is not null) root.Opacity = IsEnabled ? 1 : Geometry.DisabledOpacity;
        if (focus is not null) focus.Visibility = IsEnabled && FocusState == FocusState.Keyboard
            ? Visibility.Visible : Visibility.Collapsed;
        Retarget(hoverMotion, IsEnabled && hovered ? 1 : 0, animate && animationsEnabled, ref hoverTarget);
        Retarget(pressedMotion, IsEnabled && IsPressed ? 1 : 0, animate && animationsEnabled, ref pressedTarget);
    }

    private void Retarget(ScalarMotion? motion, float target, bool animate, ref float? previousTarget)
    {
        if (motion is null) return;
        // Focus и соседний канал не перезапускают уже принятое намерение.
        // Snap нужен и при той же цели: reduced motion завершает текущий переход.
        if (animate && previousTarget == target) return;
        previousTarget = target;
        RunMotion(motion, target, animate);
    }

    private async void RunMotion(ScalarMotion motion, float target, bool animate)
    {
        var current = generation;
        try
        {
            if (animate) await motion.AnimateTo(target,
                new Spring((float)Geometry.SmoothResponse, (float)Geometry.SmoothBounce));
            else motion.SnapTo(target);
        }
        catch (Exception error)
        {
            if (!attached || current != generation
                || !ReferenceEquals(motion, hoverMotion) && !ReferenceEquals(motion, pressedMotion)) return;
            if (MotionFailed is { } handler) handler(this, error);
            else throw new InvalidOperationException("LabMotion не выполнил переход состояния LabButton.", error);
        }
    }
}
