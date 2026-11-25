# Prototype verification

Canvas IO 0.2.0 card-mode update: build and all nine unit tests pass on Obsidian 1.15.1. The 20 existing native interaction checks pass with Advanced Canvas, and all 16 new native card/menu checks pass. The actual creation menu, ordinary/I/O cards, conversions and Shopify legend were visually inspected. All 18 legacy Shopify legend cards displayed without I/O overlays. Temporary fixture files and review screenshots were removed after verification.

Verified November 25, 2026 on Windows, Obsidian **1.15.1**, Node.js **24.16.0**, and Advanced Canvas **7.1.0**.

`npm run build` passed TypeScript checking and produced the plugin bundle. All **6 geometry/persistence unit tests** passed.

All **20 native interaction checks** passed twice: once with Advanced Canvas enabled and once with it disabled. Checks covered:

- Eight ports per card with mirrored ordering.
- Native center hover handles hidden, with pointer interaction and their native connection entry point disabled.
- Real pointer drags producing horizontal and vertical request/response lanes.
- Rejection of Output → Output connections.
- Undo and redo with saved I/O metadata.
- Moving and resizing cards while retaining the selected anchors.
- Read-only rejection of new connections.
- Metadata in the saved `.canvas`, native reimport, and closing/reopening the file.
- Plugin disable cleanup and reenable restoration.
- Keyboard connection creation and Escape cancellation.
- Dragging an existing arrowhead to reconnect the same edge.
- Ordinary edges keeping native center anchors.
- Releasing obsolete edge hooks after closing/reimporting canvases.

The actual Obsidian rendering was visually inspected. Input/output ordering matched the design on all four sides. Opposing arrows used separate lanes, with arrowheads pointing toward input ports and remaining outside the port circles. The temporary screenshot and test canvases were removed afterward.

The prototype was verified in the EZInventory Diagrams vault before inclusion in this repository. The bundled source also contains the later native label-position fix, optional label offsets, and decorative-node port opt-out. That updated build passed the six unit tests and 20 interaction checks with Advanced Canvas enabled, and was used for the full Pawnshop layout review.

This verification covers the desktop prototype and the tested versions. It does not establish mobile compatibility, compatibility with every Canvas extension, alternate Advanced Canvas routing modes, or future Obsidian releases. Canvas IO currently supplies its own cubic route for port edges and uses private Canvas methods.
