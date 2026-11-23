package pics.lab.ui.example

import android.view.KeyEvent
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ContentValues
import android.provider.MediaStore
import androidx.activity.compose.setContent
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.content.contentReceiver
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.input.TextFieldState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.rules.ActivityScenarioRule
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.BySelector
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import java.io.ByteArrayOutputStream
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestWatcher
import org.junit.runner.Description
import org.junit.runner.RunWith
import pics.lab.ui.LabPreferences
import pics.lab.ui.LabTagsInput
import pics.lab.ui.LabTheme
import pics.lab.ui.LabThemeState
import pics.lab.ui.initialLabColors
import pics.lab.ui.sample.FileUploadImportExample
import java.util.concurrent.atomic.AtomicInteger

@RunWith(AndroidJUnit4::class)
class SettingsExperienceTest {
    private val activity = ActivityScenarioRule(MainActivity::class.java)
    @get:Rule
    val rules: RuleChain =
        RuleChain.outerRule(activity)
            .around(
                object : TestWatcher() {
                    override fun finished(description: Description) {
                        val instrumentation = InstrumentationRegistry.getInstrumentation()
                        val directory = instrumentation.targetContext.getExternalFilesDir(null)
                        val device = UiDevice.getInstance(instrumentation)
                        // Run before ActivityScenario closes, including when an assertion fails.
                        device.dumpWindowHierarchy(File(directory, "verification.xml"))
                        assertTrue(device.takeScreenshot(File(directory, "verification.png")))
                    }
                }
            )

    private fun UiObject2.control(predicate: (UiObject2) -> Boolean): UiObject2 {
        var node: UiObject2? = this
        while (node != null) {
            if (predicate(node)) return node
            node = node.parent
        }
        error("No native control contains accessibility label $text / $contentDescription")
    }

    private fun UiObject2.editor(): UiObject2 = control {
        it.className == "android.widget.EditText"
    }

    private fun UiObject2.button(): UiObject2 = control { it.isClickable }

    private fun UiObject2.toggle(): UiObject2 = control { it.isCheckable }

    @Test
    fun editValidateAndSaveThroughNativeAccessibility() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val device = UiDevice.getInstance(instrumentation)
        fun find(selector: BySelector): UiObject2 =
            checkNotNull(device.wait(Until.findObject(selector), 10_000)) {
                val hierarchy = ByteArrayOutputStream().also { device.dumpWindowHierarchy(it) }
                "Missing Android accessibility node: $selector\n$hierarchy"
            }
        fun action(label: String): UiObject2 = find(By.text(label)).button()
        // Compose exposes a separate description child to preserve text + label announcements.
        // Native actions belong to the enclosing EditText/Switch, not that descriptive child.
        fun input(label: String): UiObject2 = find(By.desc(label)).editor()
        fun reveal(selector: BySelector, direction: Direction): UiObject2 {
            device.findObject(selector)?.let {
                return it
            }
            val body = find(By.clazz("android.widget.ScrollView"))
            // A Flex sheet may fit the entire form. A just-emitted validation message can
            // arrive after this first lookup without ever making the body scrollable.
            if (body.isScrollable) body.scrollUntil(direction, Until.findObject(selector))
            return find(selector)
        }
        fun save() = reveal(By.text("Сохранить"), Direction.DOWN).button().click()

        action("Редактировать").click()
        input("Название").click()
        input("Название").text = "Несохранённое название"
        assertEquals("Несохранённое название", input("Название").text)
        device.pressBack()
        reveal(By.text("Получать уведомления"), Direction.DOWN).toggle().click()
        assertTrue(!reveal(By.text("Получать уведомления"), Direction.DOWN).toggle().isChecked)
        activity.scenario.recreate()
        assertEquals(
            "Несохранённое название",
            reveal(By.desc("Название"), Direction.UP).editor().text,
        )
        assertTrue(!reveal(By.text("Получать уведомления"), Direction.DOWN).toggle().isChecked)
        reveal(By.text("Отмена"), Direction.DOWN).button().click()
        find(By.text("Лаборатория"))
        action("Редактировать").click()
        val name = input("Название")
        assertEquals("Лаборатория", name.text)
        name.click()
        name.text = ""
        assertEquals("", name.text)
        device.pressBack() // Dismiss the IME, leaving the modal open.
        save()
        reveal(By.text("Введите название"), Direction.UP)
        val editedName = input("Название")
        editedName.click()
        editedName.text = "Нативная лаборатория 東京"
        device.pressKeyCode(KeyEvent.KEYCODE_MOVE_END)
        device.pressKeyCode(KeyEvent.KEYCODE_Z)
        assertTrue(editedName.text.endsWith("東京z"))
        device.pressBack()
        save()
        find(By.text("Изменения сохранены"))
        action("Отменить").click()
        find(By.text("Изменения отменены"))
        find(By.text("Лаборатория"))
        action("Редактировать").click()
        assertEquals("Лаборатория", input("Название").text)
        input("Название").text = "Нативная лаборатория 東京z"
        save()
        assertTrue(action("Редактировать").isEnabled)
        find(By.text("Нативная лаборатория 東京z"))
    }

    @Test
    fun restoresSavedWorkspaceAfterRestart() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val device = UiDevice.getInstance(instrumentation)
        assertTrue(device.wait(Until.hasObject(By.text("Нативная лаборатория 東京z")), 10_000))
        device.findObject(By.text("Редактировать")).button().click()
        val name = checkNotNull(device.wait(Until.findObject(By.desc("Название")), 10_000)).editor()
        assertEquals("Нативная лаборатория 東京z", name.text)
    }

    @Test
    fun filePickerImportsReadsCancelsAndRemovesARealDocument() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val device = UiDevice.getInstance(instrumentation)
        val resolver = instrumentation.targetContext.contentResolver
        val expected = "Document imported through the system picker."
        val filename = "lab-upload-document.txt"
        val metadata = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, filename)
            put(MediaStore.Downloads.MIME_TYPE, "text/plain")
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val document = checkNotNull(resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, metadata))
        try {
            checkNotNull(resolver.openOutputStream(document)).use { it.write(expected.toByteArray()) }
            resolver.update(document, ContentValues().apply { put(MediaStore.Downloads.IS_PENDING, 0) }, null, null)
            activity.scenario.onActivity { host ->
                val preferences = LabPreferences(reducedMotion = true)
                val theme = LabThemeState(initialLabColors(preferences), preferences)
                host.setContent { FileUploadImportExample(theme) }
            }
            fun find(selector: BySelector): UiObject2 =
                checkNotNull(device.wait(Until.findObject(selector), 10_000)) {
                    val hierarchy = ByteArrayOutputStream().also { device.dumpWindowHierarchy(it) }
                    "Missing file-picker node: $selector\n$hierarchy"
                }
            find(By.desc("Document: No file chosen")).button().click()
            // This package belongs to the OS, not the Compose application.
            assertTrue(device.wait(Until.hasObject(By.pkg("com.google.android.documentsui")), 10_000))
            device.pressBack()
            find(By.desc("Document: No file chosen"))
            find(By.desc("Document: No file chosen")).button().click()
            find(By.desc("Show roots")).click()
            find(By.text("Downloads")).click()
            find(By.text(filename)).click()
            find(By.desc("Document: $filename"))
            find(By.text(expected)) // The application read bytes from the returned provider handle.
            find(By.desc("Document: $filename")).button().click()
            assertTrue(device.wait(Until.hasObject(By.pkg("com.google.android.documentsui")), 10_000))
            device.pressBack()
            find(By.desc("Document: $filename"))
            find(By.text(expected))
            find(By.desc("Remove $filename")).button().click()
            find(By.desc("Document: No file chosen"))
            assertTrue(device.wait(Until.gone(By.text(expected)), 5_000))
        } finally {
            resolver.delete(document, null, null)
        }
    }

    @OptIn(ExperimentalFoundationApi::class)
    @Test
    fun tagsPasteWithAncestorReceiverInsertsExactlyOnce() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val device = UiDevice.getInstance(instrumentation)
        val state = TextFieldState()
        var value by mutableStateOf(emptyList<String>())
        var addOnPaste by mutableStateOf(false)
        val callbacks = AtomicInteger()
        val ancestorReceipts = AtomicInteger()
        var previousClip: ClipData? = null
        activity.scenario.onActivity { host ->
            val clipboard = host.getSystemService(ClipboardManager::class.java)
            previousClip = clipboard.primaryClip
            clipboard.setPrimaryClip(ClipData.newPlainText("tags test", "one,two"))
            val preferences = LabPreferences(reducedMotion = true)
            val theme = LabThemeState(initialLabColors(preferences), preferences)
            host.setContent {
                LabTheme(theme) {
                    Box(Modifier.fillMaxSize().padding(32.dp).contentReceiver { content ->
                        ancestorReceipts.incrementAndGet()
                        content
                    }) {
                        LabTagsInput(value, { callbacks.incrementAndGet(); value = it }, "Tags paste",
                            state = state, addOnPaste = addOnPaste)
                    }
                }
            }
        }
        try {
            fun field() = checkNotNull(device.wait(Until.findObject(By.desc("Tags paste")), 10_000)).editor()
            field().click()
            device.pressKeyCode(KeyEvent.KEYCODE_V, KeyEvent.META_CTRL_ON)
            assertTrue(device.wait(Until.hasObject(By.text("one,two")), 10_000))
            activity.scenario.onActivity {
                assertEquals("one,two", state.text.toString())
                assertEquals(0, callbacks.get())
                assertEquals(0, ancestorReceipts.get())
                state.edit { replace(0, length, "") }
                addOnPaste = true
                it.getSystemService(ClipboardManager::class.java)
                    .setPrimaryClip(ClipData.newPlainText("tags test", "three,four"))
            }
            device.waitForIdle()
            field().click()
            device.pressKeyCode(KeyEvent.KEYCODE_V, KeyEvent.META_CTRL_ON)
            assertTrue(device.wait(Until.hasObject(By.desc("Удалить three")), 10_000))
            activity.scenario.onActivity {
                assertEquals(listOf("three", "four"), value)
                assertEquals("", state.text.toString())
                assertEquals(1, callbacks.get())
                assertEquals(0, ancestorReceipts.get())
            }
        } finally {
            activity.scenario.onActivity {
                val clipboard = it.getSystemService(ClipboardManager::class.java)
                previousClip?.let(clipboard::setPrimaryClip) ?: clipboard.clearPrimaryClip()
            }
        }
    }
}
