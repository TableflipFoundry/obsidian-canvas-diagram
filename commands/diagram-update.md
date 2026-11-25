---
description: Update a diagram within the requested scope, preserving approved geometry and verifying changes in Obsidian.
---

The user wants to change an existing diagram. Use the **obsidian-canvas-diagram** skill and follow its SKILL.md for notes, canvas format, colors, layout and review.

The argument: $ARGUMENTS

Read the shared [output-quality workflow](../skills/obsidian-canvas-diagram/references/output-quality.md) and [I/O ports](../skills/obsidian-canvas-diagram/references/io-ports.md). Reuse scope, detail and grouping already established in the conversation; do not repeat an approval or interview the user has already completed. New diagrams use I/O ports. Saved diagrams are converted or rearranged only when requested. A score alone never replaces whole-diagram and readable closeup review.

## 0. Pick the diagram (always ask unless the argument names one)

1. Find every diagram: use the Glob tool with `Diagrams/*/*.canvas` (don't rely on shell commands for this; the shell may not be set up). Each diagram is a folder under `Diagrams/` with one `.canvas` file.
2. If the argument clearly names exactly one of them ("the sales diagram", `sales`, `Diagrams/sales/sales.canvas`), use it.
3. Otherwise **ask with the AskUserQuestion tool**, one option per diagram, labelled with the folder name and, as the description, when it was last changed and how many boxes it has. Don't guess, and don't pick the most recent one on your own. If there is only one diagram, still confirm it in the same question.
4. If the argument doesn't say what should change, ask that too, in the same call: "Bring it up to date (check against the code, current legend, new layout)" (Recommended) or "Change something specific" (the user then describes it).

If you can't ask questions (no AskUserQuestion tool), list the diagrams and stop; don't update anything.

## 1. Load the diagram

Choose job scope honestly: default `job.mjs start <canvas>` for a code/content refresh, or `start <canvas> --presentation` for an explicitly visual-only edit. Read [Relationship audit](../skills/obsidian-canvas-diagram/references/relationship-audit.md). Content jobs require a source inventory of callers, calls, reads, writes, returns and consumers, including initial loading and state returned to all in-scope UI consumers. Presentation-only jobs preserve the semantic graph and report that completeness was not code-audited; an existing diagram is not automatically trusted as complete.

Start the job on this canvas (SKILL.md, "The diagram job (stop check)"). Open the `.canvas` file and every note it points at. If boxes link to detail diagrams (`detail:`), note them. They may need updating too.

## 2. Check it against the code

For a requested code/content refresh, run the following drift check if notes have `status: exists` or a `source`. For an explicitly presentation-only request (ports, one edge, labels or layout), preserve content and relationships; read source only if needed to resolve a claimed relationship. Do not turn a small visual correction into an unrequested full audit or a new approval round.

For a code/content refresh:

Reconcile `<diagram>.relationships.json` with the code and graph, not just existing arrows. Inspect apparent sinks/write-only stores and missing return/consumer paths. Record evidence for every drawn relationship or deliberate omission; run `audit.mjs <canvas> <inventory>` after semantic changes. If source is unavailable, disclose the exact unverified relationships rather than treating a visual score as code validation.

1. For each note with a `source`, read the file.
2. For notes without a `source` that should exist by now, search the codebase for them.
3. Compare the diagram with the code:
   - notes whose `source` file is gone or renamed,
   - code that exists but isn't in the diagram,
   - arrows that no longer match what the code does,
   - note text or technical sections (Inputs, Calls, Readers…) that no longer match.
4. **Report the drift as a plain list.** Don't fix anything yet. Also check the diagram's issues note (`<name>-issues.md`) if there is one: mark issues that are now fixed in the code, and add any new ones you found (SKILL.md, "Issues found while reviewing").
5. Apply changes already covered by the user's request. Ask only about unresolved scope or substantive findings outside that request.

If the diagram is all `status: planned`, skip this and go straight to the requested changes.

## 3. Bring it up to the legend

Diagrams made before the strict legend (SKILL.md, "The legend") may use retired colors. The pipeline refuses to lay them out until they're fixed:

- Orange (`"2"`) arrows meant "queued": remove the color and add `"styleAttributes": { "path": "long-dashed" }`.
- Yellow (`"3"`) and green (`"4"`) arrows: remove the color, and add a short label if the meaning ("yes", "if paid") is lost.
- Box colors must match the note's type. Notes with the old `actor` type can stay as they are, or be changed to `person` or `system` (with blue `"#3d6fd9"` or purple `"6"`) if you're editing them anyway.

Tell the user in one line that the diagram was converted to the current legend.

## 4. Make the changes

- **Adding a box:** search `Diagrams/nodes/` first and reuse a note if one fits; otherwise write a new one. Add it to the canvas with position 0.
- **Removing a box:** remove it from the canvas only. **Don't delete the note.** Other diagrams may use it.
- **Editing a note:** first check whether other canvases use it. If so, warn and offer to fork (SKILL.md, "Editing a shared note").
- **Changing arrows:** only affects this canvas.
- Don't create other diagrams unless the user asks.

## 5. Lay out, review, report

Preserve the user's manual arrangement and the existing `.layout.json` plan. For a requested new arrangement, update the semantic plan and run `pipeline.mjs <canvas> --relayout`. For an authorized I/O attachment/label cleanup use `--refine-io`; explicit conversion uses `--io`. Otherwise preserve the saved geometry. Then finish the relationship-first pass with whole-diagram and readable close-up review. For geometry the user intentionally refined, use `verify.mjs` to check it without reflow. Keep helpers close to callers and shared-data references near their uses. Record `job.mjs reviewed ... --relationships` after the final verification (SKILL.md, "Layout and review"). Never undo cleanup with an unnecessary global reflow.

Report: what changed, drift findings, any forks, and anything still unclear.
