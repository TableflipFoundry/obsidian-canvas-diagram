---
description: Update an existing diagram, checking it against the current code first, then re-running the automatic layout.
---

The user wants to change an existing diagram. Use the **obsidian-canvas-diagram** skill and follow its SKILL.md for notes, canvas format, colors, layout and review.

The argument: $ARGUMENTS

It usually names a diagram ("the sales diagram", `Diagrams/sales/sales.canvas`). If it's unclear, list the `.canvas` files under `Diagrams/` and ask which one.

## 1. Load the diagram

Start the job on this canvas (SKILL.md, "The diagram job (stop check)"). Open the `.canvas` file and every note it points at. If boxes link to detail diagrams (`detail:`), note them. They may need updating too.

## 2. Check it against the code

If **any** note has `status: exists` or a `source`, run a drift check before making the user's changes:

1. For each note with a `source`, read the file.
2. For notes without a `source` that should exist by now, search the codebase for them.
3. Compare the diagram with the code:
   - notes whose `source` file is gone or renamed,
   - code that exists but isn't in the diagram,
   - arrows that no longer match what the code does,
   - note text or technical sections (Inputs, Calls, Readers…) that no longer match.
4. **Report the drift as a plain list.** Don't fix anything yet. Also check the diagram's issues note (`<name>-issues.md`) if there is one: mark issues that are now fixed in the code, and add any new ones you found (SKILL.md, "Issues found while reviewing").
5. Wait for the user to choose what to update.

If the diagram is all `status: planned`, skip this and go straight to the requested changes.

## 3. Make the changes

- **Adding a box:** search `Diagrams/nodes/` first and reuse a note if one fits; otherwise write a new one. Add it to the canvas with position 0.
- **Removing a box:** remove it from the canvas only. **Don't delete the note.** Other diagrams may use it.
- **Editing a note:** first check whether other canvases use it. If so, warn and offer to fork (SKILL.md, "Editing a shared note").
- **Changing arrows:** only affects this canvas.
- Don't create other diagrams unless the user asks.

## 4. Lay out, review, report

Run the pipeline on the changed canvas, review the screenshot, fix and repeat, then record the review (SKILL.md, "Layout and review"). The whole diagram is laid out again, so boxes may move.

Report: what changed, drift findings, any forks, and anything still unclear.
