package pics.lab.ui.sample

import java.awt.EventQueue
import java.awt.Window
import java.beans.PropertyChangeListener
import java.io.File
import java.util.IdentityHashMap
import javax.accessibility.AccessibleContext
import javax.accessibility.AccessibleEditableText
import javax.accessibility.AccessibleRole
import javax.accessibility.AccessibleState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/** Exercises the visible installed window through the same Java Accessibility API as the bridge. */
internal suspend fun verifyDesktopWindow(window: Window) = withContext(Dispatchers.IO) {
    val events = mutableListOf<String>()
    val observed = IdentityHashMap<AccessibleContext, PropertyChangeListener>()
    fun tree(): List<AccessibleContext> = onEventThread {
        buildList {
            fun visit(node: AccessibleContext?) {
                if (node == null) return
                add(node)
                if (!observed.containsKey(node)) {
                    val listener = PropertyChangeListener { event ->
                        synchronized(events) { events.add("${node.accessibleName}: ${event.propertyName}: ${event.newValue}") }
                    }
                    node.addPropertyChangeListener(listener)
                    observed[node] = listener
                }
                repeat(node.accessibleChildrenCount) { visit(node.getAccessibleChild(it)?.accessibleContext) }
            }
            visit(window.accessibleContext)
        }
    }
    suspend fun find(name: String, role: AccessibleRole? = null): AccessibleContext {
        repeat(250) {
            tree().firstOrNull { it.accessibleName == name && (role == null || it.accessibleRole == role) }?.let { return it }
            delay(20)
        }
        error("Accessible node missing: $name; available: ${tree().map { it.accessibleName }}")
    }
    fun click(node: AccessibleContext) = onEventThread {
        check(node.accessibleAction?.doAccessibleAction(0) == true) { "No accepted accessible action: ${node.accessibleName}" }
    }
    fun edit(node: AccessibleContext, value: String) = onEventThread {
        val editable = node.accessibleText as? AccessibleEditableText ?: error("No editable text: ${node.accessibleName}")
        editable.setTextContents(value)
    }
    try {
        click(find("Параметры проекта", AccessibleRole.PUSH_BUTTON))
        val close = find("Закрыть", AccessibleRole.PUSH_BUTTON)
        repeat(100) {
            if (onEventThread { close.accessibleStateSet.contains(AccessibleState.FOCUSED) }) return@repeat
            delay(20)
        }
        check(onEventThread { close.accessibleStateSet.contains(AccessibleState.FOCUSED) }) { "Sheet did not receive focus" }
        edit(find("Название проекта", AccessibleRole.TEXT), "")
        click(find("Сохранить изменения", AccessibleRole.PUSH_BUTTON))
        find("Введите название проекта")
        edit(find("Название проекта", AccessibleRole.TEXT), "Нативная лаборатория 東京")
        click(find("Сохранить изменения", AccessibleRole.PUSH_BUTTON))
        find("Изменения сохранены")
        val trigger = find("Параметры проекта", AccessibleRole.PUSH_BUTTON)
        check(onEventThread { trigger.accessibleStateSet.contains(AccessibleState.FOCUSED) }) { "Focus did not return to the initiating action" }
        File("build").mkdirs()
        File("build/accessibility-events.txt").writeText(synchronized(events) { events.joinToString("\n") })
        check(events.any { it.contains(AccessibleContext.ACCESSIBLE_TEXT_PROPERTY) }) { "No text event reached Java Accessibility" }
        check(events.any { it.contains(AccessibleContext.ACCESSIBLE_STATE_PROPERTY) && it.contains("focused") }) { "No focus event reached Java Accessibility" }
        println("NATIVE_SCENARIO_PASS: input, validation, save, focus and Java Accessibility events")
    } finally {
        onEventThread { observed.forEach { (node, listener) -> node.removePropertyChangeListener(listener) } }
    }
}

private fun <T> onEventThread(block: () -> T): T {
    if (EventQueue.isDispatchThread()) return block()
    var result: Result<T>? = null
    EventQueue.invokeAndWait { result = runCatching(block) }
    return result!!.getOrThrow()
}
