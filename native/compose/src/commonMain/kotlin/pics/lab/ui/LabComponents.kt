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

public enum class LabBadgeColor(internal val role: String) { Neutral("neutral"), Gray("gray"), Blue("blue"), Red("red"), Orange("orange"), Green("green"), Yellow("yellow"), Teal("teal"), Mint("mint"), Indigo("indigo"), Purple("purple"), Pink("pink"), StaticDark("static-dark"), StaticLight("static-light"), Brand("brand") }

public enum class LabAvatarColor(internal val role: String) { Red("avatar-fill-red"), Orange("avatar-fill-orange"), Yellow("avatar-fill-yellow"), Green("avatar-fill-green"), Teal("avatar-fill-teal"), Mint("avatar-fill-mint"), Blue("avatar-fill-blue"), Indigo("avatar-fill-indigo"), Purple("avatar-fill-purple"), Pink("avatar-fill-pink") }

public enum class LabAvatarStatus(internal val role: String?, internal val label: String) { None(null, ""), Online("label-info-primary", "В сети"), Offline("label-quaternary", "Не в сети"), Away("label-warning-primary", "Нет на месте"), Dnd("label-danger-primary", "Не беспокоить") }

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
}
