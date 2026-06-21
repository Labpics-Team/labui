# Epics — discovery

This directory holds progressive-refinement epics (meta-epic format). Read the relevant `EPIC.md` first, then the chapter's `CHAPTER.md`, then the task's `TASK.md`. Honour the gate protocol: never start a task whose status is `placeholder`/`draft`, or whose `depends_on` is not `done`.

## Epics
| Epic | Status | Goal |
|------|--------|------|
| [`liquid-glass-test-suite/`](liquid-glass-test-suite/EPIC.md) | active | Lock the existing Liquid Glass engine's pixel output + memory invariants behind a CI gate that genuinely bites, with zero change to the rendered picture. Order: ch01 → ch02 → ch03 → ch04. PR only, never merge. |
