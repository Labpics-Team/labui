package pics.lab.ui.sample

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.WindowPosition
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState
import java.awt.GraphicsEnvironment
import java.awt.Toolkit

fun main(args: Array<String>) {
    configureDesktopRendering()
    if (args.any { it.startsWith("--verify") })
        require(!System.getenv("LABUI_DATA_DIR").isNullOrBlank()) {
            "Verification requires an isolated LABUI_DATA_DIR"
        }
    val store = desktopWorkspaceStore()
    application {
        val initialSize = remember {
            val screen =
                GraphicsEnvironment.getLocalGraphicsEnvironment()
                    .defaultScreenDevice
                    .defaultConfiguration
            val insets = Toolkit.getDefaultToolkit().getScreenInsets(screen)
            val width = screen.bounds.width - insets.left - insets.right
            val height = screen.bounds.height - insets.top - insets.bottom
            DpSize(minOf(900, width).dp, minOf(800, height).dp)
        }
        Window(
            onCloseRequest = ::exitApplication,
            title = "Lab UI — рабочее пространство",
            state =
                rememberWindowState(
                    size = initialSize,
                    position = WindowPosition(Alignment.Center),
                ),
        ) {
            NativeSettingsScreen(store)
            if (args.any { it.startsWith("--verify") })
                LaunchedEffect(Unit) {
                    try {
                        verifyDesktopWindow(window, restart = "--verify-restart" in args)
                    } catch (error: Throwable) {
                        error.printStackTrace()
                        kotlin.system.exitProcess(1)
                    }
                    exitApplication()
                }
        }
    }
}
