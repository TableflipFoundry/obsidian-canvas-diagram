# Obsidian Canvas Diagram

Generate documented, interactive diagrams from code or a proposed design. Each card links to a Markdown note explaining what the component does, why it exists, and how it interacts with the system. Notes are shared across diagrams.

The package includes **Canvas IO**, an Obsidian desktop companion with Input and Output ports on all four sides of each card. Requests, responses, reads and writes can use distinct, persistent attachment points.

Start with [How it works](docs/how-it-works.md) for the plain-language explanation of ports, arrows, layout and review. See [release notes](CHANGELOG.md) for version 0.6.0.

## Commands

- `/diagram-plan <description>` designs a proposed system and draws it.
- `/diagram-review <path or description>` reads existing code and diagrams its real relationships.
- `/diagram-update <diagram>` changes an existing diagram while preserving approved work outside the request.

Ordinary diagram requests can also invoke the skill. Scope, detail and preferences already supplied in the conversation are reused. One request produces one diagram at the chosen level: big pieces, components, or functions. A feature can include both browser and server code when they work together.

## Output

Each project has an Obsidian vault in `Diagrams/`. Shared notes live in `Diagrams/nodes/`. Each diagram has its own folder containing the `.canvas`, a semantic `.layout.json` plan and an issues note when code findings exist.

Drag an orange **O** port to a cyan **I** port. Click-to-connect and keyboard activation also work. Arrows always run Output to Input. Return edges are added when source evidence and the requested detail support them. Fixed mirrored positions give facing cards separate request/response lanes. Existing ordinary edges retain native attachments; original center hover connectors are disabled on I/O cards, while resize handles remain available.

The generated legend describes card roles, what travels, and timing. Card colors: screens pink, components cyan, data yellow, functions green, decisions orange, events red, people blue and outside systems purple. Edge colors: cyan data, purple external, red error, neutral calls. Patterns: solid now, long dashes deferred, dots scheduled, short dashes planned. Port colors identify I/O roles independently.

## Quality workflow

1. Establish truthful relationships and write notes from source evidence or the approved design.
2. Generate an initial layout and align main paths, sibling actions and nearby helpers.
3. Refine I/O sides and labels against the final card positions using the same geometry as the companion. Preserve declared paths and deliberate attachment choices; discourage backward-facing curls.
4. Check actual paths and labels in Obsidian. Capture an overview and readable closeups of every section.
5. Record the visual review. Through-card edges, prolonged overlaps, hidden labels, missing notes and detached drawings block completion unless explicitly reported as unresolved limitations.

A low score alone is not proof of quality. The author still reviews proximity, flow, long wires and arrow meaning. A few followable crossings near a hub can remain. Ports and routing cannot guarantee a crossing-free result.

Saved diagrams stay put by default. Opening a file, installing an update or verifying does not convert or rearrange it. I/O conversion, fixed-card attachment refinement and global re-layout are explicit operations. See [I/O workflow](skills/obsidian-canvas-diagram/references/io-ports.md) and [relationship-first layout](skills/obsidian-canvas-diagram/references/relationship-layout.md).

## Installation and development

Requirements: Node.js 22.18+ for the full development/test workflow and Obsidian desktop 1.15.1+ for Canvas IO. The companion uses private Canvas APIs and may need adjustments after Obsidian updates. Mobile is not verified.

In a supported agent plugin manager, add marketplace `TableflipFoundry/claude-plugins` and install `obsidian-canvas-diagram`. Updating this checkout does not publish a marketplace release.

From a local checkout:

```sh
npm run setup
npm test
npm run build
```

Diagram users do not compile Canvas IO. Native tools install its bundled runtime into the selected vault when opening I/O diagrams. Advanced Canvas 7.1.0 is also bundled for the established styles. No runtime downloads or copying from other vaults are required. If Obsidian is open without its debugger, the tool asks you to close it before reopening it with the connection; it never closes Obsidian itself.

See [the diagram skill](skills/obsidian-canvas-diagram/SKILL.md), [companion source](obsidian-plugins/canvas-io/README.md), and [bundle instructions](vendor/canvas-io/README.md). Script dependencies are `elkjs`, `playwright-core` and `yaml`.

## Verification and limits

`npm test` runs diagram-tool regressions and companion geometry tests. Native layout tests require an already-open test vault and debugger. Set `OBSIDIAN_VAULT` to its absolute path, then run `npm run test:native-layout`. The companion also includes its 20-check native mouse/persistence interaction script. See [validation details](docs/validation.md).

Dynamic port swapping, automatic side-drag creation, empty-space node creation through ports, waypoint editing, automatic request/response pairing and line bridges are not implemented. The final refinement supplies cubic attachment and label choices; it does not move cards around obstacles. The author adjusts the relationship layout when the available curves cannot produce a readable result.

## License

Diagram tools and Canvas IO are MIT licensed. The unmodified bundled Advanced Canvas is GPL-3.0; its license and source attribution are in `vendor/advanced-canvas/`.
