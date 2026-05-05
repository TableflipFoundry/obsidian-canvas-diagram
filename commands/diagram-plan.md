---
description: Create a planning diagram for a component or system that doesn't exist yet (greenfield).
---

The user wants to plan something that doesn't exist yet. Use the **obsidian-canvas-diagram** skill to generate the diagram. Read `~/.claude/skills/obsidian-canvas-diagram/SKILL.md` for the full conventions.

## Mode: greenfield planning

- Most or all nodes will have `status: planned`.
- The `source` frontmatter field should be omitted or empty (no code exists yet).
- Reuse existing nodes from `Diagrams/nodes/` only where the user is reusing real, already-existing components inside a new design.

## Workflow

1. **Understand the request.** The user described what they want to plan: $ARGUMENTS. If the description is vague, ask 1–2 specific clarifying questions before generating. Examples:
   - "What triggers this flow — a user action, a scheduled job, an external event?"
   - "Should this include error/failure paths, or only the happy path?"
2. **Pick a diagram type** (architecture / sequence / state machine / data model / dependency / decision tree). Announce your choice in one sentence so the user can redirect: *"This sounds like a sequence diagram — I'll lay it out left-to-right with each step as a node. Let me know if you'd rather a different shape."*
3. **Read the matching `diagram-types/*.md` file** in the skill for type-specific conventions.
4. **Sketch structurally first** (Step 1 of the layout method) — list nodes, edges, groups, flow direction, loops — before writing any pixels.
5. **Search `Diagrams/nodes/`** for any existing nodes that match what's being planned. Reuse where appropriate.
6. **Generate node markdown files** for new nodes. Plain-language paragraph first (no H1), then frontmatter-driven technical sections.
7. **Place nodes and edges** following the layout method (Steps 2–7 of SKILL.md).
8. **Run the verification step** on the resulting `.canvas` JSON.
9. **Report briefly:** path to `.canvas`, node count (created vs. reused), diagram type chosen, anything to review.
