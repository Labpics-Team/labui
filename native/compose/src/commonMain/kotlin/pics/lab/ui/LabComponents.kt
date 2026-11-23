// Generated from packages/tokens/src/components.json. Do not edit.
package pics.lab.ui

internal data class LabButtonMetrics(val height: Float, val radius: Float, val paddingX: Float, val paddingY: Float, val icon: Float, val fontSize: Float, val lineHeight: Float, val letterSpacing: Float, val descriptionFontWeight: Float, val descriptionLetterSpacing: Float, val descriptionAccentPlainOpacity: Float)
internal data class LabInputMetrics(val height: Float, val radius: Float, val paddingX: Float, val paddingY: Float, val contentHeight: Float, val fontSize: Float, val lineHeight: Float, val fontWeight: Float, val letterSpacing: Float)
internal data class LabSwitchMetrics(val trackWidth: Float, val trackHeight: Float, val controlHeight: Float, val labelGap: Float, val fontSize: Float, val lineHeight: Float, val letterSpacing: Float, val fontWeight: Float)
internal data class LabSelectionMetrics(val controlSize: Float, val controlHeight: Float, val labelGap: Float, val fontSize: Float, val lineHeight: Float, val fontWeight: Float, val letterSpacing: Float, val checkboxRadius: Float, val glyphSize: Float, val mixedHeight: Float, val mixedY: Float, val radioStroke: Float, val radioFocusStroke: Float, val tinyDot: Float)
internal data class LabKbdMetrics(val height: Float, val radius: Float, val paddingX: Float, val paddingY: Float, val fontSize: Float, val lineHeight: Float, val bottomStrokeWidth: Float)
internal data class LabLoaderMetrics(val diameter: Float)
internal data class LabProgressMetrics(val thickness: Float, val circularDiameter: Float, val circularStroke: Float)
internal data class LabChipMetrics(val height: Float, val radius: Float, val paddingX: Float, val paddingY: Float, val gap: Float, val fontSize: Float, val lineHeight: Float, val fontWeight: Float, val letterSpacing: Float, val leadingSize: Float, val closeSize: Float, val baseline: Float)
internal data class LabTabsMetrics(val height: Float, val radius: Float, val padding: Float, val gap: Float, val fontSize: Float, val lineHeight: Float, val fontWeight: Float, val letterSpacing: Float, val iconSize: Float, val iconOnlySize: Float, val baseline: Float)
internal data class LabBreadcrumbMetrics(val fontSize: Float, val lineHeight: Float, val multilineLineHeight: Float, val icon: Float, val gap: Float)
internal data class LabAccordionMetrics(val padding: Float, val radius: Float, val gap: Float, val contentGap: Float, val fontSize: Float, val lineHeight: Float, val iconSize: Float)
internal data class LabSelectMetrics(val height: Float, val radius: Float, val paddingStart: Float, val paddingEnd: Float, val paddingY: Float, val gap: Float, val leadingSize: Float, val fontSize: Float, val lineHeight: Float, val fontWeight: Float, val letterSpacing: Float)
internal data class LabAvatarMetrics(val diameter: Float, val fontSize: Float, val lineHeight: Float, val statusSize: Float, val statusGap: Float)
internal data class LabPinInputMetrics(val width: Float, val height: Float, val radius: Float, val gap: Float, val dot: Float, val fontSize: Float, val lineHeight: Float, val fontWeight: Float, val letterSpacing: Float)
internal data class LabFileUploadMetrics(val height: Float, val radius: Float, val paddingX: Float, val paddingY: Float, val icon: Float, val fontSize: Float, val lineHeight: Float, val fontWeight: Float, val letterSpacing: Float)
internal data class LabCalendarMetrics(val width: Float, val maxWidth: Float, val padding: Float, val areaTop: Float, val navSize: Float, val navRadius: Float, val cellRadius: Float, val dotsBottom: Float)

public enum class LabBadgeColor(internal val role: String) { Neutral("neutral"), Gray("gray"), Blue("blue"), Red("red"), Orange("orange"), Green("green"), Yellow("yellow"), Teal("teal"), Mint("mint"), Indigo("indigo"), Purple("purple"), Pink("pink"), StaticDark("static-dark"), StaticLight("static-light"), Brand("brand") }

public enum class LabAvatarColor(internal val role: String) { Red("avatar-fill-red"), Orange("avatar-fill-orange"), Yellow("avatar-fill-yellow"), Green("avatar-fill-green"), Teal("avatar-fill-teal"), Mint("avatar-fill-mint"), Blue("avatar-fill-blue"), Indigo("avatar-fill-indigo"), Purple("avatar-fill-purple"), Pink("avatar-fill-pink") }

public enum class LabAvatarStatus(internal val role: String?, internal val label: String) { None(null, ""), Online("label-info-primary", "В сети"), Offline("label-quaternary", "Не в сети"), Away("label-warning-primary", "Нет на месте"), Dnd("label-danger-primary", "Не беспокоить") }

public enum class LabTooltipType(internal val surfaceRole: String, internal val labelRole: String) { Neutral("bg-tertiary", "label-primary"), Inverted("bg-inverted", "label-inverted-primary"), Accent("fill-accent", "label-on-accent") }

internal object LabComponents {
    val ButtonS = LabButtonMetrics(36f, 9999f, 12f, 8f, 20f, 14f, 12f, 0f, 500f, 0f, 0.72f)
    val ButtonM = LabButtonMetrics(48f, 16f, 12f, 12f, 24f, 16f, 24f, 0f, 400f, -0.25f, 1f)
    val ButtonL = LabButtonMetrics(56f, 16f, 16f, 16f, 24f, 16f, 24f, 0f, 400f, -0.25f, 1f)
    const val ButtonFontWeight = 500f
    const val ButtonLabelPaddingX = 8f
    const val ButtonLabelGap = 8f
    const val ButtonDescriptionOpacity = 0.72f
    const val ButtonLoaderPeriodMs = 800f
    const val ButtonLoaderSize = 24f
    const val ButtonLoaderSegmentX = 11f
    const val ButtonLoaderSegmentY = 2f
    const val ButtonLoaderSegmentWidth = 2f
    const val ButtonLoaderSegmentHeight = 7f
    const val ButtonLoaderSegmentRadius = 1f
    const val ButtonLoaderCount = 8f
    const val ButtonFillHighlight = 0.2f
    const val ButtonFillHoverHighlight = 0.32f
    const val ButtonFillPressedShade = 0.12f
    const val ButtonInnerShadowX = 0f
    const val ButtonInnerShadowY = -1f
    const val ButtonInnerShadowBlur = 1f
    val InputS = LabInputMetrics(36f, 16f, 16f, 8f, 20f, 14f, 12f, 500f, 0f)
    val InputM = LabInputMetrics(48f, 12f, 16f, 12f, 24f, 16f, 24f, 400f, -0.25f)
    val InputL = LabInputMetrics(56f, 12f, 16f, 16f, 24f, 16f, 24f, 400f, -0.25f)
    const val InputLabelFontSize = 12f
    const val InputLabelLineHeight = 12f
    const val InputLabelFontWeight = 500f
    const val InputLabelPaddingX = 4f
    const val InputLabelOverhang = 8f
    const val InputHelperGap = 8f
    const val InputHelperPaddingX = 4f
    const val InputStrokeWidth = 1f
    const val InputAdornmentWidth = 32f
    const val InputAdornmentIconSize = 16f
    const val InputAdornmentPaddingOuter = 12f
    const val InputAdornmentPaddingInner = 4f
    const val TextareaHeight = 112f
    const val TextareaRows = 3f
    const val TextareaLabelFontSize = 14f
    const val TextareaLabelLineHeight = 12f
    const val TextareaPaddingTop = 16f
    const val TextareaPaddingBottom = 24f
    const val TextareaPaddingStart = 20f
    const val TextareaPaddingEnd = 16f
    const val CardRadius = 16f
    const val CardPadding = 24f
    const val CardGap = 16f
    const val CardCornerSmoothing = 0.6f
    const val CardStrokeWidth = 1f
    const val CardMediaHeight = 200f
    const val CardCaptionGap = 8f
    const val CardTextGap = 2f
    const val CardTitleGap = 4f
    const val CardTextTitleFontSize = 20f
    const val CardTextTitleLineHeight = 20f
    const val CardTextTitleFontWeight = 500f
    const val CardTextTitleLetterSpacing = -0.33f
    const val CardTextDescriptionFontSize = 16f
    const val CardTextDescriptionLineHeight = 24f
    const val CardTextDescriptionFontWeight = 400f
    const val CardTextDescriptionLetterSpacing = -0.25f
    const val CardTextCaptionFontSize = 14f
    const val CardTextCaptionLineHeight = 12f
    const val CardTextCaptionFontWeight = 500f
    const val CardTextCaptionLetterSpacing = 0f
    const val SheetTopRadius = 32f
    const val SheetPaddingX = 16f
    const val SheetPaddingBottom = 16f
    const val SheetContentGap = 24f
    const val SheetHeaderGap = 8f
    const val SheetTypographyTitleFontSize = 20f
    const val SheetTypographyTitleLineHeight = 20f
    const val SheetTypographyTitleFontWeight = 600f
    const val SheetTypographyTitleLetterSpacing = -0.33f
    const val SheetTypographyDescriptionFontSize = 16f
    const val SheetTypographyDescriptionLineHeight = 24f
    const val SheetTypographyDescriptionFontWeight = 400f
    const val SheetTypographyDescriptionLetterSpacing = -0.25f
    const val SheetBodyHeightsFull = 776f
    const val SheetBodyHeightsTwoThirds = 540f
    const val SheetBodyHeightsOneThird = 270f
    const val SheetDragAreaHeight = 24f
    const val SheetDragWidth = 36f
    const val SheetDragHeight = 4f
    const val SheetDragRadius = 4f
    const val SheetDragTop = 14f
    const val SheetDragCenterOffset = 0.5f
    const val SnackbarRadius = 9999f
    const val SnackbarPaddingStart = 12f
    const val SnackbarPaddingEnd = 8f
    const val SnackbarPaddingY = 8f
    const val SnackbarActionGap = 24f
    const val SnackbarLabelGap = 12f
    const val SnackbarFontSize = 16f
    const val SnackbarLineHeight = 24f
    const val SnackbarFontWeight = 500f
    const val SnackbarStrokeWidth = 1f
    val SnackbarMaterial get() = LabMaterials.elevated
    const val SnackbarDurationMs = 5000f
    const val SnackbarTimerSize = 32f
    const val SnackbarTimerStrokeWidth = 3f
    const val SnackbarTimerWarningSeconds = 2f
    val SnackbarTimerSweeps = listOf(360f, 270f, 225f, 135f, 75f)
    val SwitchS = LabSwitchMetrics(28f, 16f, 24f, 8f, 16f, 24f, -0.25f, 400f)
    val SwitchM = LabSwitchMetrics(36f, 20f, 24f, 8f, 16f, 24f, -0.25f, 400f)
    val SwitchL = LabSwitchMetrics(44f, 24f, 24f, 12f, 20f, 20f, -0.33f, 500f)
    const val SwitchThumbPadding = 2f
    const val SwitchThumbHoverPadding = 1f
    const val SwitchThumbPressedPadding = 4f
    const val SwitchThumbFillRole = "bg-static-light"
    const val SwitchThumbDisabledFillRole = "control-bg"
    val SwitchThumbShadow get() = LabShadows.xs
    val SwitchThumbHoverShadow get() = LabShadows.s
    val SwitchThumbDisabledShadow = emptyList<LabShadowLayer>()
    val SwitchThumbNeutralIconHoverShadow get() = LabShadows.xs
    val SwitchThumbColoredPressedShadow = listOf(
        LabShadowLayer(0f, 0f, 1f, 0f, "bg-static-dark", 0.12f),
        LabShadowLayer(0f, 1f, 1f, 0f, "bg-static-dark", 0.04f),
        LabShadowLayer(0f, 3f, 2f, 0f, "bg-static-dark", 0.02f),
        LabShadowLayer(0f, 6f, 2f, 0f, "bg-static-dark", 0.01f),
    )
    const val SwitchThumbColoredPressedShadowMinimumTrackHeight = 20f
    const val SwitchTrackNeutralRole = "fill-secondary"
    const val SwitchTrackNeutralHoverRole = "fill-primary"
    const val SwitchTrackAccentRole = "fill-accent"
    const val SwitchTrackDangerRole = "fill-danger"
    const val SwitchTrackDisabledRole = "fill-tertiary"
    const val SwitchLabelRole = "label-primary"
    const val SwitchColoredFillHighlight = 0.2f
    const val SwitchColoredFillHoverHighlight = 0.32f
    const val SwitchColoredFillPressedShade = 0.12f
    const val SwitchColoredFillGradientDirection = "top-to-bottom"
    const val SwitchColoredFillGradientTailOpacityDefault = 0f
    const val SwitchColoredFillGradientTailOpacityHover = 0.0001f
    const val SwitchColoredFillGradientTailOpacityPressed = 0.0001f
    const val SwitchInnerShadowX = 0f
    const val SwitchInnerShadowY = -1f
    const val SwitchInnerShadowPressedY = 1f
    const val SwitchInnerShadowBlur = 1f
    const val SwitchInnerShadowColorRole = "fx-control-inner"
    const val SwitchFocusWidth = 2f
    const val SwitchFocusOffset = 2f
    const val SwitchFocusNeutralRole = "label-primary"
    const val SwitchFocusAccentRole = "border-focus"
    const val SwitchFocusDangerRole = "label-danger"
    const val SwitchCutoutViewBox = 8f
    const val SwitchCutoutDiameterRatio = 0.5f
    const val SwitchCutoutOnWindingRule = "EVENODD"
    const val SwitchCutoutOnData = "M 7.635610517625218 0.09004448477756646 C 7.983656103329632 0.2757832909707034 8.10328593643757 0.6877623968927002 7.902811901013137 1.0102255870284567 L 3.799476721347746 7.610456581436975 C 3.4971543396331435 8.09674358769225 2.755387473545853 8.135316874720674 2.396231818043499 7.683424404152019 L 0.14168859926511418 4.84674109766281 C -0.09647133042804071 4.54708645671381 -0.027348674390513195 4.125292176841569 0.2960784184531714 3.9046376557352764 C 0.6195054679489442 3.6839828133348624 1.0747617100265714 3.7480247640656943 1.3129216397197263 4.047679405014694 L 3.0091021078268905 6.181826769133788 L 6.64242871067445 0.33760590255856143 C 6.842902746098884 0.015142692341922448 7.287565625487393 -0.09569428125380533 7.635610517625218 0.09004448477756646 Z"
    const val SwitchCutoutOffWindingRule = "NONZERO"
    const val SwitchCutoutOffData = "M 6.9128887406063635 0.1495871834623516 C 7.174744708699412 -0.06398525199944971 7.560755252477094 -0.048922332108651434 7.804838861833421 0.19516127724767568 C 8.048922471189748 0.4392448866040028 8.063985391080546 0.8252554502504135 7.8504129556187445 1.0871114183434614 L 7.804838861833421 1.1378939799899654 L 4.942785772115067 3.999946910758495 L 7.804838861833421 6.862000000476849 L 7.8504129556187445 6.912782562123353 C 8.063985391080546 7.174638530216401 8.048922471189748 7.560649073994084 7.804838861833421 7.804732683350411 C 7.560755252477094 8.04881629270674 7.174744708699412 8.063879212597536 6.9128887406063635 7.850306777135735 L 6.862106178959859 7.804732683350411 L 4.000053089241505 4.9426795936320564 L 1.1379998405733256 7.804732683350411 C 0.8776435839466081 8.065088939977128 0.45562345406393767 8.065088939977128 0.19526719743722018 7.804732683350411 C -0.06508905918949734 7.5443764267236935 -0.06508905918949734 7.122356257103567 0.19526719743722018 6.862000000476849 L 3.057320406367943 3.999946910758495 L 0.19526719743722018 1.1378939799899654 L 0.14969310365189606 1.0871114183434614 C -0.06387933180990524 0.8252554502504135 -0.04881641191910693 0.4392448866040028 0.19526719743722018 0.19516127724767568 C 0.4393508067935473 -0.048922332108651434 0.8253613108337736 -0.06398525199944971 1.0872172789268215 0.1495871834623516 L 1.1379998405733256 0.19516127724767568 L 4.000053089241505 3.0572142278849332 L 6.862106178959859 0.19516127724767568 L 6.9128887406063635 0.1495871834623516 Z"
    const val SwitchCutoutHideOnColoredPressed = true
    const val BadgeHeight = 20f
    const val BadgeRadius = 9999f
    const val BadgePaddingX = 8f
    const val BadgePaddingY = 4f
    const val BadgeGap = 4f
    const val BadgeIconSize = 12f
    const val BadgeFontSize = 12f
    const val BadgeLineHeight = 12f
    const val BadgeFontWeight = 500f
    const val BadgeLetterSpacing = 0f
    const val BadgeDisabledFillRole = "badge-base-disabled-fill"
    const val BadgeDisabledLabelRole = "badge-base-disabled-label"
    val BadgeDefaultColor = LabBadgeColor.Blue
    val SelectionTINY = LabSelectionMetrics(16f, 24f, 8f, 16f, 24f, 400f, -0.25f, 4f, 8f, 1.5f, 7f, 0f, 0f, 4f)
    val SelectionS = LabSelectionMetrics(12f, 24f, 8f, 16f, 24f, 400f, -0.25f, 4f, 6f, 1.5f, 5f, 3f, 3f, 0f)
    val SelectionM = LabSelectionMetrics(16f, 24f, 8f, 16f, 24f, 400f, -0.25f, 4f, 8f, 1.5f, 7f, 4f, 4f, 0f)
    val SelectionL = LabSelectionMetrics(20f, 20f, 12f, 20f, 20f, 500f, -0.33f, 6f, 10f, 2f, 9f, 6f, 5f, 0f)
    const val SelectionRolesLabel = "label-primary"
    const val SelectionRolesDisabledLabel = "label-quaternary"
    const val SelectionRolesUncheckedFill = "fill-secondary"
    const val SelectionRolesUncheckedHoverFill = "fill-primary"
    const val SelectionRolesUncheckedStroke = "border-base"
    const val SelectionRolesDisabledFill = "fill-tertiary"
    const val SelectionRolesAccent = "fill-accent"
    const val SelectionRolesNeutral = "bg-inverted"
    const val SelectionRolesDanger = "fill-danger"
    const val SelectionRolesGlyph = "label-static-light-primary"
    const val SelectionRolesDisabledGlyph = "control-bg"
    const val SelectionRolesFocusAccent = "fx-focus-ring-brand"
    const val SelectionRolesFocusNeutral = "fx-focus-ring-neutral"
    const val SelectionRolesFocusDanger = "fx-focus-ring-danger"
    const val SelectionRolesNeutralGlyph = "label-inverted-primary"
    const val SelectionFillHighlight = 0.2f
    const val SelectionFillHoverHighlight = 0.32f
    const val SelectionFocusWidth = 2f
    const val SelectionFocusOffset = 2f
    const val SelectionFocusTinyCheckboxOffset = 0f
    const val SelectionFocusTinyRadioOffset = -2f
    const val SelectionCheckboxInnerShadowX = 0f
    const val SelectionCheckboxInnerShadowY = -1f
    const val SelectionCheckboxInnerShadowBlur = 1f
    const val SelectionCheckboxInnerShadowColorRole = "fx-control-inner"
    const val SelectionCheckboxGlyphViewBox = 8f
    const val SelectionCheckboxGlyphWindingRule = "EVENODD"
    const val SelectionCheckboxGlyphData = "M 7.635610517625218 0.09004448477756646 C 7.983656103329632 0.2757832909707034 8.10328593643757 0.6877623968927002 7.902811901013137 1.0102255870284567 L 3.799476721347746 7.610456581436975 C 3.4971543396331435 8.09674358769225 2.755387473545853 8.135316874720674 2.396231818043499 7.683424404152019 L 0.14168859926511418 4.84674109766281 C -0.09647133042804071 4.54708645671381 -0.027348674390513195 4.125292176841569 0.2960784184531714 3.9046376557352764 C 0.6195054679489442 3.6839828133348624 1.0747617100265714 3.7480247640656943 1.3129216397197263 4.047679405014694 L 3.0091021078268905 6.181826769133788 L 6.64242871067445 0.33760590255856143 C 6.842902746098884 0.015142692341922448 7.287565625487393 -0.09569428125380533 7.635610517625218 0.09004448477756646 Z"
    const val SelectionCheckboxTinyDisabledNeutralGlyphRole = "label-static-dark-quaternary"
    const val SelectionChoiceboxPreferredWidth = 283.5f
    const val SelectionChoiceboxRadius = 12f
    const val SelectionChoiceboxPadding = 16f
    const val SelectionChoiceboxCardHeight = 104f
    const val SelectionChoiceboxRowHeight = 56f
    const val SelectionChoiceboxRowWrapWidth = 224f
    const val SelectionChoiceboxIconSize = 24f
    const val SelectionChoiceboxCardContentGap = 24f
    const val SelectionChoiceboxRowContentGap = 8f
    const val SelectionChoiceboxHeaderGap = 24f
    const val SelectionChoiceboxStrokeWidth = 1f
    const val SelectionChoiceboxSelectedStrokeWidth = 2f
    const val SelectionChoiceboxStrokeRole = "border-base"
    const val SelectionChoiceboxSelectedStrokeRole = "label-brand-primary"
    const val SelectionChoiceboxHoverFillRole = "fill-quaternary"
    const val SelectionChoiceboxIconRole = "label-brand-primary"
    const val SelectionChoiceboxDescriptionRole = "label-secondary"
    const val SelectionChoiceboxFontSize = 16f
    const val SelectionChoiceboxLineHeight = 24f
    const val SelectionChoiceboxFontWeight = 500f
    const val SelectionChoiceboxLetterSpacing = 0f
    val KbdS = LabKbdMetrics(16f, 4f, 2f, 2f, 12f, 12f, 1f)
    val KbdL = LabKbdMetrics(24f, 6f, 4f, 0f, 16f, 24f, 2f)
    const val KbdFontWeight = 500f
    const val KbdLetterSpacing = 0f
    const val KbdGap = 2f
    const val KbdStrokeWidth = 1f
    const val KbdLabelRole = "label-secondary"
    const val KbdBorderRole = "border-base"
    const val KbdBottomBorderRole = "border-soft"
    const val KbdFirstFillRole = "fill-tertiary"
    const val KbdRemainingFillRole = "fill-quaternary"
    const val KbdFillEndRole = "fill-none"
    val LoaderS = LabLoaderMetrics(16f)
    val LoaderM = LabLoaderMetrics(24f)
    val LoaderL = LabLoaderMetrics(48f)
    const val LoaderColorRole = "label-primary"
    const val LoaderViewBox = 24f
    const val LoaderPeriodMs = 800f
    const val LoaderSegmentX = 11f
    const val LoaderSegmentY = 2f
    const val LoaderSegmentWidth = 2f
    const val LoaderSegmentHeight = 7f
    const val LoaderSegmentRadius = 1f
    val LoaderSpokeOpacity = listOf(0.05f, 0.1f, 0.2f, 0.4f, 0.6f, 0.8f, 1f, 0.02f)
    const val LoaderDeterminateMediumRingRadius = 9f
    const val LoaderDeterminateMediumStroke = 2f
    const val LoaderDeterminateMediumSectorRadius = 6f
    const val LoaderDeterminateMediumSecondaryRole = "label-secondary"
    const val LoaderDeterminateMediumGradientFromDegrees = 0f
    const val LoaderDeterminateMediumGradientPrimaryStop = 0.75f
    const val LoaderDeterminateMediumGradientSecondaryStop = 1f
    const val LoaderDeterminateLargeRingRadius = 9f
    const val LoaderDeterminateLargeStroke = 2f
    const val LoaderDeterminateLargeTrackRole = "label-quaternary"
    const val LoaderDeterminateLargeCap = "round"
    val ProgressS = LabProgressMetrics(2f, 64f, 4f)
    val ProgressM = LabProgressMetrics(4f, 96f, 4f)
    val ProgressL = LabProgressMetrics(8f, 128f, 4f)
    const val ProgressActiveRole = "label-brand-primary"
    const val ProgressTrackRole = "label-brand-quaternary"
    const val ProgressRadius = 4f
    const val ProgressCircularCap = "round"
    const val ProgressCircularFontSize = 16f
    const val ProgressCircularLineHeight = 24f
    const val ProgressCircularFontWeight = 500f
    const val ProgressCircularLetterSpacing = 0f
    const val ProgressCircularLabelRole = "label-primary"
    const val ProgressUnknownPeriodMs = 1200f
    const val ProgressUnknownFraction = 0.25f
    val ChipS = LabChipMetrics(28f, 9999f, 8f, 8f, 4f, 14f, 12f, 500f, 0f, 12f, 12f, 11f)
    val ChipM = LabChipMetrics(40f, 12f, 12f, 8f, 8f, 16f, 24f, 500f, 0f, 16f, 24f, 18f)
    const val ChipSharpRadius = 4f
    const val ChipStrokeWidth = 1f
    const val ChipRolesLabel = "label-primary"
    const val ChipRolesClose = "label-secondary"
    const val ChipRolesBorder = "border-base"
    const val ChipRolesSelected = "fill-tertiary"
    const val ChipRolesHover = "fill-quaternary"
    const val ChipRolesDisabledSelected = "fill-quaternary"
    const val ChipRolesDisabledLabel = "label-quaternary"
    const val ChipRolesActiveFill = "fill-accent"
    const val ChipRolesActiveTint = "fill-brand-primary"
    const val ChipRolesActiveLabel = "label-brand-primary"
    const val ChipRolesActiveSelectedLabel = "label-static-light-primary"
    const val ChipRolesSkeleton = "fx-skeleton-base"
    const val ChipRolesGlow = "fx-glow-inverted"
    const val ChipRolesFocus = "fx-focus-ring-neutral"
    const val ChipRolesHighlight = "bg-static-light"
    const val ChipActiveTintOpacity = 0.12f
    const val ChipActiveHighlightOpacity = 0.2f
    const val ChipDisabledLeadingOpacity = 0.24f
    const val ChipSkeletonRadius = 4f
    const val ChipSkeletonAuthoredMediumCloseSize = 16f
    const val ChipSkeletonRoundedSmallRadius = 9999f
    const val ChipGlowDiameter = 96f
    const val ChipGlowBlur = 36f
    const val ChipGlowOpacity = 0.2f
    const val ChipGlowCenterOffset = 32.5f
    const val ChipGlowSelectedCenterOffset = 45.5f
    const val ChipFocusWidth = 2f
    const val ChipFocusOffset = 2f
    const val ChipCloseSViewBox = 12f
    const val ChipCloseSX = 2.7001953125f
    const val ChipCloseSY = 2.7001953125f
    // Shared contour: transform the canvas, never mutate this path.
    val ChipCloseSPath by lazy { androidx.compose.ui.graphics.Path().apply {
        moveTo(5.575625896453857f, 0.17573624849319458f)
        cubicTo(5.809925898909569f, -0.058563753962516785f, 6.189975872635841f, -0.058528751134872437f, 6.424275875091553f, 0.17573624849319458f)
        cubicTo(6.6585258692502975f, 0.4100562483072281f, 6.658575877547264f, 0.7900763750076294f, 6.424275875091553f, 1.0243663787841797f)
        lineTo(4.14837646484375f, 3.299776077270508f)
        lineTo(6.424275875091553f, 5.575625896453857f)
        cubicTo(6.6585258692502975f, 5.809975892305374f, 6.658575877547264f, 6.189975872635841f, 6.424275875091553f, 6.424275875091553f)
        cubicTo(6.189975872635841f, 6.658575877547264f, 5.809975892305374f, 6.6585258692502975f, 5.575625896453857f, 6.424275875091553f)
        lineTo(3.299776077270508f, 4.14837646484375f)
        lineTo(1.0243663787841797f, 6.424275875091553f)
        cubicTo(0.7900763750076294f, 6.658575877547264f, 0.4100562483072281f, 6.6585258692502975f, 0.17573624849319458f, 6.424275875091553f)
        cubicTo(-0.058528751134872437f, 6.189975872635841f, -0.058563753962516785f, 5.809925898909569f, 0.17573624849319458f, 5.575625896453857f)
        lineTo(2.4511260986328125f, 3.299776077270508f)
        lineTo(0.17573624849319458f, 1.0243663787841797f)
        cubicTo(-0.058578744530677795f, 0.7900513857603073f, -0.058578744530677795f, 0.41005124151706696f, 0.17573624849319458f, 0.17573624849319458f)
        cubicTo(0.41005124151706696f, -0.058578744530677795f, 0.7900513857603073f, -0.058578744530677795f, 1.0243663787841797f, 0.17573624849319458f)
        lineTo(3.299776077270508f, 2.4511260986328125f)
        lineTo(5.575625896453857f, 0.17573624849319458f)
        close()
    } }
    const val ChipCloseMViewBox = 24f
    const val ChipCloseMX = 5.7001953125f
    const val ChipCloseMY = 5.7001953125f
    // Shared contour: transform the canvas, never mutate this path.
    val ChipCloseMPath by lazy { androidx.compose.ui.graphics.Path().apply {
        moveTo(11.064403533935547f, 0.26360249519348145f)
        cubicTo(11.4159035384655f, -0.08744749426841736f, 11.985503435134888f, -0.0876375138759613f, 12.336803436279297f, 0.26360249519348145f)
        cubicTo(12.688003450632095f, 0.6151024997234344f, 12.688203424215317f, 1.1856723725795746f, 12.336803436279297f, 1.5370423793792725f)
        lineTo(7.573203086853027f, 6.2997026443481445f)
        lineTo(12.336803436279297f, 11.064403533935547f)
        cubicTo(12.688003450632095f, 11.4159035384655f, 12.688203424215317f, 11.985503435134888f, 12.336803436279297f, 12.336803436279297f)
        cubicTo(11.985503435134888f, 12.688203424215317f, 11.4159035384655f, 12.688003450632095f, 11.064403533935547f, 12.336803436279297f)
        lineTo(6.2997026443481445f, 7.573203086853027f)
        lineTo(1.5370423793792725f, 12.336803436279297f)
        cubicTo(1.1856723725795746f, 12.688203424215317f, 0.6151024997234344f, 12.688003450632095f, 0.26360249519348145f, 12.336803436279297f)
        cubicTo(-0.0876375138759613f, 11.985503435134888f, -0.08744749426841736f, 11.4159035384655f, 0.26360249519348145f, 11.064403533935547f)
        lineTo(5.0273027420043945f, 6.2997026443481445f)
        lineTo(0.26360249519348145f, 1.5370423793792725f)
        cubicTo(-0.08786749839782715f, 1.1855623722076416f, -0.08786749839782715f, 0.61507248878479f, 0.26360249519348145f, 0.26360249519348145f)
        cubicTo(0.61507248878479f, -0.08786749839782715f, 1.1855623722076416f, -0.08786749839782715f, 1.5370423793792725f, 0.26360249519348145f)
        lineTo(6.2997026443481445f, 5.0273027420043945f)
        lineTo(11.064403533935547f, 0.26360249519348145f)
        close()
    } }
    val TabsS = LabTabsMetrics(36f, 10f, 8f, 6f, 14f, 20f, 500f, 0f, 16f, 20f, 15f)
    val TabsM = LabTabsMetrics(48f, 12f, 12f, 8f, 16f, 24f, 500f, 0f, 20f, 24f, 18f)
    val TabsL = LabTabsMetrics(56f, 12f, 16f, 8f, 16f, 24f, 500f, 0f, 20f, 24f, 18f)
    const val TabsListRadius = 16f
    const val TabsListPadding = 4f
    const val TabsListFourHorizontalPadding = 2f
    const val TabsListSeparatorInset = 8f
    const val TabsStrokeWidth = 1f
    val TabsActiveShadow get() = LabShadows.xs
    const val TabsRolesLabel = "label-primary"
    const val TabsRolesInactiveLabel = "label-secondary"
    const val TabsRolesDisabledLabel = "label-quaternary"
    const val TabsRolesTrack = "fill-quaternary"
    const val TabsRolesHover = "fill-quaternary"
    const val TabsRolesActiveFill = "control-bg"
    const val TabsRolesBorder = "border-base"
    const val TabsRolesIndicator = "border-strong"
    const val TabsFocusWidth = 2f
    const val TabsFocusOffset = 2f
    const val TabsUnderlinedBottomIconOnlySize = 20f
    val BreadcrumbS = LabBreadcrumbMetrics(12f, 12f, 18f, 14f, 6f)
    val BreadcrumbM = LabBreadcrumbMetrics(14f, 12f, 20f, 16f, 8f)
    val BreadcrumbL = LabBreadcrumbMetrics(16f, 16f, 24f, 20f, 10f)
    const val BreadcrumbFontWeight = 500f
    const val BreadcrumbLetterSpacing = 0f
    const val BreadcrumbDefaultMaxItems = 4f
    const val BreadcrumbRolesLabel = "label-secondary"
    const val BreadcrumbRolesCurrent = "label-primary"
    const val BreadcrumbRolesHover = "label-primary"
    const val BreadcrumbRolesFocus = "border-focus"
    const val BreadcrumbGlyphsChevronViewBox = 16f
    const val BreadcrumbGlyphsChevronX = 5.734375f
    const val BreadcrumbGlyphsChevronY = 3.3919270038604736f
    // Shared contour: transform the canvas, never mutate this path.
    val BreadcrumbGlyphsChevronPath by lazy { androidx.compose.ui.graphics.Path().apply {
        moveTo(0.234521f, 0.234133f)
        cubicTo(0.527434f, -0.0586204f, 0.990701f, -0.0768203f, 1.30483f, 0.179446f)
        lineTo(1.36537f, 0.234133f)
        lineTo(4.4253f, 3.29406f)
        cubicTo(4.5479f, 3.41666f, 4.6747f, 3.54226f, 4.7729f, 3.65799f)
        cubicTo(4.87717f, 3.78079f, 4.9955f, 3.94413f, 5.0659f, 4.16059f)
        cubicTo(5.16157f, 4.45513f, 5.16163f, 4.77293f, 5.0659f, 5.06746f)
        lineTo(5.0379f, 5.14626f)
        cubicTo(4.96663f, 5.32406f, 4.86417f, 5.46266f, 4.7729f, 5.57006f)
        cubicTo(4.6747f, 5.68573f, 4.54783f, 5.81139f, 4.4253f, 5.93399f)
        lineTo(1.36537f, 8.99393f)
        lineTo(1.30483f, 9.04859f)
        cubicTo(0.990701f, 9.30473f, 0.527381f, 9.28659f, 0.234521f, 8.99393f)
        cubicTo(-0.0778258f, 8.68153f, -0.0777191f, 8.17479f, 0.234521f, 7.86239f)
        lineTo(3.29443f, 4.80246f)
        cubicTo(3.3615f, 4.73539f, 3.41423f, 4.68219f, 3.4591f, 4.63579f)
        cubicTo(3.46623f, 4.62846f, 3.47297f, 4.62099f, 3.4793f, 4.61433f)
        cubicTo(3.47283f, 4.60753f, 3.46643f, 4.59973f, 3.4591f, 4.59219f)
        cubicTo(3.41417f, 4.54579f, 3.36157f, 4.49273f, 3.29443f, 4.42553f)
        lineTo(0.234521f, 1.36564f)
        lineTo(0.179181f, 1.30509f)
        cubicTo(-0.0771456f, 0.99094f, -0.0582458f, 0.527066f, 0.234521f, 0.234133f)
        close()
    } }
    const val BreadcrumbGlyphsEllipsisViewBox = 16f
    const val BreadcrumbGlyphsEllipsisX = 2.2662761211395264f
    const val BreadcrumbGlyphsEllipsisY = 6.93359375f
    // Shared contour: transform the canvas, never mutate this path.
    val BreadcrumbGlyphsEllipsisPath by lazy { androidx.compose.ui.graphics.Path().apply {
        moveTo(1.06667f, 2.13333f)
        cubicTo(1.65577f, 2.13333f, 2.13333f, 1.6558f, 2.13333f, 1.06667f)
        cubicTo(2.13333f, 0.4776f, 1.65577f, 0f, 1.06667f, 0f)
        cubicTo(0.477567f, 0f, 0f, 0.4776f, 0f, 1.06667f)
        cubicTo(0f, 1.6558f, 0.477567f, 2.13333f, 1.06667f, 2.13333f)
        close()
        moveTo(5.73333f, 2.13333f)
        cubicTo(6.32247f, 2.13333f, 6.8f, 1.6558f, 6.8f, 1.06667f)
        cubicTo(6.8f, 0.4776f, 6.32247f, 0f, 5.73333f, 0f)
        cubicTo(5.1442f, 0f, 4.66667f, 0.4776f, 4.66667f, 1.06667f)
        cubicTo(4.66667f, 1.6558f, 5.1442f, 2.13333f, 5.73333f, 2.13333f)
        close()
        moveTo(10.4f, 2.13333f)
        cubicTo(10.9891f, 2.13333f, 11.4667f, 1.6558f, 11.4667f, 1.06667f)
        cubicTo(11.4667f, 0.4776f, 10.9891f, 0f, 10.4f, 0f)
        cubicTo(9.81087f, 0f, 9.33333f, 0.4776f, 9.33333f, 1.06667f)
        cubicTo(9.33333f, 1.6558f, 9.81087f, 2.13333f, 10.4f, 2.13333f)
        close()
    } }
    const val PaginationGap = 8f
    const val PaginationControl = 40f
    const val PaginationRadius = 12f
    const val PaginationPadding = 12f
    const val PaginationFontSize = 16f
    const val PaginationLineHeight = 24f
    const val PaginationFontWeight = 500f
    const val PaginationStroke = 1f
    const val PaginationIcon = 16f
    const val PaginationDefaultSiblingCount = 1f
    const val PaginationMaxSiblingCount = 4f
    const val PaginationRolesLabel = "label-primary"
    const val PaginationRolesChevron = "label-secondary"
    const val PaginationRolesBorder = "border-base"
    const val PaginationRolesActive = "bg-tertiary"
    const val PaginationRolesHover = "fill-quaternary"
    const val PaginationRolesDisabled = "label-tertiary"
    const val PaginationRolesFocus = "border-focus"
    const val PaginationGlyphsChevronViewBox = 16f
    const val PaginationGlyphsChevronX = 5.127604007720947f
    const val PaginationGlyphsChevronY = 3.3919270038604736f
    // Shared contour: transform the canvas, never mutate this path.
    val PaginationGlyphsChevronPath by lazy { androidx.compose.ui.graphics.Path().apply {
        moveTo(4.90313f, 0.234133f)
        cubicTo(4.61026f, -0.0586204f, 4.14699f, -0.0768203f, 3.83286f, 0.179446f)
        lineTo(3.77226f, 0.234133f)
        lineTo(0.712394f, 3.29406f)
        cubicTo(0.589734f, 3.41666f, 0.462974f, 3.54226f, 0.364734f, 3.65799f)
        cubicTo(0.260468f, 3.78079f, 0.142141f, 3.94413f, 0.0717675f, 4.16059f)
        cubicTo(-0.0239125f, 4.45513f, -0.0239325f, 4.77293f, 0.0717675f, 5.06746f)
        lineTo(0.099761f, 5.14626f)
        cubicTo(0.171014f, 5.32406f, 0.273528f, 5.46266f, 0.364734f, 5.57006f)
        cubicTo(0.462954f, 5.68573f, 0.589808f, 5.81139f, 0.712394f, 5.93399f)
        lineTo(3.77226f, 8.99393f)
        lineTo(3.83286f, 9.04859f)
        cubicTo(4.14699f, 9.30473f, 4.61026f, 9.28659f, 4.90313f, 8.99393f)
        cubicTo(5.21553f, 8.68153f, 5.21539f, 8.17479f, 4.90313f, 7.86239f)
        lineTo(1.84326f, 4.80246f)
        cubicTo(1.77619f, 4.73539f, 1.72346f, 4.68219f, 1.67853f, 4.63579f)
        cubicTo(1.67139f, 4.62846f, 1.66473f, 4.62099f, 1.65833f, 4.61433f)
        cubicTo(1.66486f, 4.60753f, 1.67126f, 4.59973f, 1.67853f, 4.59219f)
        cubicTo(1.72346f, 4.54579f, 1.77606f, 4.49273f, 1.84326f, 4.42553f)
        lineTo(4.90313f, 1.36564f)
        lineTo(4.95846f, 1.30509f)
        cubicTo(5.21479f, 0.99094f, 5.19593f, 0.527066f, 4.90313f, 0.234133f)
        close()
    } }
    const val PaginationGlyphsEllipsisDiameter = 3f
    const val PaginationGlyphsEllipsisGap = 2f
    const val PaginationGlyphsEllipsisOffsetY = 13f
    const val PaginationCompactDot = 8f
    const val PaginationCompactRecedingDot = 6f
    const val PaginationCompactGap = 8f
    const val PaginationCompactPadding = 8f
    const val PaginationCompactHeight = 24f
    const val PaginationCompactTrack = 20f
    const val PaginationCompactVisiblePages = 5f
    const val PaginationCompactInactiveOpacity = 0.08f
    const val PaginationCompactAmbientInactiveOpacity = 0.24f
    const val PaginationCompactColorRole = "label-brand-primary"
    const val PaginationCompactAmbientColorRole = "label-primary"
    val PaginationCompactMaterial get() = LabMaterials.base
    const val PaginationCompactRadius = 9999f
    const val PaginationFocusWidth = 2f
    const val PaginationFocusOffset = 2f
    val AccordionS = LabAccordionMetrics(12f, 12f, 8f, 6f, 14f, 20f, 14f)
    val AccordionM = LabAccordionMetrics(16f, 16f, 12f, 8f, 16f, 24f, 16f)
    val AccordionL = LabAccordionMetrics(20f, 20f, 14f, 10f, 18f, 28f, 18f)
    const val AccordionFontFamily = "Geist"
    const val AccordionTitleWeight = 500f
    const val AccordionBodyWeight = 400f
    const val AccordionTitleTracking = 0f
    const val AccordionBodyTracking = -0.25f
    const val AccordionRolesLabel = "label-primary"
    const val AccordionRolesBody = "label-secondary"
    const val AccordionRolesHover = "fill-quaternary"
    const val AccordionRolesDisabled = "label-tertiary"
    const val AccordionRolesFocus = "border-focus"
    const val AccordionChevronViewBox = 16f
    const val AccordionChevronX = 3.3802082538604736f
    const val AccordionChevronY = 5.734375f
    // Shared contour: transform the canvas, never mutate this path.
    val AccordionChevronPath by lazy { androidx.compose.ui.graphics.Path().apply {
        moveTo(8.99384f, 0.234521f)
        cubicTo(9.28658f, 0.527434f, 9.30478f, 0.990701f, 9.04851f, 1.30483f)
        lineTo(8.99384f, 1.36537f)
        lineTo(5.93391f, 4.4253f)
        cubicTo(5.81124f, 4.5479f, 5.68571f, 4.6747f, 5.56998f, 4.7729f)
        cubicTo(5.44718f, 4.87717f, 5.28378f, 4.9955f, 5.06738f, 5.0659f)
        cubicTo(4.77284f, 5.16157f, 4.45504f, 5.16163f, 4.16051f, 5.0659f)
        lineTo(4.08171f, 5.0379f)
        cubicTo(3.90384f, 4.96663f, 3.76531f, 4.86417f, 3.65791f, 4.7729f)
        cubicTo(3.54224f, 4.6747f, 3.41651f, 4.54783f, 3.29398f, 4.4253f)
        lineTo(0.234057f, 1.36537f)
        lineTo(0.179364f, 1.30483f)
        cubicTo(-0.0767561f, 0.990701f, -0.0586359f, 0.527381f, 0.234057f, 0.234521f)
        cubicTo(0.546417f, -0.0778258f, 1.05314f, -0.0777191f, 1.36556f, 0.234521f)
        lineTo(4.42544f, 3.29443f)
        cubicTo(4.49258f, 3.3615f, 4.54578f, 3.41423f, 4.59211f, 3.4591f)
        cubicTo(4.59951f, 3.46623f, 4.60698f, 3.47297f, 4.61364f, 3.4793f)
        cubicTo(4.62038f, 3.47283f, 4.62818f, 3.46643f, 4.63578f, 3.4591f)
        cubicTo(4.68211f, 3.41417f, 4.73524f, 3.36157f, 4.80244f, 3.29443f)
        lineTo(7.86231f, 0.234521f)
        lineTo(7.92284f, 0.179181f)
        cubicTo(8.23705f, -0.0771456f, 8.70091f, -0.0582458f, 8.99384f, 0.234521f)
        close()
    } }
    const val SegmentedPadding = 2f
    const val SegmentedControlHeight = 36f
    const val SegmentedControlPadding = 12f
    const val SegmentedGap = 4f
    const val SegmentedIconSize = 12f
    const val SegmentedIconOnlySize = 20f
    const val SegmentedIconOnlyPadding = 8f
    const val SegmentedSeparatorInset = 8f
    const val SegmentedStrokeWidth = 1f
    val SegmentedActiveShadow get() = LabShadows.xs
    const val SegmentedShapesRoundedTrackRadius = 9999f
    const val SegmentedShapesRoundedControlRadius = 9999f
    const val SegmentedShapesRegularTrackRadius = 12f
    const val SegmentedShapesRegularControlRadius = 10f
    const val SegmentedShapesSharpTrackRadius = 0f
    const val SegmentedShapesSharpControlRadius = 4f
    const val SegmentedRolesLabel = "label-primary"
    const val SegmentedRolesInactiveLabel = "label-secondary"
    const val SegmentedRolesDisabledLabel = "label-tertiary"
    const val SegmentedRolesTrack = "fill-quaternary"
    const val SegmentedRolesHover = "fill-quaternary"
    const val SegmentedRolesActiveFill = "control-bg"
    const val SegmentedRolesBorder = "border-base"
    const val SegmentedRolesFocus = "border-focus"
    const val SegmentedFocusWidth = 2f
    const val SegmentedFocusInset = 2f
    const val SegmentedFontSize = 14f
    const val SegmentedLineHeight = 12f
    const val SegmentedFontWeight = 500f
    const val SegmentedLetterSpacing = 0f
    val SelectS = LabSelectMetrics(32f, 9999f, 12f, 8f, 8f, 8f, 16f, 14f, 12f, 500f, 0f)
    val SelectM = LabSelectMetrics(48f, 12f, 16f, 12f, 12f, 12f, 16f, 16f, 24f, 400f, -0.25f)
    val SelectL = LabSelectMetrics(56f, 16f, 16f, 16f, 16f, 12f, 20f, 16f, 24f, 400f, -0.25f)
    const val SelectLeadingGap = 8f
    const val SelectChevronViewBox = 16f
    const val SelectChevronX = 3.3802490234375f
    const val SelectChevronY = 5.734375f
    // Shared contour: transform the canvas, never mutate this path.
    val SelectChevronPath by lazy { androidx.compose.ui.graphics.Path().apply {
        moveTo(8.99384f, 0.234521f)
        cubicTo(9.28658f, 0.527434f, 9.30478f, 0.990701f, 9.04851f, 1.30483f)
        lineTo(8.99384f, 1.36537f)
        lineTo(5.93391f, 4.4253f)
        cubicTo(5.81124f, 4.5479f, 5.68571f, 4.6747f, 5.56998f, 4.7729f)
        cubicTo(5.44718f, 4.87717f, 5.28378f, 4.9955f, 5.06738f, 5.0659f)
        cubicTo(4.77284f, 5.16157f, 4.45504f, 5.16163f, 4.16051f, 5.0659f)
        lineTo(4.08171f, 5.0379f)
        cubicTo(3.90384f, 4.96663f, 3.76531f, 4.86417f, 3.65791f, 4.7729f)
        cubicTo(3.54224f, 4.6747f, 3.41651f, 4.54783f, 3.29398f, 4.4253f)
        lineTo(0.234057f, 1.36537f)
        lineTo(0.179364f, 1.30483f)
        cubicTo(-0.0767561f, 0.990701f, -0.0586359f, 0.527381f, 0.234057f, 0.234521f)
        cubicTo(0.546417f, -0.0778258f, 1.05314f, -0.0777191f, 1.36556f, 0.234521f)
        lineTo(4.42544f, 3.29443f)
        cubicTo(4.49258f, 3.3615f, 4.54578f, 3.41423f, 4.59211f, 3.4591f)
        cubicTo(4.59951f, 3.46623f, 4.60698f, 3.47297f, 4.61364f, 3.4793f)
        cubicTo(4.62038f, 3.47283f, 4.62818f, 3.46643f, 4.63578f, 3.4591f)
        cubicTo(4.68211f, 3.41417f, 4.73524f, 3.36157f, 4.80244f, 3.29443f)
        lineTo(7.86231f, 0.234521f)
        lineTo(7.92284f, 0.179181f)
        cubicTo(8.23705f, -0.0771456f, 8.70091f, -0.0582458f, 8.99384f, 0.234521f)
        close()
    } }
    const val SelectStroke = 1f
    const val SelectMultipleHeight = 48f
    const val SelectMultipleRadius = 12f
    const val SelectMultiplePaddingStart = 10f
    const val SelectMultiplePaddingEnd = 32f
    const val SelectMultiplePaddingY = 10f
    const val SelectMultipleGap = 8f
    const val SelectMultiplePlaceholderStart = 20f
    const val SelectMultipleLabelStart = 20f
    const val SelectMultipleLabelFontSize = 12f
    const val SelectMultipleLabelLineHeight = 12f
    const val SelectMultipleLabelWeight = 500f
    const val SelectMultipleLabelOverhang = 8f
    const val SelectMultipleLabelGap = 4f
    const val SelectMultipleChevronEnd = 12f
    const val SelectMultipleShowLabel = true
    const val SelectMultipleHoverCenterX = 0.13548386378449973f
    const val SelectMultipleHoverCenterY = 0f
    const val SelectMultipleHoverRadiusX = 0.3662704874799413f
    const val SelectMultipleHoverRadiusY = 0.821945539573786f
    const val SelectRolesLabel = "label-primary"
    const val SelectRolesCaption = "label-secondary"
    const val SelectRolesPlaceholder = "label-tertiary"
    const val SelectRolesDisabled = "label-quaternary"
    const val SelectRolesBorder = "border-base"
    const val SelectRolesHover = "fill-quaternary"
    const val SelectRolesFocus = "border-focus"
    val AvatarS = LabAvatarMetrics(24f, 10.5f, 9f, 6f, 1.5f)
    val AvatarM = LabAvatarMetrics(32f, 14f, 12f, 8f, 2f)
    val AvatarL = LabAvatarMetrics(48f, 21f, 18f, 12f, 3f)
    val AvatarDefaultColor = LabAvatarColor.Blue
    const val AvatarDefaultFallback = "initials"
    const val AvatarFontFamily = "Sunghyun Sans"
    const val AvatarLetterBoxHeightRatio = 0.9375f
    const val AvatarFontWeight = 800f
    const val AvatarLetterSpacing = 0f
    const val AvatarLetterRole = "label-static-light-primary"
    const val AvatarHighlightRole = "bg-static-light"
    const val AvatarHighlightAlpha = 0.5f
    const val AvatarStatusesOnlineRole = "label-info-primary"
    const val AvatarStatusesOnlineLabel = "В сети"
    const val AvatarStatusesOfflineRole = "label-quaternary"
    const val AvatarStatusesOfflineLabel = "Не в сети"
    const val AvatarStatusesAwayRole = "label-warning-primary"
    const val AvatarStatusesAwayLabel = "Нет на месте"
    const val AvatarStatusesDndRole = "label-danger-primary"
    const val AvatarStatusesDndLabel = "Не беспокоить"
    const val DragButtonPadding = 4f
    const val DragButtonHeight = 56f
    const val DragButtonRadius = 20f
    const val DragButtonMaskCount = 5f
    const val DragButtonMaskWidth = 140f
    const val DragButtonMaskHeight = 210f
    const val DragButtonMaskGap = 64f
    const val DragButtonMaskBlur = 128f
    const val DragButtonRolesTrack = "fill-tertiary"
    const val DragButtonRolesLabel = "label-primary"
    const val DragButtonRolesDisabledLabel = "label-tertiary"
    const val DragButtonGlowSize = 48f
    const val DragButtonGlowOffsetX = 12f
    const val DragButtonGlowOffsetY = 12f
    const val DragButtonGlowBlur = 36f
    const val DragButtonGlowOpacity = 0.3f
    const val DragButtonGlowColorRole = "fx-glow-neutral"
    const val DragButtonFontSize = 16f
    const val DragButtonLineHeight = 24f
    const val DragButtonFontWeight = 500f
    const val DragButtonLetterSpacing = 0f
    val PinInputS = LabPinInputMetrics(40f, 48f, 10f, 8f, 6f, 16f, 24f, 400f, -0.25f)
    val PinInputM = LabPinInputMetrics(48f, 56f, 12f, 12f, 8f, 16f, 24f, 400f, -0.25f)
    val PinInputL = LabPinInputMetrics(56f, 64f, 14f, 12f, 10f, 16f, 24f, 400f, -0.25f)
    const val PinInputStrokeWidth = 2f
    const val PinInputFieldGap = 8f
    const val PinInputFocusWidth = 2f
    const val PinInputFocusOffset = 2f
    const val PinInputCaptionFontSize = 14f
    const val PinInputCaptionLineHeight = 12f
    const val PinInputCaptionFontWeight = 500f
    const val PinInputCaptionLetterSpacing = 0f
    const val PinInputRolesBackground = "bg-primary"
    const val PinInputRolesBorder = "border-base"
    const val PinInputRolesActiveBorder = "border-accent"
    const val PinInputRolesHover = "fill-quaternary"
    const val PinInputRolesLabel = "label-primary"
    const val PinInputRolesPlaceholder = "label-quaternary"
    const val PinInputRolesFocus = "border-focus"
    const val PinInputRolesDanger = "border-danger"
    const val PinInputRolesCaption = "label-secondary"
    const val PinInputRolesDisabledLabel = "label-quaternary"
    const val PinInputRolesDisabledBorder = "border-soft"
    const val PinInputRolesReadonlyBackground = "fill-quaternary"
    const val SliderTrack = 4f
    const val SliderThumb = 12f
    const val SliderThumbStroke = 3f
    const val SliderThumbRole = "bg-static-light"
    const val SliderActiveRole = "label-brand-primary"
    const val SliderTrackRole = "slider-track"
    const val SliderFocusRole = "border-focus"
    const val SliderDisabledOpacity = 0.4f
    const val SliderHitSize = 44f
    const val SliderCircularDiameter = 96f
    const val SliderCircularStroke = 4f
    const val SliderCircularStartAngle = -90f
    const val SliderLargeHeight = 56f
    const val SliderLargeRadius = 16f
    const val SliderLargeLabelInset = 24f
    const val SliderLargeFontSize = 16f
    const val SliderLargeLineHeight = 24f
    const val SliderLargeFontWeight = 500f
    const val SliderLargeLetterSpacing = 0f
    const val SliderLargeLabelRole = "slider-large-label"
    const val SliderLargeActiveLabelRole = "label-on-accent"
    const val SliderLargeTrackRole = "slider-large-track"
    const val SliderLargeActiveRole = "fill-accent"
    const val SliderLargeHighlightRole = "bg-static-light"
    const val SliderLargeHighlightOpacity = 0.2f
    const val SliderLargeIndicatorWidth = 3f
    const val SliderLargeIndicatorHeight = 16f
    const val SliderLargeIndicatorInset = 12f
    const val SliderLargeMaskWidth = 7f
    const val SliderLargeMaskBlur = 2f
    const val TooltipRadius = 12f
    const val TooltipCornerSmoothing = 0.6f
    const val TooltipPadding = 12f
    const val TooltipMinWidth = 48f
    const val TooltipMaxWidth = 352f
    const val TooltipViewportGap = 8f
    const val TooltipSizeExtensionsSPadding = 8f
    const val TooltipSizeExtensionsSFontSize = 14f
    const val TooltipSizeExtensionsSLineHeight = 20f
    const val TooltipSizeExtensionsLPadding = 16f
    const val TooltipGap = 4f
    const val TooltipTailWidth = 28f
    const val TooltipTailHeight = 8f
    const val TooltipTailChevronViewBox = 28f
    const val TooltipTailChevronX = 0f
    const val TooltipTailChevronY = 0f
    // Shared contour: transform the canvas, never mutate this path.
    val TooltipTailChevronPath by lazy { androidx.compose.ui.graphics.Path().apply {
        moveTo(13.5332f, 8f)
        cubicTo(11.3314f, 8f, 12.0314f, 0.0000253097f, 3.78929f, 0f)
        lineTo(23.277f, 0f)
        cubicTo(15.7349f, 0.00000141942f, 15.7349f, 8f, 13.5332f, 8f)
        close()
    } }
    const val TooltipTailBubbleViewBox = 28f
    const val TooltipTailBubbleX = 6f
    const val TooltipTailBubbleY = 0f
    const val TooltipTailBubbleWidth = 17f
    const val TooltipTailBubbleHeight = 15f
    // Shared contour: transform the canvas, never mutate this path.
    val TooltipTailBubblePath by lazy { androidx.compose.ui.graphics.Path().apply {
        moveTo(13f, 7f)
        cubicTo(15.2091f, 7f, 17f, 8.79086f, 17f, 11f)
        cubicTo(17f, 13.2091f, 15.2091f, 15f, 13f, 15f)
        cubicTo(10.7909f, 15f, 9f, 13.2091f, 9f, 11f)
        cubicTo(9f, 8.79086f, 10.7909f, 7f, 13f, 7f)
        close()
        moveTo(12f, 0f)
        cubicTo(12f, 3.31371f, 9.31371f, 6f, 6f, 6f)
        cubicTo(2.68629f, 6f, 0f, 3.31371f, 0f, 0f)
        lineTo(12f, 0f)
        close()
    } }
    const val TooltipTypesNeutralSurfaceRole = "bg-tertiary"
    const val TooltipTypesNeutralLabelRole = "label-primary"
    const val TooltipTypesInvertedSurfaceRole = "bg-inverted"
    const val TooltipTypesInvertedLabelRole = "label-inverted-primary"
    const val TooltipTypesAccentSurfaceRole = "fill-accent"
    const val TooltipTypesAccentLabelRole = "label-on-accent"
    val TooltipShadow = listOf(
        LabShadowLayer(0f, 16f, 36f, 0f, "bg-static-dark", 0.12f),
        LabShadowLayer(0f, 24f, 48f, 0f, "bg-static-dark", 0.04f),
        LabShadowLayer(0f, 36f, 64f, 0f, "bg-static-dark", 0.02f),
        LabShadowLayer(0f, 48f, 96f, 0f, "bg-static-dark", 0.01f),
    )
    const val TooltipBodyViewBox = 202f
    const val TooltipBodyX = 0f
    const val TooltipBodyY = 0f
    const val TooltipBodyStretchWidth = 202f
    const val TooltipBodyStretchHeight = 48f
    // Shared contour: transform the canvas, never mutate this path.
    fun TooltipBodyPath(width: Float, height: Float, scale: Float) = androidx.compose.ui.graphics.Path().apply {
        moveTo(0f * scale, 19.2f * scale)
        cubicTo(0f * scale, 12.4794f * scale, 0f * scale, 9.11905f * scale, 1.30792f * scale, 6.55211f * scale)
        cubicTo(2.4584f * scale, 4.29417f * scale, 4.29417f * scale, 2.4584f * scale, 6.55211f * scale, 1.30792f * scale)
        cubicTo(9.11905f * scale, 0f * scale, 12.4794f * scale, 0f * scale, 19.2f * scale, 0f * scale)
        lineTo(182.8f * scale + (width - 202f * scale), 0f * scale)
        cubicTo(189.521f * scale + (width - 202f * scale), 0f * scale, 192.881f * scale + (width - 202f * scale), 0f * scale, 195.448f * scale + (width - 202f * scale), 1.30792f * scale)
        cubicTo(197.706f * scale + (width - 202f * scale), 2.4584f * scale, 199.542f * scale + (width - 202f * scale), 4.29417f * scale, 200.692f * scale + (width - 202f * scale), 6.55211f * scale)
        cubicTo(202f * scale + (width - 202f * scale), 9.11905f * scale, 202f * scale + (width - 202f * scale), 12.4794f * scale, 202f * scale + (width - 202f * scale), 19.2f * scale)
        lineTo(202f * scale + (width - 202f * scale), 28.8f * scale + (height - 48f * scale))
        cubicTo(202f * scale + (width - 202f * scale), 35.5206f * scale + (height - 48f * scale), 202f * scale + (width - 202f * scale), 38.8809f * scale + (height - 48f * scale), 200.692f * scale + (width - 202f * scale), 41.4479f * scale + (height - 48f * scale))
        cubicTo(199.542f * scale + (width - 202f * scale), 43.7058f * scale + (height - 48f * scale), 197.706f * scale + (width - 202f * scale), 45.5416f * scale + (height - 48f * scale), 195.448f * scale + (width - 202f * scale), 46.6921f * scale + (height - 48f * scale))
        cubicTo(192.881f * scale + (width - 202f * scale), 48f * scale + (height - 48f * scale), 189.521f * scale + (width - 202f * scale), 48f * scale + (height - 48f * scale), 182.8f * scale + (width - 202f * scale), 48f * scale + (height - 48f * scale))
        lineTo(19.2f * scale, 48f * scale + (height - 48f * scale))
        cubicTo(12.4794f * scale, 48f * scale + (height - 48f * scale), 9.11905f * scale, 48f * scale + (height - 48f * scale), 6.55211f * scale, 46.6921f * scale + (height - 48f * scale))
        cubicTo(4.29417f * scale, 45.5416f * scale + (height - 48f * scale), 2.4584f * scale, 43.7058f * scale + (height - 48f * scale), 1.30792f * scale, 41.4479f * scale + (height - 48f * scale))
        cubicTo(0f * scale, 38.8809f * scale + (height - 48f * scale), 0f * scale, 35.5206f * scale + (height - 48f * scale), 0f * scale, 28.8f * scale + (height - 48f * scale))
        lineTo(0f * scale, 19.2f * scale)
        close()
    }
    const val TooltipFontSize = 16f
    const val TooltipLineHeight = 24f
    const val TooltipFontWeight = 400f
    const val TooltipLetterSpacing = -0.25f
    const val DialogIntrinsicWidth = 480f
    const val DialogRadius = 24f
    const val DialogPadding = 36f
    const val DialogContentGap = 36f
    const val DialogLabelGap = 12f
    const val DialogActionGap = 8f
    const val DialogStrokeWidth = 1f
    const val DialogViewportGap = 16f
    const val DialogAnchorGap = 8f
    const val DialogActionMinInlineEm = 8f
    const val DialogIconSize = 24f
    val DialogMaterial get() = LabMaterials.elevated
    const val DialogHeadingFontSize = 20f
    const val DialogHeadingLineHeight = 20f
    const val DialogHeadingFontWeight = 600f
    const val DialogHeadingLetterSpacing = -0.33f
    const val DialogDescriptionFontSize = 16f
    const val DialogDescriptionLineHeight = 24f
    const val DialogDescriptionFontWeight = 400f
    const val DialogDescriptionLetterSpacing = -0.25f
    const val DialogWidthsS = 360f
    const val DialogWidthsM = 480f
    const val DialogWidthsL = 640f
    const val DialogPopoverWidthsS = 240f
    const val DialogPopoverWidthsM = 320f
    const val DialogPopoverWidthsL = 400f
    const val DialogRolesHeading = "label-primary"
    const val DialogRolesDescription = "label-secondary"
    const val DialogRolesBorder = "border-base"
    const val DialogRolesScrim = "bg-overlay-base"
    const val AlertIntrinsicWidth = 450f
    const val AlertRadius = 24f
    const val AlertPadding = 16f
    const val AlertActionGap = 24f
    const val AlertLabelGap = 4f
    const val AlertContentPaddingStart = 4f
    const val AlertIconSize = 24f
    const val AlertReflowMinContentEm = 12f
    const val AlertStrokeWidth = 1f
    val AlertMaterial get() = LabMaterials.elevated
    const val AlertHeadingFontSize = 16f
    const val AlertHeadingLineHeight = 24f
    const val AlertHeadingFontWeight = 500f
    const val AlertHeadingLetterSpacing = 0f
    const val AlertDescriptionFontSize = 16f
    const val AlertDescriptionLineHeight = 24f
    const val AlertDescriptionFontWeight = 400f
    const val AlertDescriptionLetterSpacing = -0.25f
    const val AlertRolesHeading = "label-primary"
    const val AlertRolesDescription = "label-secondary"
    const val AlertRolesIcon = "label-primary"
    const val AlertRolesDangerIcon = "label-danger"
    const val AlertRolesClose = "label-secondary"
    const val AlertRolesBorder = "border-base"
    const val AlertRolesFocus = "border-focus"
    const val AlertStackHeight = 8f
    const val AlertStackRadius = 8f
    const val AlertStackFirstInset = 24f
    const val AlertStackFirstOpacity = 0.76f
    val AlertStackFirstMaterial get() = LabMaterials.base
    const val AlertStackSecondInset = 48f
    const val AlertStackSecondOpacity = 0.52f
    val AlertStackSecondMaterial get() = LabMaterials.muted
    const val MenuWidth = 256f
    const val MenuRadius = 12f
    const val MenuCornerSmoothing = 0.6f
    const val MenuPadding = 4f
    const val MenuStrokeWidth = 1f
    const val MenuGap = 4f
    const val MenuRadioDotSize = 4f
    const val MenuRadioHighlightOpacity = 0.2f
    const val MenuRadioHighlightRole = "bg-static-light"
    const val MenuRowPaddingX = 12f
    const val MenuRowPaddingY = 8f
    const val MenuRowRadius = 8f
    const val MenuRowLabelGap = 8f
    const val MenuRowAccessoryGap = 4f
    const val MenuRowIconSize = 16f
    const val MenuRowSeparatorGap = 2f
    const val MenuHeaderPadding = 12f
    const val MenuHeaderFontSize = 16f
    const val MenuHeaderLineHeight = 24f
    const val MenuHeaderFontWeight = 500f
    const val MenuHeaderLetterSpacing = 0f
    val MenuDropdownMaterial get() = LabMaterials.elevated
    val MenuDropdownShadow get() = LabShadows.m
    val MenuContextMaterial get() = LabMaterials.elevated
    val MenuContextShadow get() = LabShadows.xs
    const val MenuContextRowGap = 2f
    const val MenuContextLabelInset = 36f
    val MenuMenubarMaterial get() = LabMaterials.soft
    const val MenuMenubarPadding = 4f
    const val MenuMenubarRadius = 20f
    const val MenuMenubarItemRadius = 12f
    const val MenuMenubarActiveRadius = 16f
    const val MenuMenubarPaddingX = 16f
    const val MenuMenubarPaddingY = 8f
    val MenuMenubarActiveShadow get() = LabShadows.xs
    const val MenuRolesLabel = "label-primary"
    const val MenuRolesAccent = "label-accent"
    const val MenuRolesDanger = "label-danger"
    const val MenuRolesDisabled = "label-quaternary"
    const val MenuRolesHighlight = "fill-quaternary"
    const val MenuRolesBorder = "border-base"
    const val MenuRolesActiveBackground = "bg-static-light"
    const val MenuRolesActiveLabel = "label-static-dark-primary"
    const val MenuFontSize = 16f
    const val MenuLineHeight = 24f
    const val MenuFontWeight = 400f
    const val MenuLetterSpacing = -0.25f
    val FileUploadS = LabFileUploadMetrics(40f, 9999f, 16f, 8f, 24f, 16f, 24f, 400f, -0.25f)
    val FileUploadM = LabFileUploadMetrics(48f, 16f, 16f, 12f, 24f, 16f, 24f, 400f, -0.25f)
    val FileUploadL = LabFileUploadMetrics(56f, 16f, 16f, 16f, 24f, 16f, 24f, 400f, -0.25f)
    const val FileUploadStrokeWidth = 1f
    const val FileUploadDragStrokeWidth = 2f
    const val FileUploadGap = 8f
    const val FileUploadFieldGap = 8f
    const val FileUploadCaptionFontSize = 14f
    const val FileUploadCaptionLineHeight = 12f
    const val FileUploadCaptionFontWeight = 500f
    const val FileUploadCaptionLetterSpacing = 0f
    const val FileUploadAreaRadius = 24f
    const val FileUploadAreaPaddingX = 96f
    const val FileUploadAreaPaddingY = 44.6f
    const val FileUploadAreaGap = 24f
    const val FileUploadAreaIllustrationWidth = 256f
    const val FileUploadAreaIllustrationHeight = 128f
    const val FileUploadAreaDragIllustrationWidth = 320f
    const val FileUploadAreaDragIllustrationHeight = 160f
    const val FileUploadAreaTitleFontSize = 24f
    const val FileUploadAreaTitleLineHeight = 24f
    const val FileUploadAreaTitleFontWeight = 500f
    const val FileUploadAreaTitleLetterSpacing = -0.5f
    const val FileUploadAreaHeight = 381.2f
    const val FileUploadAreaArtworkDefaultWidth = 256f
    const val FileUploadAreaArtworkDefaultHeight = 146f
    const val FileUploadAreaArtworkDefaultOffsetY = 0f
    const val FileUploadAreaArtworkHoverWidth = 256f
    const val FileUploadAreaArtworkHoverHeight = 180f
    const val FileUploadAreaArtworkHoverOffsetY = -8.4176025390625f
    const val FileUploadAreaArtworkSelectedWidth = 256f
    const val FileUploadAreaArtworkSelectedHeight = 144f
    const val FileUploadAreaArtworkSelectedOffsetY = 0f
    const val FileUploadAreaArtworkDragWidth = 320f
    const val FileUploadAreaArtworkDragHeight = 182f
    const val FileUploadAreaArtworkDragOffsetY = 0f
    const val FileUploadRolesBackground = "bg-primary"
    const val FileUploadRolesBorder = "border-base"
    const val FileUploadRolesDragBorder = "border-accent"
    const val FileUploadRolesDragBackground = "fill-brand-primary"
    const val FileUploadRolesHover = "fill-quaternary"
    const val FileUploadRolesLabel = "label-primary"
    const val FileUploadRolesSecondary = "label-secondary"
    const val FileUploadRolesDisabled = "label-quaternary"
    const val FileUploadRolesDanger = "label-danger"
    const val FileUploadRolesFocus = "border-focus"
    const val ColorPickerWidth = 390f
    const val ColorPickerPadding = 24f
    const val ColorPickerGap = 16f
    const val ColorPickerRadius = 32f
    const val ColorPickerCornerSmoothing = 0.6f
    val ColorPickerMaterial get() = LabMaterials.elevated
    const val ColorPickerHeaderHeight = 24f
    const val ColorPickerAreaRadius = 8f
    const val ColorPickerGridColumns = 12f
    const val ColorPickerGridRows = 10f
    const val ColorPickerGridHeight = 285f
    const val ColorPickerGridLchHeight = 342f
    const val ColorPickerGridLchColumns = 10f
    const val ColorPickerChannelTrackHeight = 32f
    const val ColorPickerChannelThumb = 24f
    const val ColorPickerChannelThumbStroke = 4f
    const val ColorPickerChannelGap = 12f
    const val ColorPickerChannelFieldWidth = 80f
    const val ColorPickerChannelLabelHeight = 12f
    const val ColorPickerChannelLabelGap = 8f
    const val ColorPickerChannelGraphHeight = 80f
    const val ColorPickerChannelGraphGap = 12f
    const val ColorPickerChannelSliderPaddingY = 8f
    const val ColorPickerChannelMiddleLabelGap = 12f
    const val ColorPickerChannelGraphLabelGap = 12f
    const val ColorPickerFooterHeight = 48f
    const val ColorPickerFooterGap = 8f
    const val ColorPickerFooterModelWidth = 96f
    const val ColorPickerFooterRadius = 12f
    const val ColorPickerLchLightnessMax = 100f
    const val ColorPickerLchChromaMax = 145f
    const val ColorPickerLchHueMax = 360f
    const val ColorPickerLchChromaMaxRec2020 = 195f
    const val ColorPickerHeadingFontSize = 16f
    const val ColorPickerHeadingLineHeight = 24f
    const val ColorPickerHeadingFontWeight = 500f
    const val ColorPickerHeadingLetterSpacing = 0f
    const val ColorPickerTextFontSize = 16f
    const val ColorPickerTextLineHeight = 24f
    const val ColorPickerTextFontWeight = 400f
    const val ColorPickerTextLetterSpacing = -0.25f
    const val ColorPickerRolesLabel = "label-primary"
    const val ColorPickerRolesSecondary = "label-secondary"
    const val ColorPickerRolesBorder = "border-base"
    const val ColorPickerRolesField = "fill-quaternary"
    const val ColorPickerRolesFocus = "border-focus"
    const val ColorPickerRolesAccent = "label-accent"
    val ColorPickerSwatches = listOf(listOf(1f, 1f, 1f), listOf(0.9215686321258545f, 0.9215686321258545f, 0.9215686321258545f), listOf(0.8381409049034119f, 0.8381409049034119f, 0.8381409049034119f), listOf(0.7607843279838562f, 0.7607843279838562f, 0.7607843279838562f), listOf(0.6784313917160034f, 0.6784313917160034f, 0.6784313917160034f), listOf(0.6000000238418579f, 0.6000000238418579f, 0.6000000238418579f), listOf(0.5215686559677124f, 0.5215686559677124f, 0.5215686559677124f), listOf(0.43921568989753723f, 0.43921568989753723f, 0.43921568989753723f), listOf(0.3607843220233917f, 0.3607843220233917f, 0.3607843220233917f), listOf(0.27843138575553894f, 0.27843138575553894f, 0.27843138575553894f), listOf(0.20000000298023224f, 0.20000000298023224f, 0.20000000298023224f), listOf(0f, 0f, 0f), listOf(0.003921568859368563f, 0.21568627655506134f, 0.2862745225429535f), listOf(0f, 0.10980392247438431f, 0.3450980484485626f), listOf(0.06666667014360428f, 0.01568627543747425f, 0.23137255012989044f), listOf(0.18039216101169586f, 0.019607843831181526f, 0.239215686917305f), listOf(0.23137255012989044f, 0.0313725508749485f, 0.10196078568696976f), listOf(0.3607843220233917f, 0.027450980618596077f, 0f), listOf(0.3529411852359772f, 0.10196078568696976f, 0f), listOf(0.3450980484485626f, 0.20000000298023224f, 0f), listOf(0.3333333432674408f, 0.239215686917305f, 0f), listOf(0.4000000059604645f, 0.3803921639919281f, 0f), listOf(0.30980393290519714f, 0.3333333432674408f, 0.01568627543747425f), listOf(0.1411764770746231f, 0.24313725531101227f, 0.05098039284348488f), listOf(0f, 0.3019607961177826f, 0.3960784375667572f), listOf(0.003921568859368563f, 0.18431372940540314f, 0.48235294222831726f), listOf(0.09803921729326248f, 0.03529411926865578f, 0.32549020648002625f), listOf(0.2705882489681244f, 0.054901961237192154f, 0.3490196168422699f), listOf(0.3294117748737335f, 0.062745101749897f, 0.16078431904315948f), listOf(0.5137255191802979f, 0.06666667014360428f, 0f), listOf(0.48235294222831726f, 0.16078431904315948f, 0f), listOf(0.47843137383461f, 0.2862745225429535f, 0f), listOf(0.47058823704719543f, 0.3450980484485626f, 0f), listOf(0.5490196347236633f, 0.5215686559677124f, 0f), listOf(0.43529412150382996f, 0.4627451002597809f, 0.0235294122248888f), listOf(0.2235294133424759f, 0.33725491166114807f, 0.09803921729326248f), listOf(0f, 0.4313725531101227f, 0.5568627715110779f), listOf(0f, 0.25882354378700256f, 0.6627451181411743f), listOf(0.1725490242242813f, 0.027450980618596077f, 0.46666666865348816f), listOf(0.3803921639919281f, 0.0941176488995552f, 0.48627451062202454f), listOf(0.4745098054409027f, 0.09803921729326248f, 0.239215686917305f), listOf(0.7058823704719543f, 0.10196078568696976f, 0f), listOf(0.6784313917160034f, 0.24705882370471954f, 0f), listOf(0.6627451181411743f, 0.40784314274787903f, 0f), listOf(0.6470588445663452f, 0.48235294222831726f, 0.003921568859368563f), listOf(0.772549033164978f, 0.7372549176216125f, 0f), listOf(0.6078431606292725f, 0.6431372761726379f, 0.05882352963089943f), listOf(0.30588236451148987f, 0.47843137383461f, 0.1568627506494522f), listOf(0f, 0.5490196347236633f, 0.7058823704719543f), listOf(0.003921568859368563f, 0.33725491166114807f, 0.8392156958580017f), listOf(0.21568627655506134f, 0.10196078568696976f, 0.5803921818733215f), listOf(0.47843137383461f, 0.125490203499794f, 0.6196078658103943f), listOf(0.6000000238418579f, 0.1411764770746231f, 0.30980393290519714f), listOf(0.886274516582489f, 0.1411764770746231f, 0f), listOf(0.8549019694328308f, 0.3176470696926117f, 0f), listOf(0.8274509906768799f, 0.5098039507865906f, 0f), listOf(0.8196078538894653f, 0.615686297416687f, 0.003921568859368563f), listOf(0.9607843160629272f, 0.9254902005195618f, 0f), listOf(0.7647058963775635f, 0.8196078538894653f, 0.08627451211214066f), listOf(0.3960784375667572f, 0.615686297416687f, 0.20392157137393951f), listOf(0f, 0.6313725709915161f, 0.8470588326454163f), listOf(0f, 0.3803921639919281f, 0.9960784316062927f), listOf(0.3019607961177826f, 0.12941177189350128f, 0.6941176652908325f), listOf(0.5960784554481506f, 0.16470588743686676f, 0.7411764860153198f), listOf(0.7254902124404907f, 0.1764705926179886f, 0.364705890417099f), listOf(1f, 0.24313725531101227f, 0.08235294371843338f), listOf(1f, 0.4156862795352936f, 0f), listOf(1f, 0.6666666865348816f, 0.003921568859368563f), listOf(0.9960784316062927f, 0.7803921699523926f, 0f), listOf(0.9921568632125854f, 0.9843137264251709f, 0.25882354378700256f), listOf(0.8549019694328308f, 0.9254902005195618f, 0.21568627655506134f), listOf(0.46666666865348816f, 0.7333333492279053f, 0.2549019753932953f), listOf(0.01568627543747425f, 0.7803921699523926f, 0.9882352948188782f), listOf(0.23137255012989044f, 0.5254902243614197f, 0.9960784316062927f), listOf(0.3686274588108063f, 0.18431372940540314f, 0.9215686321258545f), listOf(0.7450980544090271f, 0.2235294133424759f, 0.9529411792755127f), listOf(0.9019607901573181f, 0.23137255012989044f, 0.47843137383461f), listOf(1f, 0.3803921639919281f, 0.3176470696926117f), listOf(1f, 0.5254902243614197f, 0.2823529541492462f), listOf(0.9960784316062927f, 0.7058823704719543f, 0.24705882370471954f), listOf(0.9960784316062927f, 0.7960784435272217f, 0.24313725531101227f), listOf(1f, 0.9686274528503418f, 0.42352941632270813f), listOf(0.8941176533699036f, 0.9372549057006836f, 0.3960784375667572f), listOf(0.5882353186607361f, 0.8274509906768799f, 0.37254902720451355f), listOf(0.32156863808631897f, 0.8392156958580017f, 0.9882352948188782f), listOf(0.45490196347236633f, 0.6509804129600525f, 1f), listOf(0.5254902243614197f, 0.30980393290519714f, 0.9960784316062927f), listOf(0.8235294222831726f, 0.34117648005485535f, 0.9960784316062927f), listOf(0.9333333373069763f, 0.4431372582912445f, 0.615686297416687f), listOf(1f, 0.5490196347236633f, 0.5098039507865906f), listOf(1f, 0.6431372761726379f, 0.4901960790157318f), listOf(1f, 0.7803921699523926f, 0.4627451002597809f), listOf(1f, 0.8509804010391235f, 0.46666666865348816f), listOf(1f, 0.9764705896377563f, 0.5764706134796143f), listOf(0.9137254953384399f, 0.9490196108818054f, 0.5568627715110779f), listOf(0.6941176652908325f, 0.8666666746139526f, 0.5411764979362488f), listOf(0.572549045085907f, 0.8901960849761963f, 0.9921568632125854f), listOf(0.6509804129600525f, 0.7764706015586853f, 1f), listOf(0.6901960968971252f, 0.5490196347236633f, 0.9960784316062927f), listOf(0.886274516582489f, 0.572549045085907f, 0.9960784316062927f), listOf(0.95686274766922f, 0.6431372761726379f, 0.7529411911964417f), listOf(1f, 0.7098039388656616f, 0.686274528503418f), listOf(1f, 0.772549033164978f, 0.6705882549285889f), listOf(1f, 0.8509804010391235f, 0.6549019813537598f), listOf(0.9960784316062927f, 0.8941176533699036f, 0.658823549747467f), listOf(1f, 0.9843137264251709f, 0.7254902124404907f), listOf(0.9490196108818054f, 0.9686274528503418f, 0.7176470756530762f), listOf(0.8039215803146362f, 0.9098039269447327f, 0.7098039388656616f), listOf(0.7960784435272217f, 0.9411764740943909f, 1f), listOf(0.8274509906768799f, 0.8823529481887817f, 1f), listOf(0.8509804010391235f, 0.7882353067398071f, 0.9960784316062927f), listOf(0.9372549057006836f, 0.7921568751335144f, 1f), listOf(0.9764705896377563f, 0.8274509906768799f, 0.8823529481887817f), listOf(1f, 0.8588235378265381f, 0.8470588326454163f), listOf(1f, 0.886274516582489f, 0.8352941274642944f), listOf(1f, 0.9254902005195618f, 0.8313725590705872f), listOf(1f, 0.9490196108818054f, 0.8352941274642944f), listOf(0.9960784316062927f, 0.9882352948188782f, 0.8666666746139526f), listOf(0.9725490212440491f, 0.9803921580314636f, 0.8588235378265381f), listOf(0.8745098114013672f, 0.9333333373069763f, 0.8313725590705872f))
    val ColorPickerLchSwatches = listOf(listOf(1f, 1f, 1f), listOf(0.9399999976158142f, 0.9399999976158142f, 0.9399999976158142f), listOf(0.800000011920929f, 0.800000011920929f, 0.800000011920929f), listOf(0.6705882549285889f, 0.6705882549285889f, 0.6705882549285889f), listOf(0.572549045085907f, 0.572549045085907f, 0.572549045085907f), listOf(0.4901960790157318f, 0.4901960790157318f, 0.4901960790157318f), listOf(0.364705890417099f, 0.364705890417099f, 0.364705890417099f), listOf(0.250980406999588f, 0.250980406999588f, 0.250980406999588f), listOf(0.14901961386203766f, 0.14901961386203766f, 0.14901961386203766f), listOf(0.07999999821186066f, 0.07999999821186066f, 0.07999999821186066f), listOf(1f, 0.9576923251152039f, 0.949999988079071f), listOf(1f, 0.8556603789329529f, 0.8299999833106995f), listOf(1f, 0.6945454478263855f, 0.6399999856948853f), listOf(1f, 0.45571431517601013f, 0.3700000047683716f), listOf(1f, 0.26274511218070984f, 0.1764705926179886f), listOf(0.8666666746139526f, 0.21568627655506134f, 0.1411764770746231f), listOf(0.6549019813537598f, 0.1568627506494522f, 0.10196078568696976f), listOf(0.45490196347236633f, 0.10588235408067703f, 0.062745101749897f), listOf(0.27843138575553894f, 0.062745101749897f, 0.03921568766236305f), listOf(0.18000000715255737f, 0.036000002175569534f, 0.020571429282426834f), listOf(1f, 0.95333331823349f, 0.9200000166893005f), listOf(1f, 0.8774999976158142f, 0.7900000214576721f), listOf(1f, 0.737500011920929f, 0.550000011920929f), listOf(0.9800000190734863f, 0.5406013131141663f, 0.2267451137304306f), listOf(0.9019607901573181f, 0.40392157435417175f, 0f), listOf(0.7764706015586853f, 0.3450980484485626f, 0f), listOf(0.5882353186607361f, 0.2549019753932953f, 0f), listOf(0.40784314274787903f, 0.16862745583057404f, 0f), listOf(0.25882354378700256f, 0.0941176488995552f, 0f), listOf(0.17000000178813934f, 0.044999998062849045f, 0f), listOf(1f, 0.9446808695793152f, 0.8700000047683716f), listOf(1f, 0.8612244725227356f, 0.6600000262260437f), listOf(0.9800000190734863f, 0.792847216129303f, 0.44099998474121094f), listOf(0.8999999761581421f, 0.6200000047683716f, 0f), listOf(0.7568627595901489f, 0.5215686559677124f, 0f), listOf(0.6196078658103943f, 0.4627451002597809f, 0f), listOf(0.4588235318660736f, 0.3490196168422699f, 0f), listOf(0.32549020648002625f, 0.23137255012989044f, 0f), listOf(0.20000000298023224f, 0.13725490868091583f, 0f), listOf(0.14000000059604645f, 0.08959999680519104f, 0f), listOf(0.8765000104904175f, 1f, 0.8700000047683716f), listOf(0.7270897626876831f, 0.95686274766922f, 0.7176470756530762f), listOf(0.4905259311199188f, 0.8784313797950745f, 0.48313724994659424f), listOf(0.21176470816135406f, 0.800000011920929f, 0.239215686917305f), listOf(0f, 0.6941176652908325f, 0.11372549086809158f), listOf(0f, 0.5960784554481506f, 0.09019608050584793f), listOf(0f, 0.4470588266849518f, 0.054901961237192154f), listOf(0f, 0.30980393290519714f, 0.027450980618596077f), listOf(0.8196078538894653f, 0.615686297416687f, 0.003921568859368563f), listOf(0.016956521198153496f, 0.12999999523162842f, 0.016956521198153496f), listOf(0.8799999952316284f, 0.99647057056427f, 1f), listOf(0.7080784440040588f, 0.9485698938369751f, 0.95686274766922f), listOf(0.31568628549575806f, 0.8840397596359253f, 0.9019607901573181f), listOf(0f, 0.7607843279838562f, 0.7882353067398071f), listOf(0f, 0.6509804129600525f, 0.6745098233222961f), listOf(0f, 0.5607843399047852f, 0.5803921818733215f), listOf(0f, 0.41960784792900085f, 0.43529412150382996f), listOf(0f, 0.29019609093666077f, 0.2980392277240753f), listOf(0f, 0.1764705926179886f, 0.18431372940540314f), listOf(0f, 0.12434782832860947f, 0.12999999523162842f), listOf(0.9399999976158142f, 0.9710344672203064f, 1f), listOf(0.8100000023841858f, 0.9081666469573975f, 1f), listOf(0.5799999833106995f, 0.7976363897323608f, 1f), listOf(0.34117648005485535f, 0.6980392336845398f, 1f), listOf(0f, 0.5960784554481506f, 0.9607843160629272f), listOf(0f, 0.5098039507865906f, 0.8274509906768799f), listOf(0f, 0.3803921639919281f, 0.6274510025978088f), listOf(0f, 0.25882354378700256f, 0.43921568989753723f), listOf(0f, 0.1568627506494522f, 0.27843138575553894f), listOf(0f, 0.09756757318973541f, 0.1899999976158142f), listOf(0.9599999785423279f, 0.9676190614700317f, 1f), listOf(0.8799999952316284f, 0.9023255705833435f, 1f), listOf(0.7300000190734863f, 0.7761842012405396f, 1f), listOf(0.5764706134796143f, 0.6392157077789307f, 1f), listOf(0.4588235318660736f, 0.5137255191802979f, 1f), listOf(0.3764705955982208f, 0.4117647111415863f, 0.95686274766922f), listOf(0.27843138575553894f, 0.30588236451148987f, 0.7215686440467834f), listOf(0.1882352977991104f, 0.2078431397676468f, 0.501960813999176f), listOf(0.10980392247438431f, 0.125490203499794f, 0.30980393290519714f), listOf(0.05846153944730759f, 0.07307691872119904f, 0.1899999976158142f), listOf(0.9752380847930908f, 0.9599999785423279f, 1f), listOf(0.9285714030265808f, 0.8799999952316284f, 1f), listOf(0.8492207527160645f, 0.7300000190734863f, 1f), listOf(0.7607843279838562f, 0.5529412031173706f, 1f), listOf(0.6941176652908325f, 0.38823530077934265f, 1f), listOf(0.6000000238418579f, 0.32549020648002625f, 0.8705882430076599f), listOf(0.45098039507865906f, 0.239215686917305f, 0.6549019813537598f), listOf(0.30980393290519714f, 0.16078431904315948f, 0.45490196347236633f), listOf(0.19607843458652496f, 0.0941176488995552f, 0.2705882489681244f), listOf(0.11314286291599274f, 0.05657143145799637f, 0.18000000715255737f), listOf(1f, 0.949999988079071f, 0.9961538314819336f), listOf(1f, 0.8399999737739563f, 0.9909433722496033f), listOf(1f, 0.6299999952316284f, 0.9891176223754883f), listOf(0.9450980424880981f, 0.4313725531101227f, 0.9372549057006836f), listOf(0.8509804010391235f, 0.2980392277240753f, 0.8509804010391235f), listOf(0.729411780834198f, 0.26274511218070984f, 0.7254902124404907f), listOf(0.5490196347236633f, 0.1921568661928177f, 0.545098066329956f), listOf(0.3803921639919281f, 0.125490203499794f, 0.3764705955982208f), listOf(0.23137255012989044f, 0.0784313753247261f, 0.23137255012989044f), listOf(0.15000000596046448f, 0.04137931391596794f, 0.15000000596046448f))
    val CalendarS = LabCalendarMetrics(320f, 380f, 16f, 4f, 24f, 8f, 8f, 6f)
    val CalendarM = LabCalendarMetrics(400f, 560f, 24f, 8f, 40f, 12f, 12f, 3f)
    const val CalendarRadius = 24f
    const val CalendarStroke = 1f
    const val CalendarGap = 8f
    const val CalendarColumns = 7f
    const val CalendarWeeks = 6f
    const val CalendarCell = 35f
    const val CalendarIcon = 16f
    val CalendarMaterial get() = LabMaterials.base
    const val CalendarTypographySTitleFontSize = 16f
    const val CalendarTypographySTitleLineHeight = 24f
    const val CalendarTypographySTitleFontWeight = 500f
    const val CalendarTypographySTitleLetterSpacing = 0f
    const val CalendarTypographyMTitleFontSize = 20f
    const val CalendarTypographyMTitleLineHeight = 20f
    const val CalendarTypographyMTitleFontWeight = 600f
    const val CalendarTypographyMTitleLetterSpacing = -0.33f
    const val CalendarTypographySDayFontSize = 14f
    const val CalendarTypographySDayLineHeight = 12f
    const val CalendarTypographySDayFontWeight = 500f
    const val CalendarTypographySDayLetterSpacing = 0f
    const val CalendarTypographyMDayFontSize = 16f
    const val CalendarTypographyMDayLineHeight = 24f
    const val CalendarTypographyMDayFontWeight = 500f
    const val CalendarTypographyMDayLetterSpacing = 0f
    const val CalendarTypographySWeekdayFontSize = 12f
    const val CalendarTypographySWeekdayLineHeight = 12f
    const val CalendarTypographySWeekdayFontWeight = 500f
    const val CalendarTypographySWeekdayLetterSpacing = 0f
    const val CalendarTypographyMWeekdayFontSize = 14f
    const val CalendarTypographyMWeekdayLineHeight = 12f
    const val CalendarTypographyMWeekdayFontWeight = 500f
    const val CalendarTypographyMWeekdayLetterSpacing = 0f
    const val CalendarRolesLabel = "label-primary"
    const val CalendarRolesSecondary = "label-secondary"
    const val CalendarRolesDisabled = "label-quaternary"
    const val CalendarRolesHeader = "bg-grouped-secondary"
    const val CalendarRolesBorder = "border-base"
    const val CalendarRolesHover = "fill-quaternary"
    const val CalendarRolesActive = "bg-inverted"
    const val CalendarRolesActiveLabel = "label-inverted-primary"
    const val CalendarRolesFocus = "fx-focus-ring-neutral"
    const val CalendarRangeEdgePadding = 8f
    const val CalendarRangeInnerPadding = 2f
    const val CalendarRangeMarkerHeight = 12f
    const val CalendarRangeMarkerStroke = 2f
    const val CalendarRangeMarkerInset = 6f
    const val CalendarFocusWidth = 1f
    const val CalendarFocusOffset = 1f
    const val CalendarMarkerSize = 16f
    const val CalendarMarkerPadding = 1f
    const val CalendarMarkerBottom = -7f
    const val CalendarMarkerStroke = 1f
    const val CalendarMarkerSurfaceRole = "bg-inverted"
    const val CalendarMarkerLabelRole = "label-inverted-primary"
    const val CalendarMarkerActiveSurfaceRole = "bg-primary"
    const val CalendarMarkerActiveLabelRole = "label-primary"
    const val CalendarMarkerActiveBorderRole = "border-strong"
    const val CalendarDotsSize = 4f
    const val CalendarDotsCount = 5f
    const val CalendarDotsWidth = 20f
    const val CalendarDotsGap = 0f
    const val CalendarDotsRolesDefault = "label-secondary"
    const val CalendarDotsRolesDisabled = "label-quaternary"
    const val CalendarDotsRolesActive = "label-inverted-primary"
    const val CalendarDotsGlyphViewBox = 4f
    const val CalendarDotsGlyphX = 0f
    const val CalendarDotsGlyphY = 0f
    // Shared contour: transform the canvas, never mutate this path.
    val CalendarDotsGlyphPath by lazy { androidx.compose.ui.graphics.Path().apply {
        moveTo(2f, 0f)
        cubicTo(3.10457f, 0f, 4f, 0.89543f, 4f, 2f)
        cubicTo(4f, 3.10457f, 3.10457f, 4f, 2f, 4f)
        cubicTo(1.46661f, 4f, 0.983573f, 3.78954f, 0.625f, 3.44922f)
        cubicTo(0.862809f, 3.01939f, 1f, 2.52601f, 1f, 2f)
        cubicTo(1f, 1.47369f, 0.863066f, 0.979809f, 0.625f, 0.549805f)
        cubicTo(0.983524f, 0.209758f, 1.46686f, 0f, 2f, 0f)
        close()
    } }
}
