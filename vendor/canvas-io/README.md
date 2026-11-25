# Canvas IO bundle

First-party Obsidian desktop companion, version 0.1.1, MIT licensed. Editable source and tests: [obsidian-plugins/canvas-io](../../obsidian-plugins/canvas-io/README.md).

The diagram tools install this local bundle into the target vault when opening an I/O diagram. No download or compilation is required for diagram users. Ordinary diagrams do not trigger installation. Existing saved diagrams are not converted merely by opening them.

To rebuild: in `obsidian-plugins/canvas-io`, run `npm ci`, `npm run build`, `npm test`, and `npm run bundle`. Commit the generated runtime, geometry module and checksums with source changes. `geometry.mjs` is shared with the layout optimizer so it evaluates the same port locations and cubic reach as the installed plugin.
