# How the diagram system works

## Two parts that work together

The **diagram-generation plugin** runs with the agent. It reads code, writes explanatory notes, creates the Canvas file, arranges cards, and checks the result in Obsidian.

**Canvas IO** runs inside Obsidian. It supplies the visible connection ports and draws edges at their selected I/O positions. It handles dragging, click and keyboard connection, native undo/redo, saved connections, read-only protection and target reconnection. It does not read application code or decide what its architecture means.

**Advanced Canvas** remains installed for the established colors, borders, arrow styles and line patterns. Canvas IO supplies the cubic geometry of its own edges. Advanced Canvas's alternate routing modes are not the authority for those paths.

## What I and O mean

Each card has exactly two ports per side, eight total. Input receives a connection; Output sends one. Opposite sides have mirrored positions:

```text
               I     O
          +----o-----o----+
        I o              o O
        O o              o I
          +----o-----o----+
               O     I
```

When one card is directly to the right of another, the first card's right Output aligns with the second card's left Input. The return uses the other lane. The same holds for cards directly above and below each other.

Ports are generic I/O roles, not separate named ports for each function. Several edges can use one port. This still requires careful placement around busy nodes. Positions are fixed in this version.

Orange port rings mean Output; cyan rings mean Input. They do not redefine the legend's edge colors or timing patterns.

## What an arrow says

An arrow describes something moving in its indicated direction. The label and style explain what that thing is:

- A neutral `category ID` arrow from Routes to Aspects represents a request or call.
- A cyan `category questions` arrow from Aspects to Routes represents returned data.
- A cyan `tickets / items` arrow from a database to Routes represents read results.
- A cyan `ticket events` arrow into the database represents a write.

A call and a return are separate interactions. One arrow does not implicitly draw both. Both are shown when that detail matters and source evidence supports it. At a broader overview, the note can explain a return that does not need its own edge.

The diagram distinguishes real invocation from an implemented but unused helper. A caller is not invented to make the picture appear complete. Dotted borders and the issues note explain unused or broken code.

## How positions are chosen

The author identifies the main story, independent paths, alternative actions and supporting helpers. These decisions are saved in a `.layout.json` file:

- `spines` keep real sequences on a straight line.
- `supports` put a directly connected helper beside its caller.
- `rows` align sibling actions without claiming simultaneous execution.
- `references` optionally place local views of the same data note near separate users.
- `attachments` preserve deliberately chosen connection sides and optional label offsets.

A local database reference points to the same Markdown note; it is not a second database. A user can require a single visible card instead. Layout cleanup preserves original subjects and relationships either way.

The initial layout engine creates rows. A relationship pass aligns the main paths and places helpers nearby. After groups are assembled, a bounded I/O pass examines the whole diagram, tries the sixteen side combinations for each unpinned I/O edge, and searches label offsets. It uses the same anchor and curve implementation as the installed companion.

The pass prioritizes card obstructions, prolonged overlaps and hidden labels over ordinary crossings. Backward-facing ports are penalized so a small reduction in crossings does not justify an outward curl. Declared spines, immediate supports and explicit attachments are retained.

This is a prediction, not a completion certificate. Card text, theme and zoom affect native labels. The actual rendering is checked next.

## Why a crossing can remain

Mirrored ports give clear lanes between facing cards. They cannot guarantee that every bend or hub is crossing-free. Keeping one physical database card can also require a longer connection than using local references.

The tool classifies crossings as a return pair, shared-node, or unrelated. Unrelated crossings are less desirable, but these categories are preferences rather than permission to hide another problem. A followable crossing can be preferable to a line through a card, overlapping another edge, hiding a label, or pushing a helper far away.

The inventory-to-Routes example exposed another issue: changing the entry from the left to the right removed the curls but sent the curve through Aspects. A top entry cleared the helper while leaving an ordinary crossing. Attachment choices must be evaluated against the whole neighborhood, not only the endpoint cards.

## How the result is checked

The native scorer opens the Canvas in Obsidian and samples actual SVG paths, visible label rectangles, card bounds and missing-note state. It reports obstructions, overlaps, crossings, label collisions and detached drawings.

An overview shows the main story and long wires. Readable closeups reveal every helper, shared-store connection, branch and label. New nontrivial diagram jobs require closeup evidence tied to the saved Canvas hash, then a recorded relationship review. Changing the diagram invalidates that evidence. A score of zero does not replace this inspection.

The author fixes problems within a bounded review cycle and reports remaining limitations. Temporary screenshots and backups can be removed after the checks and review pass, according to the user's preferences. The final Canvas and Markdown notes remain.

## How connections are saved

The file remains an ordinary `.canvas` file. Node IDs, note paths, edge IDs, native side names, colors, labels and styles stay in the file. Each I/O edge also has:

```json
"canvasIO": {
  "version": 1,
  "fromPort": "output",
  "toPort": "input",
  "labelOffset": { "x": 0, "y": 40 }
}
```

`labelOffset` is optional. Native `fromSide` and `toSide` select the sides. Extra metadata selects their I/O roles and, when necessary, shifts the label. Decorative legend nodes opt out with `canvasIO: { "ports": false }`.

When Canvas IO is disabled, Obsidian displays edges at standard side-center positions. Enabling it restores I/O geometry. Other applications may discard the metadata when rewriting a file.

## Editing an approved diagram

Opening, scoring, screenshotting or updating the installed plugin does not run a global layout. By default the pipeline verifies the saved arrangement. Explicit conversion adds I/O metadata without moving cards; explicit refinement can change sides and label offsets while keeping cards fixed. Global re-layout is reserved for a requested new arrangement.

Visible labels, names, notes, directions, styles, database identity and real relationships remain the basis of the diagram. They are not changed to obtain a better collision score.
