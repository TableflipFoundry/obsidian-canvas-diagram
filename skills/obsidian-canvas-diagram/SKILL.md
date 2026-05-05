---
name: obsidian-canvas-diagram
description: Generate richly-documented diagrams in an Obsidian vault. Each diagram node is backed by a full markdown file (plain-language explanation + technical sections) and assembled into an Obsidian `.canvas` file. Use this when the user asks to plan, document, review, or update a diagram of code, components, flows, architectures, state machines, data models, or call graphs — especially when they mention Obsidian, canvas, or want documentation that goes deeper than a single image.
---

# Obsidian Canvas Diagram

This skill produces diagrams as **Obsidian Canvas** files, where every node on the canvas references a full markdown file in a shared `nodes/` pool. The canvas is the map; the markdown files are the territory.

## When to use this skill

- User asks for a diagram of code, a system, a flow, or a plan.
- User mentions Obsidian, `.canvas`, or wants diagrams that travel with the project.
- User runs `/diagram-plan`, `/diagram-review`, or `/diagram-update`.

## Vault layout

Diagrams live in a `Diagrams/` folder at the project root. That folder **is** the Obsidian vault — the user opens it directly in Obsidian.

```
<project-root>/
  Diagrams/                  ← Obsidian vault
    auth-flow.canvas
    payment-flow.canvas
    nodes/
      login-handler.md
      session-store.md
      ...
```

Create `Diagrams/` and `Diagrams/nodes/` if they don't exist. All `.canvas` files go directly in `Diagrams/`. All node markdown files go in `Diagrams/nodes/`.

## Node markdown files

### Filename rules

- Descriptive, human-readable: `auth-login-handler.md`, not `n_a4f8b2.md`.
- Unique across the entire `nodes/` folder — nodes are shared across diagrams.
- Use kebab-case.

### File structure

**Do NOT start the file with an H1 heading.** Obsidian renders the filename as the page title; an H1 inside the file would duplicate it.

Every node file has:

1. **YAML frontmatter** (required fields below).
2. **Plain-language opening paragraph.** A layperson must be able to read this and understand what the component is and what it does. No jargon. This is the FIRST content in the file, not preceded by any heading.
3. **Technical sections** appropriate to the node's `type` (template below).

### Frontmatter

```yaml
---
id: <stable-identifier>
title: <human-readable name shown on the canvas>
type: <component | function | actor | data | decision | event>
status: <planned | exists>
source: <path/to/code/file>   # only if status: exists; omit or leave empty if planned
---
```

The `id` should be a slug-style identifier (kebab-case, unique). It's what the `.canvas` file uses to reference this node, though canvas references the file by path; `id` exists for cross-node references and queries.

### Technical-section templates by type

Each section is expected. If a section genuinely doesn't apply, write "None" — do not omit the section.

| Type | Sections |
|---|---|
| `component` | Responsibilities · Interfaces · Dependencies · Notes |
| `function` | Inputs · Outputs · Side effects · Called by · Calls |
| `actor` | Goals · Permissions / capabilities · Touchpoints |
| `data` | Schema / shape · Where stored · Readers · Writers · Lifecycle |
| `decision` | Condition · Inputs to the decision · Branches |
| `event` | Trigger · Payload · Subscribers |

You may add additional sections when something doesn't fit the template, but never remove the standard ones.

### Inter-node links

Use Obsidian wikilinks: `[[login-handler]]`. This feeds Obsidian's graph view. Do not use standard markdown links for inter-node references.

### Example node file (function type)

```markdown
---
id: login-handler
title: Login Handler
type: function
status: exists
source: src/auth/login.ts
---

The login handler is the part of the system that checks whether a username and password are correct when someone tries to sign in. If they match what's on file, it gives the person a session so the rest of the app knows who they are.

## Inputs

- `username` (string)
- `password` (string)
- `request context` (IP, user agent)

## Outputs

- On success: a session token (string)
- On failure: an error indicating invalid credentials or rate limit

## Side effects

- Writes to [[session-store]] on success
- Writes to [[auth-audit-log]] on every attempt

## Called by

- [[login-route]]

## Calls

- [[verify-password]]
- [[session-store]]
- [[auth-audit-log]]
```

## The `.canvas` file format

Obsidian Canvas files are JSON with two top-level arrays: `nodes` and `edges`.

### Minimal structure

```json
{
  "nodes": [
    {
      "id": "n1",
      "type": "file",
      "file": "nodes/login-handler.md",
      "x": 0,
      "y": 0,
      "width": 320,
      "height": 200,
      "color": "4"
    }
  ],
  "edges": [
    {
      "id": "e1",
      "fromNode": "n1",
      "toNode": "n2",
      "fromSide": "right",
      "toSide": "left",
      "color": "5",
      "label": "optional text"
    }
  ]
}
```

### Node fields

- `id`: short string unique within the canvas (e.g., `n1`, `n2` — not the same as the markdown frontmatter `id`).
- `type`: always `"file"` for our use case (nodes reference markdown files).
- `file`: path relative to vault root, e.g., `nodes/login-handler.md`.
- `x`, `y`: top-left corner in pixels. Negative values are allowed.
- `width`, `height`: in pixels. Default to **320 × 200** — wide and tall enough to show the first few lines of the node's plain-language paragraph directly on the canvas. User clicks the node to open the full markdown file. If a node's plain-language paragraph is unusually long and you want more visible, increase height (in 40px steps) but never width past 360px.
- `color`: string `"1"`–`"6"` per the node-color palette below. Omit for default (no color).

### Edge fields

- `id`: short unique string (e.g., `e1`).
- `fromNode`, `toNode`: node `id`s.
- `fromSide`, `toSide`: `"top"`, `"right"`, `"bottom"`, `"left"`. Choose sides that make the edge route through open space.
- `color`: string `"1"`–`"6"` per the edge-color palette. Omit for default.
- `label`: optional text. Prefer color over labels; use labels only when the meaning isn't obvious from color alone.

## Color palette (UNIVERSAL, applies to every diagram)

### Edge colors

| Color | Preset | Meaning |
|---|---|---|
| Red | `"1"` | Error / failure path / destructive action |
| Orange | `"2"` | Async / deferred / queued |
| Yellow | `"3"` | Conditional / decision branch / "depends on" |
| Green | `"4"` | Success / happy path / confirmed working |
| Cyan | `"5"` | Data flow / information passing |
| Purple | `"6"` | External / third-party / outside system boundary |
| (omit) | — | Default: plain "connects to" / "calls" |

### Node colors (by `type`)

| Type | Preset |
|---|---|
| `component` | `"5"` (cyan) |
| `function` | `"4"` (green) |
| `actor` | `"6"` (purple) |
| `data` | `"3"` (yellow) |
| `decision` | `"2"` (orange) |
| `event` | `"1"` (red) |

The palettes are universal across all diagrams. Do not invent per-diagram color meanings.

## Layout method

You (the AI agent) place nodes manually. Do NOT use automated layout. Do NOT freestyle — follow these steps in order.

### Step 1 — Structural sketch (no pixels yet)

Before writing any coordinates, list in plain text:

- All nodes (id, type, title).
- All edges (from, to, color/meaning).
- All groups (which nodes belong together logically).
- Primary flow direction: left-to-right, top-down, or radial.
- **Every loop**, explicitly: "node X loops back to node Y."

This is the part you're good at — reasoning about meaning. Do it thoroughly before placing anything.

### Step 2 — Place the backbone

Find the main flow — the longest or most important path through the diagram. Place those nodes in a straight line with generous spacing (at least 200px gap between adjacent backbone nodes). This is the visual spine.

Default backbone spacing (assuming 320×200 nodes): **440px center-to-center horizontally** for L→R flows (≈120px gap between cards), **300px center-to-center vertically** for top-down flows (≈100px gap between cards). Increase if edges look cramped.

### Step 3 — Place branches

For each non-backbone node, place it perpendicular to the backbone, on the side where the connecting edge has clear space to travel. Ask explicitly: "which side of the backbone does this connect to, and is that side empty there?"

Branch spacing: **200–300px** off the backbone.

### Step 4 — Reserve corridors for edges

Between groups, leave continuous empty *channels* — full strips, not single cells — so edges have lanes to travel through. **If an edge needs to cross distance, that lane gets reserved; no node goes in that lane.**

### Step 5 — Reserve return channels for loops

If any loops exist:

- Dedicate an empty strip parallel to the backbone for loop-back edges.
- For L→R flows: typically *below* the backbone.
- For top-down flows: typically *to the right of* the backbone.
- Multiple loops stack at increasing distance from the backbone (innermost loop closest, outermost furthest), so they don't overlap each other.
- **Self-loops** (a node looping to itself): use a small curl off one side of the node; no channel needed.

Loop edge routing: source node → exit toward the channel → travel along the channel → enter target node from the channel side.

### Step 6 — Verify every edge before finalizing

For each edge, state explicitly to yourself: "from A to B, traveling [direction] through [open space], does not cross [list of nodes in that area]." If any edge fails this check, adjust the layout — move nodes or pick different `fromSide`/`toSide` values.

### Step 7 — Compact (only at the end)

First placement is deliberately spread out. After verification passes, tighten spacing only where edges still have clear paths. Don't compact past the point where edges start crossing nodes.

## Verification step (mandatory, after writing the .canvas)

After writing the `.canvas` JSON, perform a global geometric audit on the JSON itself:

1. **Node overlap check.** For every pair of nodes, do their bounding boxes (x, y, x+width, y+height) overlap? If yes, fix by moving one.
2. **Edge-through-node check.** For every edge, does the straight or orthogonal path between its endpoints pass through any node it's not connected to? If yes, reroute (change `fromSide`/`toSide`) or move nodes.
3. **Corridor integrity check.** Did any node land in a corridor or return channel reserved during layout?
4. **Loop channel check.** Are loop return channels still clear?

This is math on coordinates, not visual review — you can do this reliably. Fix any failures before reporting the diagram complete.

## Diagram type selection

The user describes what they want in plain English. Recognize which type fits, announce your choice ("This sounds like a sequence diagram — I'll lay it out left-to-right with each step as a node"), and proceed unless redirected.

Types and when each fits:

| Type | Best for | See |
|---|---|---|
| Architecture / component | "How is the system put together" | `diagram-types/architecture.md` |
| Sequence / flow | "What happens when a user does X" | `diagram-types/sequence.md` |
| State machine | "What states can an X be in" | `diagram-types/state-machine.md` |
| Data model / ER | "How is the data structured" | `diagram-types/data-model.md` |
| Dependency / call graph | "What depends on this" | `diagram-types/dependency.md` |
| Decision tree / flowchart | "What logic does this run through" | `diagram-types/decision.md` |

Read the relevant type file in `diagram-types/` for type-specific conventions before laying out.

## Reuse: search the node pool before creating

When generating any new diagram (or adding a node to one), **search `Diagrams/nodes/` first** for existing nodes that represent the same thing. Reuse them by referencing the existing `.md` file in the new `.canvas`.

Match in order of confidence:

1. `source` path matches an existing node's `source` → same code, same node.
2. `title` and `type` match → likely the same concept.
3. Semantic match (same thing, different words) → propose reuse and ask the user to confirm.

If reusing, do NOT rewrite the existing node's content to fit the new diagram. The node stands as is. If the new diagram needs different content, fork (see Updates below).

## Shared-node edits: warn before modifying

Before editing an existing node's `.md` file, check whether *other* `.canvas` files in `Diagrams/` reference it. If yes, warn the user:

> "This node is also used in [other-diagram]. Editing it will change that diagram too. Proceed, or fork into a new node?"

**Forking:** create a new node file (e.g., `login-handler-v2.md`) with the modifications. Update only the current diagram to reference the new file. The original node and other diagrams stay untouched.

## Output convention

When done generating or updating a diagram, report:

1. The `.canvas` file path.
2. How many nodes were created vs. reused from the existing pool.
3. The diagram type chosen and (briefly) why.
4. Anything the user should review (ambiguous reuse matches, drift findings, etc.).

Keep the report short — the diagram itself is the deliverable.
