package pics.lab.ui.sample

import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Window
import androidx.compose.ui.window.application
import androidx.compose.ui.window.rememberWindowState

fun main(args: Array<String>) = application {
    Window(onCloseRequest = ::exitApplication, title = "Lab UI — рабочее пространство",
        state = rememberWindowState(width = 900.dp, height = 800.dp)) {
        SettingsScreen()
        if ("--verify" in args) LaunchedEffect(Unit) {
            try { verifyDesktopWindow(window) }
            catch (error: Throwable) { error.printStackTrace(); kotlin.system.exitProcess(1) }
            exitApplication()
        }
    }
}
