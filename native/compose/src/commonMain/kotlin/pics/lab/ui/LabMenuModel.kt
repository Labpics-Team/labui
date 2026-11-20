package pics.lab.ui

import androidx.compose.runtime.Immutable
import pics.lab.icons.SymbolData

public enum class LabMenuTone { Neutral, Accent, Danger }
public enum class LabMenuPlacement { BottomStart, BottomEnd, TopStart, TopEnd }

/** Values are stable identities across the whole tree, including submenu descendants. */
public sealed interface LabMenuItem {
    public val value: String

    public sealed interface Entry : LabMenuItem {
        public val label: String
        public val disabled: Boolean
        public val tone: LabMenuTone
        public val icon: SymbolData?
        public val iconEnd: SymbolData?
        public val shortcut: List<String>
    }

    @Immutable
    public data class Action(
        override val value: String, override val label: String,
        override val disabled: Boolean = false, override val tone: LabMenuTone = LabMenuTone.Neutral,
        override val icon: SymbolData? = null, override val iconEnd: SymbolData? = null,
        override val shortcut: List<String> = emptyList(), public val closeOnSelect: Boolean = true,
    ) : Entry

    @Immutable
    public data class Check(
        override val value: String, override val label: String,
        override val disabled: Boolean = false, override val tone: LabMenuTone = LabMenuTone.Neutral,
        override val icon: SymbolData? = null, override val iconEnd: SymbolData? = null,
        override val shortcut: List<String> = emptyList(), public val closeOnSelect: Boolean = true,
    ) : Entry

    @Immutable
    public data class Radio(
        override val value: String, override val label: String, public val group: String,
        override val disabled: Boolean = false, override val tone: LabMenuTone = LabMenuTone.Neutral,
        override val icon: SymbolData? = null, override val iconEnd: SymbolData? = null,
        override val shortcut: List<String> = emptyList(), public val closeOnSelect: Boolean = true,
    ) : Entry

    @Immutable
    public data class Submenu(
        override val value: String, override val label: String, public val items: List<LabMenuItem>,
        override val disabled: Boolean = false, override val tone: LabMenuTone = LabMenuTone.Neutral,
        override val icon: SymbolData? = null, override val iconEnd: SymbolData? = null,
        override val shortcut: List<String> = emptyList(),
    ) : Entry

    @Immutable
    public data class Separator(override val value: String) : LabMenuItem
}

@Immutable
public data class LabMenubarItem(
    public val value: String, public val label: String, public val items: List<LabMenuItem>,
    public val disabled: Boolean = false, public val heading: String? = null,
)

internal class MenuModel(items: List<LabMenuItem>) {
    val entries: Map<String, LabMenuItem>
    init {
        val indexed = linkedMapOf<String, LabMenuItem>()
        fun visit(items: List<LabMenuItem>) {
            for (item in items) {
                require(item.value.isNotEmpty() && !indexed.containsKey(item.value)) { "Menu item values must be unique and nonempty" }
                indexed[item.value] = item
                if (item is LabMenuItem.Entry) require(item.label.isNotBlank()) { "Menu items need labels" }
                if (item is LabMenuItem.Radio) require(item.group.isNotEmpty()) { "Radio menu items need a group" }
                if (item is LabMenuItem.Submenu) visit(item.items)
            }
        }
        visit(items)
        entries = indexed
    }

    fun checked(values: List<String>): List<String> {
        val groups = mutableSetOf<String>()
        return values.distinct().filter { value ->
            when (val item = entries[value]) {
                is LabMenuItem.Check -> true
                is LabMenuItem.Radio -> groups.add(item.group)
                else -> false
            }
        }
    }

    fun select(values: List<String>, value: String): List<String> {
        val current = checked(values)
        return when (val item = entries[value]) {
            is LabMenuItem.Check -> if (item.disabled) current else if (value in current) current - value else current + value
            is LabMenuItem.Radio -> if (item.disabled || value in current) current else current.filter {
                (entries[it] as? LabMenuItem.Radio)?.group != item.group
            } + value
            else -> current
        }
    }
}

internal val LabMenuItem.Entry.closeOnSelect: Boolean get() = when (this) {
    is LabMenuItem.Action -> closeOnSelect
    is LabMenuItem.Check -> closeOnSelect
    is LabMenuItem.Radio -> closeOnSelect
    is LabMenuItem.Submenu -> false
}
