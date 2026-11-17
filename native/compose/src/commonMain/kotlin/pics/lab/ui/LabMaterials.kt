// Generated from packages/materials/src/profile.json. Do not edit.
package pics.lab.ui

import androidx.compose.ui.graphics.BlendMode

public object LabMaterials {
    internal val lightPaintBlend = BlendMode.ColorDodge
    internal val darkPaintBlend = BlendMode.Overlay
    internal val noiseBlend = BlendMode.Screen
    internal const val noisePixelSize = 0.2f
    internal const val noiseOpacity = 0.04f
    internal const val veilNoiseOpacity = 0.06f
    public val subtle = LabMaterialRecipe(
        solidRole = "bg-primary", normalRole = "bg-material-subtle-01", blendRole = "bg-material-subtle-02",
        backdropRadius = 12f, frost = 12f, depth = 80f,
        refraction = 1f, dispersion = 0.6f, lightAngle = -45f, lightIntensity = 0.05f,
    )
    public val soft = LabMaterialRecipe(
        solidRole = "bg-secondary", normalRole = "bg-material-soft-01", blendRole = "bg-material-soft-02",
        backdropRadius = 24f, frost = 12f, depth = 60f,
        refraction = 0.8f, dispersion = 0.6f, lightAngle = 0f, lightIntensity = 0.1f,
    )
    public val muted = LabMaterialRecipe(
        solidRole = "bg-tertiary", normalRole = "bg-material-muted-01", blendRole = "bg-material-muted-02",
        backdropRadius = 48f, frost = 20f, depth = 60f,
        refraction = 0.8f, dispersion = 0.6f, lightAngle = 0f, lightIntensity = 0.2f,
    )
    public val base = LabMaterialRecipe(
        solidRole = "bg-grouped-primary", normalRole = "bg-material-base-01", blendRole = "bg-material-base-02",
        backdropRadius = 48f, frost = 20f, depth = 60f,
        refraction = 0.8f, dispersion = 0.6f, lightAngle = 0f, lightIntensity = 0.2f,
    )
    public val elevated = LabMaterialRecipe(
        solidRole = "bg-grouped-secondary", normalRole = "bg-material-elevated-01", blendRole = "bg-material-elevated-02",
        backdropRadius = 128f, frost = 25f, depth = 100f,
        refraction = 1f, dispersion = 0.6f, lightAngle = 0f, lightIntensity = 0.25f,
    )
}

public object LabShadows {
    internal const val lightAngle = 0f
    internal const val darkAlphaMultiplier = 1f
    public val xs = listOf(
        LabShadowLayer(0f, 0f, 1f, 0f, "bg-static-dark", 0.12f),
        LabShadowLayer(0f, 1f, 1f, 0f, "bg-static-dark", 0.04f),
        LabShadowLayer(0f, 2f, 2f, 0f, "bg-static-dark", 0.02f),
        LabShadowLayer(0f, 4f, 2f, 0f, "bg-static-dark", 0.01f),
    )
    public val s = listOf(
        LabShadowLayer(0f, 1f, 2f, 0f, "bg-static-dark", 0.12f),
        LabShadowLayer(0f, 2f, 2f, 0f, "bg-static-dark", 0.04f),
        LabShadowLayer(0f, 4f, 4f, 0f, "bg-static-dark", 0.02f),
        LabShadowLayer(0f, 12f, 8f, 0f, "bg-static-dark", 0.01f),
    )
    public val m = listOf(
        LabShadowLayer(0f, 1f, 2f, 0f, "bg-static-dark", 0.12f),
        LabShadowLayer(0f, 4f, 4f, 0f, "bg-static-dark", 0.04f),
        LabShadowLayer(0f, 12f, 8f, 0f, "bg-static-dark", 0.02f),
        LabShadowLayer(0f, 24f, 12f, 0f, "bg-static-dark", 0.01f),
    )
    public val l = listOf(
        LabShadowLayer(0f, 4f, 8f, 0f, "bg-static-dark", 0.12f),
        LabShadowLayer(0f, 12f, 12f, 0f, "bg-static-dark", 0.04f),
        LabShadowLayer(0f, 24f, 16f, 0f, "bg-static-dark", 0.02f),
        LabShadowLayer(0f, 48f, 24f, 0f, "bg-static-dark", 0.01f),
    )
    public val xl = listOf(
        LabShadowLayer(0f, 16f, 36f, 0f, "bg-static-dark", 0.12f),
        LabShadowLayer(0f, 24f, 48f, 0f, "bg-static-dark", 0.04f),
        LabShadowLayer(0f, 36f, 64f, 0f, "bg-static-dark", 0.02f),
        LabShadowLayer(0f, 48f, 96f, 0f, "bg-static-dark", 0.01f),
    )
    public val resting = xs
    public val raised = s
    public val overlay = l
    public val modal = xl
}

public object LabVeils {
    internal const val startX = 0.5f
    internal const val startY = 1f
    internal const val endX = 0.5f
    internal const val endY = 0f
    public val ghost = listOf(
        LabVeilPass(0f, 4f, 0.04f),
    )
    public val soft = listOf(
        LabVeilPass(0f, 12f, 0.06f),
    )
    public val strong = listOf(
        LabVeilPass(0f, 24f, 0.06f),
        LabVeilPass(0f, 24f, 0.06f),
    )
    public val overlayGhost = listOf(
        LabVeilPass(0f, 24f, 0.06f),
    )
}
