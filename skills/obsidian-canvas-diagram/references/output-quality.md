# Completing a readable diagram

This is the common finishing workflow for plan, review and update commands. It carries the relationship-first and I/O requirements through to the deliverable; merely bundling the desktop companion is not sufficient.

## Establish the story and preserve identity

Use scope, detail and preferences already supplied by the user. Read the relevant entry points, client/server implementations and shared services before asserting relationships. A helper, database or file is part of the diagram because of a real interaction, not because it happens to be in the same folder. Keep unused code visibly distinguished from reachable behavior.

Run the reuse index before creating notes. Write names and a plain-language opening paragraph, followed by the technical sections. Parse frontmatter with YAML and quote titles containing colons. Preserve shared note content during presentation-only changes.

For a substantial reflow, retain a temporary baseline. Compare original subjects and each edge by ID, referenced note endpoints, direction, label, color and style. If a local file-card reference replaces one endpoint, it must resolve to the same note; it is not a new database. Honor a request for a single visible database card. Never invent calls, remove necessary edges, hide names or rewrite descriptions to improve a layout score.

## Place relationships before tuning curves

Declare the main path in `spines`, nearby helpers in `supports`, and sibling actions in `rows`. Keep each independent feature path straight. Put shared stores and outside services near their actual readers or writers, using local references only when appropriate. Branch only where behavior branches; a tidy grid is not evidence of a good story.

New diagrams get I/O metadata automatically. Existing diagrams retain their current mode unless conversion is requested. Requests/actions run from initiator to handler. Returned/read data runs from its source to its receiver. A separate reverse edge requires source evidence or an explicit proposed design, not a visual desire for symmetry.

## Apply the appropriate operation

```sh
# New diagram: initial layout, relationship placement, final I/O sides/labels, native check
node <scripts>/pipeline.mjs <canvas>

# Requested new arrangement of a saved diagram
node <scripts>/pipeline.mjs <canvas> --relayout

# Requested conversion, keeping saved cards and attachment sides
node <scripts>/pipeline.mjs <canvas> --io

# Requested fixed-card I/O attachment and label cleanup
node <scripts>/pipeline.mjs <canvas> --refine-io

# Explicit manual edits or standalone refinement: verify without moving anything
node <scripts>/refine-io.mjs <canvas>
node <scripts>/verify.mjs <canvas>
```

Do not run a global reflow after intentional local cleanup. Default pipeline reruns preserve saved arrangements. `--io` alone does not select new sides or label positions; combine it with `--refine-io` when that cleanup is authorized. `--no-check` is for tests and intermediate development, never evidence of a finished diagram.

The final I/O pass runs after group assembly, with fixed card positions. It preserves declared paths/supports and explicit attachments, evaluates all sixteen side pairs for unpinned edges, and tries label offsets. Ordinary crossings cost less than obstructions or hidden labels. Backward-facing curls are discouraged. These predictions guide selection; they are not a guarantee of native visual quality.

## Inspect actual rendering

Read the native score and overview, then generate readable sections:

```sh
node <scripts>/closeups.mjs <canvas> <review-folder>
```

Inspect every section: entry points, client/server boundary, branches, convergence, each helper, every shared-store connection, independent paths, unused code, issues card and legend. For each helper ask whether it can sit closer to its caller and whether its edge can be shorter and more direct.

Look for outward curls and ports pointing away from their destination. Changing to a facing side can send a curve through an intervening helper; evaluate the entire curve. Check labels after every attachment change. Use `attachments` to retain deliberate choices and label offsets; do not shorten or delete an existing label merely to improve the picture.

Prefer no crossing, then followable return-pair/shared-node crossings, then unrelated crossings. This is a preference, not a hard topology rule. Some layouts cannot be crossing-free. Accept a few clear crossings when they preserve proximity, truthful direction and readable routes; report them. Fix through-card paths, prolonged overlaps, hidden labels, missing notes and detached drawings, or explicitly report the actual unresolved limitation after the bounded repair rounds.

## Close the job truthfully

Run native verification after the last Canvas edit. The closeup tool records image count and the saved Canvas hash. New nontrivial jobs require that evidence, followed by a recorded review:

```sh
node <scripts>/job.mjs reviewed <canvas> "Main paths, nearby helpers, shared stores, preserved relationships, all sections, arrows, labels and remaining crossings checked." --relationships
node <scripts>/job.mjs status <canvas>
```

A score alone is not a review. Do not claim that the stock pipeline produced manual geometry or that an approximate router checked the actual SVG. Limit repair cycles to three rounds. Use the documented skip mechanism for a real unresolved blocker and disclose it in the report; ordinary crossings alone are not blockers.

After checks and review pass, honor the user's artifact preference. Remove only task-created review images, temporary optimization helpers and backups if they are not wanted. Preserve the final Canvas, notes, layout plan and issues note. Do not delete application captures, database backups or user exports.

Report the diagram path, actual method, notes created/reused, code findings and material layout limitations. Existing findings can be linked rather than rediscovered during a small presentation-only edit.
