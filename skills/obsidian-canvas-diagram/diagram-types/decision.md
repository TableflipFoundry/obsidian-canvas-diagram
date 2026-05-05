# Decision tree / Flowchart diagram

**Best for:** "What logic does this run through?" Conditional flows, business rules, troubleshooting trees.

## Conventions

- **Primary node types:** `decision` for branch points, `function` for actions taken, `event` for terminal outcomes.
- **Edges:** yellow for conditional branches (label with the condition: "yes" / "no" / specific value). Green for "success" terminal paths, red for "failure" terminal paths.
- **Flow direction:** **top-down.** Decisions cascade downward.

## Layout shape

Tree-shaped: a single root at the top, branches expanding downward. Each `decision` node typically has exactly two outgoing edges (yes/no) — place children directly below, offset left and right.

For decisions with more than two branches, fan the children out evenly below.

Terminal outcomes (green/red `event` nodes) sit at the bottom or at the leaves. Don't connect them back into the tree.

If the same action appears under multiple branches (e.g., "log error" reached from several decision paths), reuse the node — multiple edges can converge on it. Place shared terminals at the very bottom.
