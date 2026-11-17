package pics.lab.ui.example

import android.content.Intent
import android.view.KeyEvent
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.uiautomator.By
import androidx.test.uiautomator.BySelector
import androidx.test.uiautomator.Direction
import androidx.test.uiautomator.UiDevice
import androidx.test.uiautomator.UiObject2
import androidx.test.uiautomator.Until
import java.io.ByteArrayOutputStream
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class SettingsExperienceTest {
    @Test
    fun editValidateAndSaveThroughNativeAccessibility() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val context = instrumentation.targetContext
        val device = UiDevice.getInstance(instrumentation)
        context.startActivity(
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        fun find(selector: BySelector): UiObject2 =
            checkNotNull(device.wait(Until.findObject(selector), 10_000)) {
                val hierarchy = ByteArrayOutputStream().also { device.dumpWindowHierarchy(it) }
                "Missing Android accessibility node: $selector\n$hierarchy"
            }
        fun action(label: String): UiObject2 = find(By.text(label))
        fun input(label: String): UiObject2 = find(By.desc(label))
        fun reveal(selector: BySelector, direction: Direction): UiObject2 {
            device.findObject(selector)?.let {
                return it
            }
            find(By.scrollable(true)).scrollUntil(direction, Until.findObject(selector))
            return find(selector)
        }
        fun save() = reveal(By.text("Сохранить"), Direction.DOWN).click()

        action("Редактировать").click()
        input("Название").click()
        input("Название").text = "Несохранённое название"
        device.pressBack()
        reveal(By.text("Отмена"), Direction.DOWN).click()
        find(By.text("Лаборатория"))
        action("Редактировать").click()
        val name = input("Название")
        assertTrue(name.text == "Лаборатория")
        name.click()
        name.text = ""
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
        val context = instrumentation.targetContext
        val device = UiDevice.getInstance(instrumentation)
        context.startActivity(
            Intent(context, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        assertTrue(device.wait(Until.hasObject(By.text("Нативная лаборатория 東京z")), 10_000))
        device.findObject(By.text("Редактировать")).click()
        val name = checkNotNull(device.wait(Until.findObject(By.desc("Название")), 10_000))
        assertTrue(name.text == "Нативная лаборатория 東京z")
    }
}
