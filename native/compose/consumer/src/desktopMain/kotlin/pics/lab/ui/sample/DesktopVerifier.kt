package pics.lab.ui.sample

import java.awt.EventQueue
import java.awt.Rectangle
import java.awt.Robot
import java.awt.Window
import java.beans.PropertyChangeListener
import java.io.File
import java.util.IdentityHashMap
import javax.accessibility.AccessibleContext
import javax.accessibility.AccessibleEditableText
import javax.accessibility.AccessibleRole
import javax.accessibility.AccessibleState
import javax.imageio.ImageIO
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

/** Exercises the visible installed window through the same Java Accessibility API as the bridge. */
internal suspend fun verifyDesktopWindow(window: Window, restart: Boolean = false) =
    withContext(Dispatchers.IO) {
        val events = mutableListOf<String>()
        val observed = IdentityHashMap<AccessibleContext, PropertyChangeListener>()
        fun tree(): List<AccessibleContext> = onEventThread {
            buildList {
                fun visit(node: AccessibleContext?) {
                    if (node == null) return
                    add(node)
                    if (!observed.containsKey(node)) {
                        val listener = PropertyChangeListener { event ->
                            synchronized(events) {
                                events.add(
                                    "${node.accessibleName}: ${event.propertyName}: ${event.newValue}"
                                )
                            }
                        }
                        node.addPropertyChangeListener(listener)
                        observed[node] = listener
                    }
                    repeat(node.accessibleChildrenCount) {
                        visit(node.getAccessibleChild(it)?.accessibleContext)
                    }
                }
                visit(window.accessibleContext)
            }
        }
        suspend fun find(name: String, role: AccessibleRole? = null): AccessibleContext {
            val start = System.nanoTime()
            repeat(250) {
                val match = onEventThread {
                    tree().firstOrNull {
                        it.accessibleName == name && (role == null || it.accessibleRole == role)
                    }
                }
                if (match != null) {
                    synchronized(events) {
                        events.add(
                            "Found $name after ${(System.nanoTime() - start) / 1_000_000} ms"
                        )
                    }
                    return match
                }
                delay(20)
            }
            error("Accessible node missing: $name; available: ${tree().map { it.accessibleName }}")
        }
        fun click(node: AccessibleContext) = onEventThread {
            check(node.accessibleAction?.doAccessibleAction(0) == true) {
                "No accepted accessible action: ${node.accessibleName}"
            }
        }
        suspend fun edit(node: AccessibleContext, value: String) {
            onEventThread {
                val editable =
                    node.accessibleText as? AccessibleEditableText
                        ?: error("No editable text: ${node.accessibleName}")
                editable.setTextContents(value)
            }
            repeat(250) {
                val accepted = onEventThread {
                    val editable = node.accessibleText as? AccessibleEditableText
                    editable != null &&
                        editable.charCount == value.length &&
                        (value.isEmpty() || editable.getTextRange(0, value.length) == value)
                }
                if (accepted) return
                delay(20)
            }
            error("Text update did not reach: ${onEventThread { node.accessibleName }}")
        }
        suspend fun awaitFocus(node: AccessibleContext) {
            repeat(250) {
                if (onEventThread { node.accessibleStateSet.contains(AccessibleState.FOCUSED) })
                    return
                delay(20)
            }
            error("Focus did not reach: ${onEventThread { node.accessibleName }}")
        }
        fun text(node: AccessibleContext): String = onEventThread {
            val editable = node.accessibleText as AccessibleEditableText
            editable.getTextRange(0, editable.charCount)
        }
        suspend fun awaitDarkTheme(expected: Boolean) {
            repeat(250) {
                if (onEventThread { findChecked(tree(), "Тёмная тема") } == expected) return
                delay(20)
            }
            error("The selected theme did not reach the application")
        }
        suspend fun capture(name: String) {
            if (System.getenv("LABUI_CAPTURE_SCREENSHOTS") != "true") return
            val robot = Robot()
            var previous: IntArray? = null
            var unchanged = 0
            repeat(80) {
                val bounds = onEventThread { Rectangle(window.locationOnScreen, window.size) }
                val frame = robot.createScreenCapture(bounds)
                val pixels = frame.getRGB(0, 0, frame.width, frame.height, null, 0, frame.width)
                unchanged = if (previous?.contentEquals(pixels) == true) unchanged + 1 else 0
                if (unchanged >= 4) {
                    val directory = File("build/screenshots").apply { mkdirs() }
                    check(ImageIO.write(frame, "png", File(directory, "$name.png")))
                    return
                }
                previous = pixels
                delay(100)
            }
            error("The native frame did not settle before capture: $name")
        }
        try {
            find("Редактировать", AccessibleRole.PUSH_BUTTON)
            if (restart) {
                find(verifiedName)
                find(verifiedDescription)
                find(verifiedEmail)
                find("Уведомления выключены")
                awaitDarkTheme(true)
                capture("restored-dark")
                println(
                    "NATIVE_RESTART_PASS: saved workspace and display restored in a new process"
                )
                return@withContext
            }
            capture("main-light")
            click(find("Тёмная тема"))
            awaitDarkTheme(true)
            capture("main-dark")
            click(find("Редактировать", AccessibleRole.PUSH_BUTTON))
            val close = find("Закрыть", AccessibleRole.PUSH_BUTTON)
            awaitFocus(close)
            capture("sheet-dark")
            edit(find("Название", AccessibleRole.TEXT), "Несохранённое название")
            click(find("Отмена", AccessibleRole.PUSH_BUTTON))
            awaitFocus(find("Редактировать", AccessibleRole.PUSH_BUTTON))
            find(Workspace().name)
            click(find("Тёмная тема"))
            awaitDarkTheme(false)
            click(find("Редактировать", AccessibleRole.PUSH_BUTTON))
            awaitFocus(find("Закрыть", AccessibleRole.PUSH_BUTTON))
            check(text(find("Название", AccessibleRole.TEXT)) == Workspace().name) {
                "Cancel leaked a draft into the next editor"
            }
            capture("sheet-light")
            edit(find("Название", AccessibleRole.TEXT), "")
            click(find("Сохранить", AccessibleRole.PUSH_BUTTON))
            find("Введите название")
            capture("validation-light")
            edit(find("Название", AccessibleRole.TEXT), verifiedName)
            edit(find("Описание", AccessibleRole.TEXT), verifiedDescription)
            edit(find("Почта для уведомлений", AccessibleRole.TEXT), verifiedEmail)
            click(find("Получать уведомления"))
            click(find("Сохранить", AccessibleRole.PUSH_BUTTON))
            find("Изменения сохранены")
            val trigger = find("Редактировать", AccessibleRole.PUSH_BUTTON)
            awaitFocus(trigger)
            find(verifiedName)
            find(verifiedDescription)
            find(verifiedEmail)
            find("Уведомления выключены")
            capture("saved-light")
            click(find("Тёмная тема"))
            awaitDarkTheme(true)
            capture("saved-dark")
            val acceptedEvents = synchronized(events) { events.toList() }
            check(acceptedEvents.any { it.contains(AccessibleContext.ACCESSIBLE_TEXT_PROPERTY) }) {
                "No text event reached Java Accessibility"
            }
            check(
                acceptedEvents.any {
                    it.contains(AccessibleContext.ACCESSIBLE_STATE_PROPERTY) &&
                        it.contains("focused")
                }
            ) {
                "No focus event reached Java Accessibility"
            }
            println(
                "NATIVE_SCENARIO_PASS: draft cancellation, validation, persisted save, focus and Java Accessibility events"
            )
        } finally {
            File("build").mkdirs()
            File("build/accessibility-events${if (restart) "-restart" else ""}.txt")
                .writeText(synchronized(events) { events.joinToString("\n") })
            onEventThread {
                observed.forEach { (node, listener) -> node.removePropertyChangeListener(listener) }
            }
        }
    }

private fun findChecked(nodes: List<AccessibleContext>, name: String) = nodes.any {
    it.accessibleName == name && it.accessibleStateSet.contains(AccessibleState.CHECKED)
}

private const val verifiedName = "Нативная лаборатория 東京"
private const val verifiedDescription = "Сохранённое описание\nВторая строка"
private const val verifiedEmail = "studio@example.com"

private fun <T> onEventThread(block: () -> T): T {
    if (EventQueue.isDispatchThread()) return block()
    var result: Result<T>? = null
    EventQueue.invokeAndWait { result = runCatching(block) }
    return result!!.getOrThrow()
}
