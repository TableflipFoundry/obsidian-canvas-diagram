# Input and output ports

Canvas IO is the bundled Obsidian desktop companion. It provides exactly two ports per card side: Input and Output. Top and left have I before O; bottom and right reverse that order. Edges connect Output to Input. Positions remain fixed in this version; do not claim dynamic port swapping or obstacle-aware routing.

This applies to **I/O cards**, not all Canvas cards. Standard cards retain Obsidian's four original connectors. Blank-space **Add card** creates a standard card; **Add I/O card** creates an explicitly marked I/O card. Per-card context menus switch between modes, with native history and persistence. Markdown-backed cards default to I/O; other unmarked cards default to standard unless they already participate in saved legacy I/O edges. Generated `legend-` cards are always standard, including old legends without opt-out metadata. Preserve explicit `canvasIO.ports: false` choices. Card mode and edge I/O metadata are separate; mixed connections follow each endpoint's mode.

New zero-position diagrams use I/O edges by default. Saved diagrams retain their existing mode and geometry unless the user requests conversion. To convert deliberately without changing card positions:

```sh
node <scripts>/pipeline.mjs path/to/diagram.canvas --io
```

Conversion preserves saved side choices. When the user requests attachment/label cleanup as well, add `--refine-io`. The same flag on an existing I/O diagram runs the bounded fixed-card finishing pass. `refine-io.mjs <canvas>` also performs that explicit pass and must be followed by `verify.mjs` and visual review. New layouts receive the finishing pass automatically after group assembly.

To preserve deliberate choices, add an `attachments` object to the version-1 layout plan:

```json
"attachments": {
  "inventory--routes": { "fromSide": "bottom", "toSide": "top" },
  "routes--api-response": {
    "fromSide": "top", "toSide": "bottom",
    "labelOffset": { "x": 100, "y": -60 }
  }
}
```

Keys are existing edge IDs. Both sides are required. Label offsets are optional. Invalid IDs/sides are rejected. Explicit choices take precedence over inferred spine/support attachments. The finishing pass never moves cards, adds reverse edges, duplicates stores or changes connection meaning. Preserve good manual choices; do not use a pin to conceal a native obstruction.

The native scoring/screenshot tools install and enable the local `vendor/canvas-io` bundle when they encounter I/O edges. Users do not need a compiler or a separate download. Requires Obsidian desktop 1.15.1+. Keep Advanced Canvas enabled for the existing legend styles.

Each subject edge stores `canvasIO: { version: 1, fromPort: "output", toPort: "input" }`. Native `fromSide` and `toSide` select its sides. An optional `canvasIO.labelOffset: { x: 0, y: 40 }` moves a label in Canvas coordinates. Decorative nodes use `canvasIO: { ports: false }`; the pipeline applies this to its generated legend. The installed plugin has no label-offset settings UI yet.

Preserve node names, notes, edge IDs, labels, colors, styles and truthful direction during conversion. I/O describes the connection's direction; it does not prove that a reverse response exists. Add return arrows only when they matter to the requested story and code evidence supports them. Keep a single physical database view when requested by the user; otherwise local references to one note remain available for readability.

## Layout and visual review

Keep main paths straight and helpers near their callers. Prefer ports facing the destination. An outward curl at a node usually indicates a poorly chosen attachment side. Evaluate the whole curve: a bottom-to-right connection can run directly through a helper sitting between the two nodes. In that case choose a different clear side or, when authorized, adjust the neighborhood.

Do not equate lower collision scores with clearer diagrams. Keep labels off cards and lines; inspect the rendered whole and readable closeups of every section. Use saved label offsets when necessary, and reverify after edits. The optimizer shares Canvas IO's port anchors and cubic reach; native scoring remains authoritative.

A crossing-free result is not guaranteed. Prefer avoiding unrelated crossings; a few clearly followable crossings near a shared hub can be accepted. Correct through-card paths, prolonged overlapping runs, and hidden labels before completion. Report remaining crossings honestly. Neither paired edges nor dynamic swapping can universally eliminate them.

Canvas IO is an early desktop companion using private Canvas APIs. Explicit I/O dragging, click/keyboard connection, undo/redo, save/reopen, readonly guards and target-arrow reconnection are implemented. Automatic side dragging, empty-space node creation, automatic call/return pairing, adjustable waypoints and line bridges are not implemented. Without the companion, I/O edges fall back to native side centers; metadata is preserved by Obsidian.
