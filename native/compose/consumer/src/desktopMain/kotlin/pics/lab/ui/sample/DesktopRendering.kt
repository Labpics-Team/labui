package pics.lab.ui.sample

/** Configure Skiko before creating a window; render backend policy belongs to the application. */
internal fun configureDesktopRendering() {
    val windows = System.getProperty("os.name").startsWith("Windows", ignoreCase = true)
    val x64 = System.getProperty("os.arch").lowercase() in setOf("amd64", "x86_64")
    if (windows && x64 && System.getProperty("skiko.renderApi") == null && System.getenv("SKIKO_RENDER_API") == null) {
        // Haze's progressive shader takes 26–29s on the first Direct3D flush with Skiko 0.150.2.
        // OpenGL renders the same first frame in 225ms and retains Skiko's software fallback.
        System.setProperty("skiko.renderApi", "OPENGL")
    }
}
