package pics.lab.ui.example

import android.os.Bundle
import android.view.WindowInsetsController
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import pics.lab.ui.LabAppearance
import pics.lab.ui.sample.NativeSettingsScreen
import pics.lab.ui.sample.androidWorkspaceStore

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val store = androidWorkspaceStore(this)
        setContent {
            val settings by store.data.collectAsState(initial = null)
            val light = settings?.display?.preferences?.appearance != LabAppearance.Dark
            SideEffect {
                val flags =
                    WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS or
                        WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                window.insetsController?.setSystemBarsAppearance(if (light) flags else 0, flags)
            }
            NativeSettingsScreen(store)
        }
    }
}
