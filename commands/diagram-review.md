---
description: Generate a diagram from existing code by reverse-engineering it.
---

The user wants a diagram of code that already exists. Use the **obsidian-canvas-diagram** skill. Read `~/.claude/skills/obsidian-canvas-diagram/SKILL.md` for the full conventions.

## Mode: reverse-engineering from real code

- Most or all nodes will have `status: exists` and a populated `source` field pointing at the real file.
- Do not invent functionality — every claim in a node's markdown must be backed by what's actually in the code.

## Argument handling

The argument is: $ARGUMENTS

Detect which form it takes:

- **Path-shaped** — contains `/` or `\`, has a file extension, or matches an existing directory in the project. → Treat as a path scope; diagram everything under that path.
- **Plain English** — anything else. → Search the codebase to identify the relevant files first, then diagram them. Use Grep / Glob / file reading tools to find what the user is describing.

If the search turns up nothing or the scope is unclear, ask the user one focused question (e.g., "I see auth code in `src/auth/` and `src/middleware/auth/`. Which one — or both?") before proceeding.

## Workflow

1. **Resolve the scope** (path or feature search).
2. **Read the actual code.** Don't skim — open the files you'll be representing.
3. **Pick a diagram type** based on what the code is. Announce the choice. (Call graph for "what calls this," architecture for "how the module is structured," sequence for "what happens when X is called," etc.)
4. **Read the matching `diagram-types/*.md` file.**
5. **Sketch structurally** — nodes, edges, groups, loops — before writing pixels.
6. **Search `Diagrams/nodes/`** for any node whose `source` matches a file you'd be diagramming. Reuse those.
7. **Generate node markdown files** for new nodes. Each node's plain-language paragraph explains what the real code actually does, in layperson terms. Technical sections cite real signatures, real callers, real dependencies — taken from the code, not guessed.
8. **Place nodes and edges** following the layout method.
9. **Run the verification step** on the `.canvas` JSON.
10. **Report briefly:** path to `.canvas`, node count (created vs. reused), diagram type, scope covered, anything ambiguous.
