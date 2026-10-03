# Advanced Canvas (bundled copy)

This folder holds an **unmodified** copy of the Obsidian community plugin **Advanced Canvas** by Developer-Mike. Diagrams made by obsidian-canvas-diagram require it. The diagram scripts install it from this folder into a project's vault when that vault doesn't have it yet. They never download it at diagram time, and they never look in other vaults.

- **Version:** 7.1.0
- **Source:** https://github.com/Developer-Mike/obsidian-advanced-canvas (tag `7.1.0`)
- **Downloaded from:** https://github.com/Developer-Mike/obsidian-advanced-canvas/releases/tag/7.1.0 on 2026-10-03
- **License:** GPL-3.0 (see `LICENSE` in this folder). The complete source code for this version is available at the source link above.

The files are distributed unchanged, alongside obsidian-canvas-diagram (MIT) as a separate program.

## Checksums (SHA-256)

The installer refuses to install files that don't match these.

| File | SHA-256 |
|---|---|
| main.js | fa672aac80561875e01c12e593d661a976d2eb1ada93202efb57029d415482c8 |
| manifest.json | 0f5a79f0964004cccb261942f477f693ebd3b8f969d77940d699388d1bb7a82e |
| styles.css | 3646804b9160e5542b7fc9fec19392e82917c118d110f9a8d88ddb938923922c |

## Updating

1. Download `main.js`, `manifest.json` and `styles.css` from the new release, and the `LICENSE` from that tag.
2. Replace the files here.
3. Update the version, date and checksums above and in `scripts/lib/obsidian.mjs` (`AC_SHA256`).
4. Publish a new plugin version.
