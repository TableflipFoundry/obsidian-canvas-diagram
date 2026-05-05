# Dependency / Call graph diagram

**Best for:** "What calls this?" or "What does this depend on?" Code-level relationships between functions, modules, or packages.

## Conventions

- **Primary node types:** `function` for individual functions, `component` for whole modules/packages.
- **Edges:** default color for "calls" / "imports". Cyan if specifically showing data passed between them. Purple for external/third-party dependencies.
- **Flow direction:** top-down (callers above, callees below) is the default convention for call graphs. Reverse if focusing on "what depends on X" — put X at top.

## Layout shape

Tree-shaped if the graph is mostly hierarchical (one root, branches downward). Strict left-to-right or top-down with each level on its own row.

Rarely a strict tree in real code — there are usually shared utilities called from multiple branches. Place those shared utilities at the bottom (or right edge) and let multiple edges converge on them; reserve a corridor below the main tree for these.

Cycles (mutual recursion, circular dependencies) are worth highlighting — use a return channel and consider flagging them in the diagram description as something the user may want to investigate.
