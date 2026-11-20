package pics.lab.ui

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class MenuModelTest {
    private val model = MenuModel(listOf(
        LabMenuItem.Check("check", "Check"),
        LabMenuItem.Check("disabled", "Disabled", disabled = true),
        LabMenuItem.Radio("a", "A", "group"),
        LabMenuItem.Submenu("sub", "More", listOf(LabMenuItem.Radio("b", "B", "group"))),
        LabMenuItem.Action("action", "Action"),
    ))
    @Test fun checkedStateNormalizesStaleValuesAndGroupsAcrossTheTree() {
        assertEquals(listOf("check", "a"), model.checked(listOf("unknown", "check", "check", "a", "b", "action")))
        assertEquals(listOf("check", "b"), model.select(listOf("check", "a"), "b"))
        assertEquals(listOf("b"), model.select(listOf("check", "b"), "check"))
        assertEquals(listOf("b"), model.select(listOf("b"), "b"))
        assertEquals(listOf("b"), model.select(listOf("b"), "disabled"))
    }
    @Test fun valuesAreUniqueAcrossNestedPanelsAndRadioGroupsAreRequired() {
        assertFailsWith<IllegalArgumentException> { MenuModel(listOf(LabMenuItem.Action("a", "One"), LabMenuItem.Submenu("sub", "More", listOf(LabMenuItem.Action("a", "Two"))))) }
        assertFailsWith<IllegalArgumentException> { MenuModel(listOf(LabMenuItem.Radio("a", "One", ""))) }
        assertFailsWith<IllegalArgumentException> { MenuModel(listOf(LabMenuItem.Action("a", " "))) }
    }
}
