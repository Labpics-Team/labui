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
        val start = System.nanoTime()
        repeat(250) {
            val match = onEventThread {
                tree().firstOrNull { it.accessibleName == name && (role == null || it.accessibleRole == role) }
            }
            if (match != null) {
                synchronized(events) { events.add("Found $name after ${(System.nanoTime() - start) / 1_000_000} ms") }
                return match
            }
            delay(20)
        }
        error("Accessible node missing: $name; available: ${tree().map { it.accessibleName }}")
    }
    fun click(node: AccessibleContext) = onEventThread {
        check(node.accessibleAction?.doAccessibleAction(0) == true) { "No accepted accessible action: ${node.accessibleName}" }
    }
    suspend fun edit(node: AccessibleContext, value: String) {
        onEventThread {
            val editable = node.accessibleText as? AccessibleEditableText ?: error("No editable text: ${node.accessibleName}")
            editable.setTextContents(value)
        }
        repeat(250) {
            val accepted = onEventThread {
                val editable = node.accessibleText as? AccessibleEditableText
                editable != null && editable.charCount == value.length &&
                    (value.isEmpty() || editable.getTextRange(0, value.length) == value)
            }
            if (accepted) return
            delay(20)
        }
        error("Text update did not reach: ${onEventThread { node.accessibleName }}")
    }
    suspend fun awaitFocus(node: AccessibleContext) {
        repeat(250) {
            if (onEventThread { node.accessibleStateSet.contains(AccessibleState.FOCUSED) }) return
            delay(20)
        }
        error("Focus did not reach: ${onEventThread { node.accessibleName }}")
    }
    try {
        click(find("Параметры проекта", AccessibleRole.PUSH_BUTTON))
        val close = find("Закрыть", AccessibleRole.PUSH_BUTTON)
        awaitFocus(close)
        edit(find("Название проекта", AccessibleRole.TEXT), "")
        click(find("Сохранить изменения", AccessibleRole.PUSH_BUTTON))
        find("Введите название проекта")
        edit(find("Название проекта", AccessibleRole.TEXT), "Нативная лаборатория 東京")
        click(find("Сохранить изменения", AccessibleRole.PUSH_BUTTON))
        find("Изменения сохранены")
        val trigger = find("Параметры проекта", AccessibleRole.PUSH_BUTTON)
        awaitFocus(trigger)
        val acceptedEvents = synchronized(events) { events.toList() }
        check(acceptedEvents.any { it.contains(AccessibleContext.ACCESSIBLE_TEXT_PROPERTY) }) { "No text event reached Java Accessibility" }
        check(acceptedEvents.any { it.contains(AccessibleContext.ACCESSIBLE_STATE_PROPERTY) && it.contains("focused") }) { "No focus event reached Java Accessibility" }
        println("NATIVE_SCENARIO_PASS: input, validation, save, focus and Java Accessibility events")
    } finally {
        File("build").mkdirs()
        File("build/accessibility-events.txt").writeText(synchronized(events) { events.joinToString("\n") })
        onEventThread { observed.forEach { (node, listener) -> node.removePropertyChangeListener(listener) } }
    }
}

private fun <T> onEventThread(block: () -> T): T {
    if (EventQueue.isDispatchThread()) return block()
    var result: Result<T>? = null
    EventQueue.invokeAndWait { result = runCatching(block) }
    return result!!.getOrThrow()
}
