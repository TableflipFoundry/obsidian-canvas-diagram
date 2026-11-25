# Relationship-first layout

Read this before laying out or updating a diagram. Layout cleanup is part of the requested diagram, not a separate task for the user.

## Decide meaning before positions

Identify the main story, independent feature paths, and the helpers that directly support each step. A straight chain stays on one vertical centerline. Put a helper immediately beside its caller when that explains their relationship better than another row: availability beside a form, filtering beside a list, Save beside an editor. Independent alternatives may share a row; this does not claim simultaneous execution. Keep real sequential dependencies in order.

Layout is not evidence that a relationship exists. For diagrams of existing code, each meaningful arrow must be supported by an actual call, request, read/write, render relationship or other identified code evidence. Distinguish conceptual ownership from a direct call in its label or documentation. Preserving a graph during cleanup does not independently verify that the original graph was correct.

Keep data beside its reader or writer. If one shared table or cache creates long return arrows through unrelated paths, show local file-card references at its separate uses. Every view points to the **same markdown file**. These are not separate databases, notes or components. Preserve each original edge ID, direction, label and style, changing only which view of that file is attached. Explain repeated references briefly when delivering the diagram.

Feature groups are optional visual boundaries, not substitutes for nearby helpers. A shared-data reference may belong inside its user's group even when another view of that note is outside. Do not pull whole features around a single shared store if local views make the story clearer.

## Save semantic constraints, not pixel coordinates

Alongside `feature.canvas`, write `feature.layout.json`. For any diagram with branches or supporting helpers, include the relevant spines and supports. Reuse and update this plan on future edits. IDs refer to canvas nodes, not note filenames.

```json
{
  "version": 1,
  "spines": [["person", "screen", "form", "validate", "submit"]],
  "supports": [
    { "node": "availability", "anchor": "form", "side": "right" },
    { "node": "permissions", "anchor": "form", "side": "left" }
  ],
  "rows": [["save-profile", "save-pin"]],
  "references": [
    { "node": "users-table", "anchor": "insert-profile", "edges": ["profile-write"], "side": "right" }
  ]
}
```

- `spines`: consecutive directed paths. Each listed pair must have an actual connection. The pipeline aligns centers after automatic optimization.
- `supports`: a directly connected helper and caller on the same row, separated by a short horizontal gap. Choose left/right by the surrounding story. Use at most one immediate helper per side; place additional branches in a sibling row so their arrows do not run through an intervening card.
- `rows`: sibling actions or feature entry points that should share a row. For example, declare the pages branching from one tab selector as a row, as well as alternative handlers branching from one API router. Do not combine steps that depend on each other.
- `references`: a shared **data** note, the user of its local view, and the exact incident edge IDs to attach there. Optional `id` sets the reference node's ID; otherwise it is `<node>--ref-<anchor>`. The original card remains. Reruns reuse the reference rather than adding another copy.
- `attachments`: an object keyed by existing I/O edge ID, with `fromSide`, `toSide`, and optional `labelOffset: {x,y}`. It records deliberate local decisions for the final fixed-card pass. See [I/O ports](io-ports.md). It changes neither note identity nor arrow direction.

Constraints stay inside a feature group (or among ungrouped nodes). Use separate spines per group. Local references inherit their user's group. The pipeline rejects missing IDs, invented spine links, unrelated edge redirection and contradictory placements rather than silently changing meaning.

The pipeline first lays out and optimizes the graph, then aligns its simple chains and applies the semantic plan. It moves a constrained neighborhood together when packing rows, so collision cleanup does not stagger the chain again. Default simple-chain alignment works without a sidecar; semantic helper placement needs the plan because topology alone cannot identify the main story.

After group assembly, the final I/O pass chooses sides and label offsets without moving the cards. It retains declared straight paths, immediate supports and explicit attachments. It evaluates the complete drawing so an inter-group wire is not assessed only inside one group. Approximate predictions do not replace the native rendering score or the all-section review.

**Saved diagrams are stable by default.** A plain `pipeline.mjs <canvas>` preserves an existing arrangement and verifies it. New zero-position diagrams receive their initial layout. Use `--relayout` only for an explicitly requested new arrangement, including a requested cleanup; never as a side effect of installing/updating the plugin or merely opening/checking a diagram. A code/documentation update is not permission to globally rearrange an established diagram.

## Review every neighborhood

Inspect the whole diagram and readable close-ups of **every** section in Obsidian. For each node ask:

1. Is this a real next step, an alternative, supporting behavior, or stored data?
2. Can it sit closer to what it directly supports, with a shorter, clearer arrow?
3. Does a simple path stay straight? Are sibling actions aligned without implying a false dependency?
4. Would a local reference remove a long wire across unrelated features?
5. Are arrows followable, cards unobstructed, and labels readable?

A low score is not proof of clarity. Do not remove subjects, labels or relationships to improve a score. Preserve names, descriptions, colors, border meanings and arrow directions. Keep manual user arrangements unless asked to revise them. Back up the canvas before substantial reflow.

Prefer updating the layout plan and rerunning the pipeline to changing pixels. If the plan cannot express a necessary visual refinement, geometry may be adjusted without changing meaning; validate the resulting drawing without a global reflow:

```text
node <scripts>/verify.mjs <diagram.canvas> <preview.png>
node <scripts>/job.mjs reviewed <diagram.canvas> "What you checked: main paths, nearby helpers, shared data, preserved meaning, arrows and labels." --relationships
```

`verify.mjs` scores and captures the existing layout in Obsidian, checks that it did not change during verification, and updates the job truthfully. It does not lay anything out or mark the visual review complete. Do not edit job markers to bypass verification.

New jobs also retain the native rendering report. The stop check blocks arrows through cards, overlaps, unreadable labels, missing notes and detached arrows until fixed or explicitly recorded as a limitation after the allowed review rounds. Ordinary crossings alone do not block completion.

Finish the visual pass before reporting completion. Limit retries as described in SKILL.md; report any remaining layout problems honestly. A few clear ordinary crossings can be acceptable; arrows through cards or unreadable labels need attention.
