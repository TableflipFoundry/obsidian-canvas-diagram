# Validation

Tested on Windows with Node.js 24.16.0 and Obsidian desktop 1.15.1, using Advanced Canvas 7.1.0 and Canvas IO 0.2.0. The complete developer workflow requires Node.js 22.18+ because companion unit tests import TypeScript source with native type stripping.

## Automated checks

The 0.6.2 relationship-audit regressions exercise the real job/audit CLI and stop-check integration. A visual attestation without the inventory remains blocked. Tests reject missing return edges without omission reasons, uncovered consumers/nodes/edges, empty unreviewed facets, mismatched direction/endpoints, invalid source citations and stale source/graph evidence. Explicit presentation-only jobs reject semantic edits and disclose their limited scope; code jobs cannot substitute proposed-design rationale. These checks enforce authored evidence and coverage, not automatic discovery of all runtime relationships. This update changes the agent workflow and job gate; the previously verified Obsidian companion/rendering runtime is unchanged.

From the repository root, run `npm run setup`, `npm test`, and `npm run build`.

The 0.6.2 suite passes **28 diagram-tool tests and 9 companion tests (37 total)**. The six relationship-audit tests include real CLI/stop-check integration. Skill metadata and references pass the skill validator.

The original 0.6.0 verification passed 22 diagram-tool tests and 6 companion tests, plus the build and three opt-in native layout scenarios. The 0.6.1 card-mode update passes **22 diagram-tool tests and 9 companion tests**, the build, all 20 existing native interaction checks, and 16 new card/menu checks. The Shopify legend was inspected with all 18 legend cards free of I/O overlays.

The diagram-tool suite covers real pipeline generation/reruns, semantic main paths, nearby helpers, sibling rows, shared data-reference preservation, explicit conversion, ordinary-edge compatibility, offline bundle installation, newer-install preservation and native quality gates. I/O regressions cover backward-facing curls with an intervening helper, separate request/response labels, attachment pins, fixed card positions, one-store identity and metadata/style preservation. Note tests exercise real YAML semantics and colon-containing titles. Review-evidence tests reject missing/stale closeups or a review recorded before the images.

The companion's six geometry tests cover eight mirrored ports, horizontal/vertical return lanes, movement, resizing, JSON metadata persistence and visible arrow tips. `npm run build` type-checks the companion and regenerates the distributable runtime, shared geometry and checksums.

## Native layout checks

Set `OBSIDIAN_VAULT` to the absolute path of an already-open test vault with debugger port 9222, then run `npm run test:native-layout`.

The script opens temporary fixtures for three cases:

1. An inventory-like source with backward-facing attachments and a helper between it and the destination.
2. Vertical request/response edges whose default labels collide.
3. A fresh zero-position diagram generated through the actual pipeline, with a declared main path, adjacent helper, request/response pairs and generated legend.

It runs the native scorer and requires no through-card paths, prolonged overlaps, card/label/edge collisions, missing notes or detached drawings. It also checks the generated main path and helper alignment. Fixtures are removed and the prior file is restored. Obsidian is never closed. Set `NATIVE_LAYOUT_SCREENSHOT` to an output prefix only when intentionally capturing temporary images for inspection; remove them afterward.

These scenarios passed and their rendered screenshots were visually inspected on November 25, 2026. They establish representative end-to-end behavior, not a guarantee that every future diagram can be routed without crossings.

## Native companion interaction checks

From `obsidian-plugins/canvas-io`, use the same `OBSIDIAN_VAULT` variable and run `node scripts/verify-native.mjs`. Add `--without-advanced` to temporarily test native Canvas alone. The 20 checks cover actual mouse dragging, mirrored return lanes, invalid connections, keyboard activation, cancellation, undo/redo, movement, resizing, read-only mode, save/reopen, disable/enable, target reconnection and ordinary edges. The original companion was checked both with and without Advanced Canvas; its later label-placement update was checked with Advanced Canvas and used in the Pawnshop review.

No mobile, future Obsidian version, alternate renderer, or universal crossing-free claim is made. The final pass is a bounded heuristic using fixed cards and cubic paths. Difficult hubs can still need author adjustments. Native review and truthful limitation reporting remain required.

## Standard and I/O card checks

`node scripts/verify-cards.mjs` in the companion directory exercises the actual background and node menus. It verifies ordinary-card creation, I/O-card creation as one undo operation, Markdown defaults, legacy legends without migration, per-target native connector visibility, mode conversion, undo/redo, mixed-mode endpoints and save/reopen. It removes its temporary cards/notes afterward. Optional screenshots are review artifacts to remove after inspection.
