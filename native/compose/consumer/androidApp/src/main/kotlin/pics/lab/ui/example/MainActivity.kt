package pics.lab.ui.example

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import pics.lab.ui.sample.NativeSettingsScreen
import pics.lab.ui.sample.androidWorkspaceStore

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = androidWorkspaceStore(this)
        setContent { NativeSettingsScreen(store) }
    }
}
