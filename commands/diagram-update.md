---
description: Update an existing diagram, optionally reconciling it against current code.
---

The user wants to modify an existing diagram. Use the **obsidian-canvas-diagram** skill. Read `~/.claude/skills/obsidian-canvas-diagram/SKILL.md` for the full conventions.

## Argument

The argument: $ARGUMENTS

It typically names a diagram (e.g., "auth-flow", "the payment diagram", or a path like `Diagrams/auth-flow.canvas`). If unclear, list the existing `.canvas` files in `Diagrams/` and ask which one.

## Workflow

### 1. Load the diagram

Open the `.canvas` file and every node `.md` file it references. Build a mental model of what's currently there.

### 2. Decide whether to reconcile against code

If **any** of the diagram's nodes have `status: exists` or a populated `source`, run a **reconciliation audit** before applying user changes:

1. For each node with a `source` path, read the actual file.
2. For each node *without* a `source` but representing something that should now exist, search the codebase for it.
3. Compare diagram to code:
   - Nodes whose `source` files no longer exist (deleted/renamed).
   - Code that exists but isn't represented in the diagram.
   - Connections in the diagram that no longer match what the code does.
   - Node descriptions or technical sections (Inputs, Outputs, Calls, etc.) that no longer match the code.
4. **Report the drift to the user** as a list of discrepancies. Do not silently fix anything during the audit.
5. Wait for the user to decide what to update.

If the diagram is purely planning (all `status: planned`, no `source`), skip the audit and go straight to applying user-requested changes.

### 3. Apply changes

For each change:

- **Adding a node:** Search `Diagrams/nodes/` first for a reusable existing node. If none fits, create a new one. Add it to the `.canvas` and re-run the relevant parts of the layout method to integrate it cleanly. May reposition existing nodes if needed to keep edges clean.
- **Removing a node from the diagram:** Remove from the `.canvas` only. Do **not** delete the node `.md` file — it might be referenced by other diagrams.
- **Editing a node's content:** Before modifying, check whether *other* `.canvas` files in `Diagrams/` reference the same node. If yes, **warn the user**: *"This node is also used in [other-diagram]. Editing it will change that diagram too. Proceed, or fork into a new node?"* If they choose to fork, create a new node file (e.g., `<name>-v2.md`) with the modifications and update only the current diagram to point at it.
- **Changing edges:** Local to this `.canvas`; doesn't touch other diagrams.

### 4. Verify and report

Run the verification step on the updated `.canvas` JSON (overlap, edge-through-node, corridor, loop channel checks). Fix any failures.

Report: what changed, any drift findings, any forks created, anything still ambiguous.
