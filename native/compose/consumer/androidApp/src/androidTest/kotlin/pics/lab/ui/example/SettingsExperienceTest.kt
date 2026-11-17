package pics.lab.ui.example

import android.view.KeyEvent
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
}
