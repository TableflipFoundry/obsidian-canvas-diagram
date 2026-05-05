# obsidian-canvas-diagram

A Claude Code plugin that generates richly-documented diagrams in an Obsidian vault.

Each diagram is an Obsidian `.canvas` file where every node references a full markdown file. The canvas is the map; the markdown files are the territory — every node has a plain-language explanation plus structured technical detail.

## What it does

- Plans new components with diagrams before any code exists.
- Reverse-engineers diagrams from existing code.
- Reconciles diagrams against code as the project evolves, flagging drift.
- Reuses nodes across diagrams via a shared `nodes/` pool, building a knowledge graph instead of standalone images.
- Uses a universal color palette so diagrams read consistently across your project.

## Slash commands

| Command | Use for |
|---|---|
| `/diagram-plan <description>` | Greenfield: planning something that doesn't exist yet. |
| `/diagram-review <path or description>` | Reverse-engineer from existing code. Accepts a path (`src/auth/`) or plain English (`the login flow`). |
| `/diagram-update <diagram name>` | Modify an existing diagram. If nodes reference real code, performs a drift audit first. |

The skill is also auto-invoked when a request matches its description, so users who don't know the slash commands can still trigger it by asking for a diagram in plain English.

## Vault layout

Diagrams are stored at the root of whatever project you're working in:

```
<project-root>/
  Diagrams/                  ← open this folder in Obsidian
    auth-flow.canvas
    payment-flow.canvas
    nodes/
      login-handler.md
      session-store.md
      ...
```

The `Diagrams/` folder *is* the vault. No setup, no config — point Obsidian at it and the diagrams render.

## Conventions

### Universal edge colors

| Color | Meaning |
|---|---|
| Red | Error / failure / destructive |
| Orange | Async / deferred / queued |
| Yellow | Conditional / decision branch |
| Green | Success / happy path |
| Cyan | Data flow |
| Purple | External / third-party |

### Node colors by type

`component` cyan · `function` green · `actor` purple · `data` yellow · `decision` orange · `event` red.

### Node markdown structure

Every node file:
1. YAML frontmatter (`id`, `title`, `type`, `status`, `source`).
2. **Plain-language paragraph first** — readable by a layperson, no jargon.
3. Technical sections appropriate to the node type.

No H1 inside the file — Obsidian renders the filename as the title.

## Installation

In Claude Code, open the plugin manager:

1. Click **Manage Plugins** (or run `/plugins` in the chat box on supported clients).
2. Go to the **Marketplaces** tab and add:
   ```
   TableflipFoundry/claude-plugins
   ```
3. Switch to the **Plugins** tab and click **Install** on `obsidian-canvas-diagram`.
4. Restart your editor / Claude Code session.

Once restarted, the slash commands `/diagram-plan`, `/diagram-review`, and `/diagram-update` are available, and the skill is auto-invoked when a request matches its description.

## Diagram types supported

Architecture · Sequence · State machine · Data model · Dependency / call graph · Decision tree.

The skill recommends a type based on the user's request and announces it before generating, so the user can redirect.

## Status

v0.1 — initial release. Layout heuristics are unproven and will be refined as real diagrams expose what fails. Feedback welcome.

## License

MIT
