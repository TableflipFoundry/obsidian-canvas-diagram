# Canvas IO

The first-party Obsidian desktop companion for obsidian-canvas-diagram. Its source, build and tests are independent of the diagram-generation scripts.

I/O cards have two ports per side: **I** for input (cyan) and **O** for output (orange). Standard cards retain Obsidian's original four ports. The I/O order mirrors across opposite sides so requests and responses can follow separate, parallel lanes.

```text
               I     O
          +----o-----o----+
        I o              o O
        O o              o I
          +----o-----o----+
               O     I
```

## Use

Right-click blank Canvas space for **Add I/O card**; the existing **Add card** still creates a standard card. Right-click a card to choose **Use I/O card** or **Use standard card**. Markdown-backed cards default to I/O. Ordinary text/media/web cards default to standard. Old legends are standard automatically, and existing unmarked hand-drawn I/O cards retain their mode through saved I/O connections. Explicit mode choices persist as `canvasIO.ports: true/false` and support undo/redo. Mixed connections attach at each endpoint's chosen mode.

Drag an output port to an input port. You can also click the two ports, or focus them with Tab and press Enter or Space. Starting at an input and finishing at an output is supported; the saved arrow always runs Output → Input. Press Escape to cancel. Drag a connection's arrowhead to a different input to reconnect it.

Use two edges for a request and response, each with its own label. Edit labels, colors, and other edge properties with Canvas's normal controls. Port connections support native undo/redo and follow cards as they move or resize. Read-only canvases reject connection edits.

Existing ordinary edges retain their native attachment points. This prototype does not automatically convert existing diagrams or infer which calls return data. Native center hover handles are hidden and their drag entry point is disabled on port-enabled cards, leaving the I/O ports as the connection controls. Resize handles continue to work. Group containers do not receive ports.

## Build and install

Requires Node.js 22.18+ (tested on 24.16.0) and Obsidian desktop 1.15.1+. From this directory:

```sh
npm ci
npm test
npm run build
node scripts/install.mjs "C:/path/to/vault"
```

The installer copies the build into the selected existing vault. Enable **Canvas IO** in Community plugins. Toggle it off/on after rebuilding. Diagram users receive the bundled build automatically when opening I/O diagrams; Advanced Canvas remains responsible for the existing legend styles. The compiled companion makes no network requests.

To rebuild the distributable bundle after source edits, run `npm run bundle` and include `vendor/canvas-io` in the change.

## File format and compatibility

Edges remain native JSON Canvas records with `fromNode`, `fromSide`, `toNode`, and `toSide`. The additional field is:

```json
"canvasIO": { "version": 1, "fromPort": "output", "toPort": "input" }
```

Native side fields determine the side; the extra metadata selects its I/O port. Unknown versions are left alone. Metadata survives save/reopen, undo/redo, and plugin disable/enable. When the plugin is disabled, edges display using standard side-center anchors; enabling it restores their port geometry. Other applications may discard the custom metadata when rewriting a file.

For authored diagrams, optional `canvasIO.labelOffset: { "x": 0, "y": 40 }` on an edge offsets its label in Canvas coordinates without changing its connection. Native labels are repositioned after port geometry is applied. Decorative nodes can opt out of ports with `canvasIO: { "ports": false }`, which keeps compact legends readable. These authoring fields currently have no settings UI.

Canvas has no supported public port API. Private Canvas types and method wrappers are isolated in `src/canvas.ts` and `src/main.ts`. Obsidian updates may require adjustments. This is a working desktop prototype, not a published Community plugin. Mobile and other plugins that replace Canvas rendering have not been verified.

Canvas IO owns the cubic route for its port edges. Advanced Canvas colors and arrow styling can coexist, but its alternate routing modes are not the routing authority for these edges. Ordinary edges continue using their existing routing.

## Verification

`npm test` checks eight distinct mirrored ports, parallel return lanes, small-card sizing, movement, metadata roundtrips, curve direction, and visible arrow tips.

For native interaction checks, set `OBSIDIAN_VAULT` to an absolute test-vault path. Obsidian must already have that vault open with its local debugger on port 9222. Install the current build first, then run:

```sh
node scripts/verify-native.mjs
node scripts/verify-native.mjs --without-advanced
```

The script enables Canvas IO, temporarily opens a disposable three-card canvas, sends real pointer input, checks persistence and undo/redo, and removes the test canvas afterward. It returns to the previous canvas. The second command temporarily disables Advanced Canvas and restores its prior enabled state. It never closes Obsidian. These development scripts use the local debugger; the installed plugin does not.

Run `node scripts/verify-cards.mjs` with the same test-vault environment for 16 additional native checks of the actual menus, creation, mode conversion, native connector visibility, mixed-mode attachment and reopen persistence. No screenshots or backups are produced by default. `--screenshot` explicitly saves temporary inspection images; delete them afterward. See [VERIFICATION.md](VERIFICATION.md) for tested versions and results.
