---
name: obsidian-canvas-diagram
description: Generate richly-documented diagrams in an Obsidian vault. Each diagram node is backed by a full markdown file (plain-language explanation + technical sections) and assembled into an Obsidian `.canvas` file, which bundled scripts lay out automatically and check in Obsidian itself. Use this when the user asks to plan, document, review, or update a diagram of code, components, flows, architectures, state machines, data models, or call graphs — especially when they mention Obsidian, canvas, or want documentation that goes deeper than a single image.
---

# Obsidian Canvas Diagram

This skill produces diagrams as **Obsidian Canvas** files. Every box on a canvas is a full markdown note from a shared `nodes/` pool. The canvas is the map; the notes are the territory.

You decide the **meaning**: which notes exist, what they say, and how they connect. Bundled scripts decide the **geometry**: where boxes sit and which side arrows leave from. You never place boxes by hand. After the scripts run, you **review** the result by looking at a screenshot of what Obsidian actually drew.

## When to use this skill

- The user asks for a diagram of code, a system, a flow, or a plan.
- The user mentions Obsidian, `.canvas`, or wants diagrams that travel with the project.
- The user runs `/diagram-plan`, `/diagram-review`, or `/diagram-update`. Each command file describes how its workflow *starts*. This file describes everything they share.

## The shared workflow

Every command ends the same way:

0. **Start the job and run the reuse check** before writing anything. See "The diagram job (stop check)".
1. **Write the notes** (one markdown file per box). See "Node notes".
2. **Write the canvas**: boxes that point at the notes, plus arrows. Positions don't matter. See "The .canvas file".
3. **Run the layout pipeline** on each canvas. See "Layout and review".
4. **Review** the score and the screenshot. Fix problems by changing structure, then run the pipeline again.
5. **Report** to the user. See "Finishing up".

## Vault layout

Each project has its own vault: a `Diagrams/` folder at the project root. That folder **is** the Obsidian vault.

```
<project-root>/
  Diagrams/                  ← the project's vault
    nodes/                   ← ALL notes, shared by every diagram
      notification-handler.md
      sales-intake.md
    overview/                ← one folder per diagram
      overview.canvas
    pricing/
      pricing.canvas
```

- Create `Diagrams/` and `Diagrams/nodes/` if they don't exist. The scripts turn the folder into a vault on first run (they create `.obsidian/`).
- **Notes always go in `Diagrams/nodes/`**, never next to a canvas. Every diagram in the vault points at the same note files, so the "settings file" note in one diagram is the same note in the next. Never write a second note for something that already has one. See "Reuse".
- Each canvas goes in its own folder named after what it shows: `overview/overview.canvas`, `pricing/pricing.canvas`. If that name is taken by a different diagram, add the level: `pricing/pricing-detailed.canvas`.

## Detail levels (C4 model)

The user picks one of three levels. They follow the **C4 model**, a common industry standard with four zoom levels:

1. **Context**: the system as one box, with its users and the outside systems it talks to.
2. **Containers**: the big separately running pieces: apps, servers, databases, background services, external APIs.
3. **Components**: what's inside one container: the main modules, services and handlers.
4. **Code**: individual functions and files. Draw this only where it helps: tricky logic, or a core flow.

**One request = one diagram.** Never make extra diagrams the user didn't ask for. The detail level sets **how deep that one diagram goes**:

| User's choice | What the boxes are |
|---|---|
| **Overview** | The big pieces only (C4 levels 1–2): who uses it, the programs, data stores and outside services involved |
| **Detailed** | The main parts inside those pieces (level 3): services, handlers, jobs, screens, tables |
| **Deep dive** | Down to the important functions and steps (level 4) |

The detail level applies to whatever the user chose to diagram: a Detailed diagram of one feature, or an Overview of the whole app.

**There is no box limit. The diagram includes what the chosen scope and depth need.** Don't leave out parts to make it smaller, and don't split it into several diagrams. What keeps a big diagram readable is the right *level*: at Overview, don't draw things that belong to Detailed, and so on.

**Linking to other diagrams.** If a box's subject already has its own diagram in the vault, link it from the note:

- In the frontmatter: `detail: sales/sales.canvas`
- As the last line of the opening paragraph: `Detail diagram: [[sales/sales.canvas]]`

Only link diagrams that exist. Don't create them.

## Node notes

### Filenames

- Descriptive, kebab-case, human-readable: `notification-handler.md`, not `n_a4f8b2.md`. **The filename is the title shown on the canvas box**, so make it read well.
- Unique across the whole `nodes/` folder, because notes are shared.

### File structure

**Do NOT start the file with an H1 heading.** Obsidian shows the filename as the title; an H1 would repeat it.

Every note has:

1. **YAML frontmatter** (fields below).
2. **Plain-language opening paragraph.** This is the FIRST content in the file, with no heading above it. Someone who doesn't code must be able to read it and understand:
   - **what** this piece is and does,
   - **why** it exists (what problem it solves, or what would break without it),
   - **how** it works, in a sentence or two of everyday words.
   The first two or three lines show on the canvas card, so lead with the most useful sentence.
3. **Technical sections** for the note's `type` (below).

### Frontmatter

```yaml
---
id: <stable-identifier, kebab-case>
title: <human-readable name>
type: <person | system | screen | component | function | data | decision | event>
status: <planned | exists>
source: <path/to/code/file>      # only when status: exists
level: <context | container | component | code>
detail: <folder/diagram.canvas>  # only when this box has a detail diagram
---
```

### Technical sections by type

Every section is expected. If one really doesn't apply, write "None"; don't leave it out.

| Type | Sections |
|---|---|
| `component` | Responsibilities · Interfaces · Dependencies · Notes |
| `function` | Inputs · Outputs · Side effects · Called by · Calls |
| `person`, `system` (and old `actor`) | Goals · Permissions / capabilities · Touchpoints |
| `data` | Schema / shape · Where stored · Readers · Writers · Lifecycle |
| `decision` | Condition · Inputs to the decision · Branches |
| `event` | Trigger · Payload · Subscribers |

You may add sections when something doesn't fit, but never remove the standard ones.

### Links between notes

Use Obsidian wikilinks: `[[notification-handler]]`. They feed Obsidian's graph view and let a reader (or an AI) follow the system note to note. Link every note you mention, especially in "Called by", "Calls", "Readers", "Writers" and "Dependencies".

### Example note

```markdown
---
id: notification-handler
title: Notification Handler
type: component
status: exists
source: Server/notifications/handler.js
level: component
---

The notification handler is the one place the app goes to tell staff that something happened, like a sale on eBay. It exists so every part of the app doesn't need its own way of showing alerts, and so the same alert isn't shown twice. When something happens, it checks whether that alert was already sent recently, saves it, and pushes it live to every open screen.

## Responsibilities
- Accept alerts from any part of the server
- Drop duplicates sent within 5 minutes
- Save alerts and push them to open screens

## Interfaces
- `publish(notification)`: called by producers

## Dependencies
- [[notifications-repository]] (saves alerts)
- [[notifications-broadcaster]] (pushes to screens)

## Notes
None
```

## Issues found while reviewing

Reviewing code to draw it is also a code review. Whenever you find something wrong, **the user must hear about it.** That includes:

- broken features: buttons that do nothing, calls to routes that don't exist, wrong URLs, code that throws
- dead code: files, functions or routes nothing uses
- duplicated or conflicting logic (the same calculation in several places giving different answers)
- bugs and race conditions (something reads data before it's ready)
- settings that don't take effect
- security or data-loss risks
- stale docs or comments that describe something that no longer exists

Write only what the code proves. Every issue needs a file path (and line when you have one). Don't pad the list with style opinions.

**Where it goes**

1. **One issues note per diagram,** saved next to the canvas (not in `nodes/`): `Diagrams/<name>/<name>-issues.md`. The `-issues.md` ending matters, because the layout pipeline uses it to place the box to the side.
2. **A red box for it on the canvas** (`"color": "1"`, `320 × 200`), with **no arrows**. The pipeline puts it in a column to the right of the diagram, at the top, where anyone opening the diagram sees it.
3. **Link both ways.** In each affected box's note, the `Notes` section says what's wrong in one line and links the issues note: `See [[pricing-issues]].` In the issues note, each issue links the affected boxes: `[[pricing-engine]]`.
4. **Tell the user in the final report** (see "Finishing up"), most serious first.

If you found nothing, don't create the note or the box. Say "no issues found" in the report.

**Issues note format**

```markdown
---
id: pricing-issues
title: Pricing issues
type: event
status: exists
level: component
---

Problems found while reviewing gold and silver pricing on 2026-10-02. Most serious first. Each one says what's wrong, why it matters, and where it is.

## 1. Shopify gets prices before they're recalculated
**Severity:** high · **Affects:** [[spot-price-scheduler]], [[shopify-price-updater]]

What's wrong, in plain words. What the shop would notice.

**Where:** `Server/services/spotPriceSchedulerService.js:521`, `Server/pricing/recalculationManager.js:24`

## 2. …

## Unused code
- `Server/utils/jewelryPriceCalc.js`: an old jewelry calculator nothing uses. It disagrees with the live engine.
```

Severity: **high** (wrong prices or data, money, security, a feature users rely on is broken), **medium** (a visible feature broken or misleading, or a real risk), **low** (dead code, duplication, cleanup). Number them most serious first. Group dead code at the end.

## The .canvas file

A canvas is JSON with two arrays: `nodes` (boxes) and `edges` (arrows).

```json
{
  "nodes": [
    { "id": "n1", "type": "file", "file": "nodes/shop-staff.md",   "x": 0, "y": 0, "width": 320, "height": 200, "color": "#3d6fd9" },
    { "id": "n2", "type": "file", "file": "nodes/sales-screen.md", "x": 0, "y": 0, "width": 320, "height": 200, "color": "#d4579b" }
  ],
  "edges": [
    { "id": "e1", "fromNode": "n1", "toNode": "n2", "label": "rings up sale" }
  ]
}
```

**Boxes**

- `id`: short and unique within the canvas (`n1`, `n2`).
- `type`: `"file"`. `file`: path from the vault root, for example `nodes/sales-screen.md`.
- `x`, `y`: **put 0 for all of them.** The pipeline places them.
- `width` × `height`: **320 × 200** (shows the first lines of the note). For a note whose opening paragraph matters a lot, you may use a taller height in 40px steps. Never go wider than 360.
- `color`: from the note's type, exactly as in "The legend".
- `styleAttributes`: `{ "border": "dashed" }` for planned parts, `{ "border": "dotted" }` for broken or unused ones (see "The legend").

**Arrows**

- `id`, `fromNode`, `toNode`. Leave out `fromSide` / `toSide`; the pipeline picks them.
- **An arrow starts where the thing comes from and ends where it goes.** This is the most important rule for arrows; get the direction right before anything else:
  - **Data** goes from where it lives to whoever receives it. When the price engine *reads* the settings, the arrow is `settings-file → price-engine`. When it *saves* prices, it's `price-engine → products-table`. Something that reads and writes gets the arrow for what matters to the story; if both matter, two arrows.
  - **Requests and actions** go from whoever starts them to whoever carries them out: `shop-staff → sales-screen`, `price-timer → price-fetcher`.
  - Never point an arrow at a data store just because the code "uses" it. Ask what actually travels, and which way.
- **Arrows may point up.** Position doesn't decide direction. The layout follows the arrows, so a data source may end up higher on the page than the thing that reads it. That's fine. Don't flip an arrow to make the picture flow downward.
- A diagram's starting point (a user, a trigger, an incoming event) has arrows going *out* and none coming *in*.
- **Watch out for two-way pairs between main pieces.** An arrow each way between two big boxes (screens → server "requests", server → screens "live updates") forms a loop. The layout may break the loop the wrong way and put the server *above* the screens. At Overview level, draw only the main direction and describe the other in the notes.
- `color`: `"5"` data, `"6"` outside service, `"1"` error, or leave it out for a plain call (see "The legend").
- `styleAttributes`: line style for *when* it happens (see "The legend"). Leave it out for "right away".
- `label`: optional. **Keep labels short (1–3 words)** and name **what travels**: "pricing rules", "new prices", "sale", "fetch now". A label must read correctly in the arrow's direction. Labels take real space on the canvas, so add one only when the arrow's meaning isn't obvious.
- **Don't draw every connection.** Draw the ones that explain how the system works. A box with more than about 6 arrows is a sign the diagram needs simplifying. **One exception:** in an Overview of a system built around one central server, that server is naturally the hub, with an arrow to each database and outside service. That's accepted at Overview level.

Group nodes (`"type": "group"`) are **not supported yet**. Don't use them; show grouping with the box types and the level of detail.

## The legend (strict, same in every diagram)

Every diagram uses this one fixed set of colors and styles, and nothing else. **The pipeline rejects anything off the legend, and so does the stop check.** That covers a box colored differently from its note's type, an arrow color not listed here, or an unknown style. The pipeline also **adds a legend panel to every diagram automatically**: a "Legend" group in the side column under the issues box, showing only what that diagram uses. Never draw your own legend, and never edit the generated one (its ids start with `legend-`; it's rebuilt every run).

Styles (dashed and dotted lines, borders, arrowheads) come from the Obsidian community plugin **Advanced Canvas**, which is required. The scripts check the project's vault and, if it's missing, install the unmodified copy **bundled with this plugin** (`vendor/advanced-canvas`) and turn it on. There's no download, and the scripts never look in other vaults or folders.

**Box color says what a thing *is*. Arrow color says *what* flows. Arrow line says *when*.**

### Boxes: color comes from the note's `type`

| `type` | Legend name | `"color"` | Use for |
|---|---|---|---|
| `person` | Person | `"#3d6fd9"` (blue) | People who use the system: staff, customers, admins |
| `system` | Outside system | `"6"` (purple) | Services and programs outside this codebase: eBay, Shopify, a price API, another app whose files it reads |
| `screen` | Screen | `"#d4579b"` (pink) | Things a user sees: pages, screens, dialogs, the desktop app window |
| `component` | Component | `"5"` (cyan) | Code that runs behind the scenes: servers, services, modules, workers, jobs, routes |
| `function` | Function | `"4"` (green) | One specific function or step |
| `data` | Data | `"3"` (yellow) | Anything that stores information: databases, tables, files, queues, caches |
| `decision` | Decision | `"2"` (orange) | A branch point in logic |
| `event` | Event | `"1"` (red) | A trigger or occurrence: a webhook, a timer firing, "sale completed" |

`actor` is an old type (from notes made before 2026-10). It's still accepted, with purple, but new notes use `person` or `system`. The issues box is always red (`"1"`).

### Box borders (`styleAttributes.border`)

| Value | Meaning |
|---|---|
| (leave out): solid | Exists and works |
| `"dashed"` | **Planned**, not built yet. Required on every note with `status: planned`. |
| `"dotted"` | **Broken or unused**: code that still exists but doesn't work or isn't used. Its note and the issues note say why. |

### Arrow lines (`styleAttributes.path`): when it happens

| Value | Legend name | Use for |
|---|---|---|
| (leave out): solid | right away | The caller waits for it: a screen asks the server for a product |
| `"long-dashed"` | later (queued, background) | Handed off to happen later: a queue, a background job, after a delay, an event someone reacts to |
| `"dotted"` | on a timer | Repeats on a schedule: a price timer, polling every few minutes |
| `"short-dashed"` | planned | A connection that isn't built yet |

### Arrowheads (`styleAttributes.arrow`)

| Value | Legend name | Use for |
|---|---|---|
| (leave out): triangle | | Normal "calls / sends / leads to" |
| `"diamond"` | is part of | Owns or contains (mainly data models: an order owns its lines) |

### Arrow colors (`"color"`): what flows

| `"color"` | Legend name | Use for |
|---|---|---|
| (leave out): gray | | A plain call or "connects to" |
| `"5"` (cyan) | data | Information being passed, read or saved |
| `"6"` (purple) | outside service | Crossing into an outside system |
| `"1"` (red) | error | A failure path |

No other arrow colors. Show branches and conditions with **labels** ("yes", "no", "if paid"), not color.

### How to write it

```json
{ "id": "n4", "type": "file", "file": "nodes/products-table.md", "x": 0, "y": 0, "width": 320, "height": 200, "color": "3" }
{ "id": "n9", "type": "file", "file": "nodes/report-screen.md",  "x": 0, "y": 0, "width": 320, "height": 200, "color": "#d4579b",
  "styleAttributes": { "border": "dashed" } }
{ "id": "e7", "fromNode": "n2", "toNode": "n5", "label": "push stock", "color": "6",
  "styleAttributes": { "path": "long-dashed" } }
```

### Not allowed

- Any color or style not in the tables above (custom colors other than the two listed, `border: "invisible"`, other arrowheads).
- `pathfindingMethod` (Advanced Canvas's arrow routing). It changes arrow shapes, which the layout is tuned against, so the pipeline removes it.
- `shape` and `textAlign`. They only work on text boxes, and every diagram box is a note.
- Text or group boxes of your own. Diagram boxes are always notes (`"type": "file"`).

## Layout and review

The scripts are in the `scripts/` folder inside this skill's base directory (the folder this SKILL.md is in). Below, `<scripts>` means that folder.

### One-time setup

The first time, the scripts need two libraries. If the pipeline prints `SETUP NEEDED`, run:

```
npm install --prefix "<scripts>"
```

It also needs Obsidian installed. The scripts open Obsidian themselves, with a debug connection that lets them see what Obsidian draws. If the pipeline says **Obsidian is open without the debug port**, ask the user to close Obsidian and run the pipeline again. Never close Obsidian yourself.

### Run the pipeline

After writing a canvas (and its notes), run:

```
node "<scripts>/pipeline.mjs" "<path/to/diagram.canvas>"
```

It takes about 1–5 minutes, depending on size. Give the command a long timeout (10 minutes). It:

1. checks the canvas (every arrow must point at a real box),
2. uses a layout engine to put the boxes in rows, top to bottom, following the arrows,
3. tidies the layout within those rows, 3 attempts in parallel, and keeps the best,
4. rewrites the canvas **in place**, changing only positions and arrow sides,
5. opens the project's vault in Obsidian, scores what Obsidian actually drew, and saves a screenshot. The last line of output is `SCREENSHOT <path>`.

### Review (do this every time)

**Look at the screenshot.** Open the PNG with the Read tool. The score is useful, but the picture is the real test. A layout can score well and still fail the most important check (flow).

Check, in this order:

0. **Does every box show its note** (a title and the first lines of text)? A box showing only a file path like `nodes/x.md` means Obsidian can't find the note. The score lists these as "boxes whose note Obsidian cannot find". Fix the `file` path (it's relative to the vault root, the `Diagrams/` folder) before anything else.
1. **Flow: does it read top to bottom as a story?** The starting point (user, trigger) is at the top. Each row happens "after" the row above. **This matters more than anything else.** A tidy diagram with no order has failed.
2. **Can every arrow be followed** from start to end, without running on top of another arrow or through a box? (score: `edges on top of each other`, `edges through a box`)
3. **Are labels readable** and clear of boxes and other labels? (score: `labels on a box`, `labels on labels`, `labels sitting on another edge`)
3b. **Line styles tell the timing:** delayed and background steps are long-dashed, timers are dotted, planned parts are dashed, and broken parts have a dotted border.
4. **Arrow directions:** for every arrow, ask "does this thing really travel from the start box to the end box?" Data from where it lives to who receives it; requests from who asks to who does it. The score lists upward arrows. They're fine when that's the true direction, but they're a good place to double-check.
5. **Starting points not in the top row:** the score lists them. Usually an arrow is pointing the wrong way, or the start is missing its outgoing arrow.
6. **Right level:** every box belongs at the chosen depth. Nothing important is missing, and nothing from a deeper level crept in.

A few crossings are normal in a connected system. Don't chase a score of 0.

**When the picture and the score disagree, trust the picture.** The score can miss things, for example labels half-hidden behind arrows. Fix what you see.

### Fixing problems: change the structure, never the pixels

**Never edit `x`, `y`, `fromSide` or `toSide` yourself.** The next run of the pipeline replaces them. Fix what the diagram *says* instead:

| Problem | Fix |
|---|---|
| Crowded | Check every box belongs at the chosen depth, and every arrow tells part of the story. Remove only what fails those checks; never drop parts the diagram needs, and never split into extra diagrams. |
| Wrong order / no clear story | Check every arrow points the way its thing really travels (see "Arrows"). Fix wrong directions, never flip a correct one for looks. Look for a two-way pair between main boxes and keep only the direction that matters for the story. |
| An arrow passes through a box, or one crossing spoils it | Run the pipeline again unchanged. Each run tries fresh random layouts, so small problems often disappear. If it's still there after one retry and it's only one arrow, accept it. |
| One box has arrows to everything | Keep the arrows that explain the story and describe the rest in that box's note |
| Many long arrows | Drop connections that don't explain anything |
| Labels colliding | Shorten labels, or remove ones that color already explains |
| An arrow crosses the whole diagram | Ask whether it's needed at this level. If yes, accept it; the pipeline routes long arrows around the edge |

Then run the pipeline again. **Stop after 3 rounds** and report what's left; don't loop forever.

### Current limits

- Top-to-bottom flow only. For a sequence diagram, time runs downward.
- No group boxes yet.
- Arrows use Obsidian's normal curves.

## Diagram type selection

The user describes what they want in plain words. Recognize the type, announce it in one sentence ("This sounds like a sequence diagram: each step is a box, top to bottom"), and continue unless they redirect.

| Type | Best for | See |
|---|---|---|
| Architecture / component | "How is the system put together?" | `diagram-types/architecture.md` |
| Sequence / flow | "What happens when a user does X?" | `diagram-types/sequence.md` |
| State machine | "What states can an X be in?" | `diagram-types/state-machine.md` |
| Data model / ER | "How is the data structured?" | `diagram-types/data-model.md` |
| Dependency / call graph | "What depends on this?" | `diagram-types/dependency.md` |
| Decision tree / flowchart | "What logic does this run through?" | `diagram-types/decision.md` |

Read the matching type file before writing the canvas. Detail levels and types combine. For example, a Detailed review might use an architecture diagram for the overview and a sequence diagram for one important flow.

## The diagram job (stop check)

This plugin has a **stop check**. While a diagram job is running, you can't finish until the work passes a list of checks, and each failure tells you exactly how to fix it. `<scripts>` is this skill's `scripts/` folder.

1. **Start the job** once you know the canvas path, before writing notes:
   `node "<scripts>/job.mjs" start "<path/to/diagram.canvas>"`
2. **Run the reuse check** (next section): `node "<scripts>/notes-index.mjs" "<path/to/Diagrams>" [words]`
3. Write the notes, issues note and canvas, then run the pipeline.
4. **Look at the screenshot**, then **record your review** in a sentence or two (flow, arrows, labels, level: what you saw and changed):
   `node "<scripts>/job.mjs" reviewed "<canvas>" "<your review>"`
   If you change anything afterwards, re-run the pipeline and record the review again.
5. If the review found **no problems at all** in the code: `node "<scripts>/job.mjs" no-issues "<canvas>"`
6. Check where you stand at any time: `node "<scripts>/job.mjs" status "<canvas>"`

What it checks: the reuse check ran; every box's note exists; the layout ran on the *current* canvas and was checked in Obsidian; notes you wrote or changed have the frontmatter, an opening paragraph, and every section their type needs; every `[[link]]` leads to a real note; there's an issues note with its red box (or "no issues" recorded); and you recorded a review after the latest layout.

When it blocks you, **do what each line says**. Each failure names its fix. If one truly can't be fixed (for example a source file you can't access), record why. It's then reported to the user instead of blocking:
`node "<scripts>/job.mjs" skip "<canvas>" <check-id> "<reason>"`
If the same failures come back three times, the check gives up and tells you to list them under **"Couldn't fix"** in your report. If the **user** asks you to stop, run `job.mjs cancel "<canvas>"`.

## Reuse: search the notes before creating one

Before writing any note, **run the notes index** to see every existing note with its type, level, title, source file and which diagrams use it:

```
node "<scripts>/notes-index.mjs" "<path/to/Diagrams>"            # everything
node "<scripts>/notes-index.mjs" "<path/to/Diagrams>" spot price  # only matches
```

Then match in this order:

1. The same `source` path: same code, same note.
2. The same `title` and `type`: very likely the same thing.
3. The same thing in different words: propose reuse and ask the user to confirm.

When reusing, point the canvas at the existing file. Don't rewrite it to fit the new diagram. If the new diagram needs a different description, fork it (next section).

**Parts of a bigger note.** Often an existing note describes the *bigger* thing your new note sits inside: `inventory-db` (the whole database) and your new `products-table` (one table in it), or `frontend-spa` and a new `sales-register` screen. Write the new note (it's a different level), then **link them both ways**:

- In the new note's opening paragraph or `Notes`: `Part of [[inventory-db]].`
- In the bigger note, add the new one to a `## Parts` section (create it at the end if missing): `- [[products-table]]`

Adding a line to a `## Parts` list only adds a link, so it doesn't count as the kind of edit that needs the shared-note warning below.

## Editing a shared note: warn first

Before editing an existing note, check whether *other* canvases in the vault point at it. If one does, warn the user:

> "This note is also used in [other diagram]. Editing it will change that diagram too. Go ahead, or make a separate copy for this diagram?"

**Forking:** write a new note (for example `login-handler-v2.md`) with the changes, and point only the current diagram at it.

## Finishing up

Report briefly, in plain language:

1. Which diagrams were made or changed, as paths, the overview first.
2. How many notes were created vs. reused.
3. The diagram type(s) chosen and why, in one line.
4. **Issues found** (see "Issues found while reviewing"): how many, then the most serious ones in a line each, and where the full list is. Or "no issues found".
5. **Couldn't fix:** anything you recorded with `job.mjs skip`, or that the stop check gave up on. Leave this out if there's nothing.
6. Anything else the user should check: unclear reuse matches, drift findings.
7. How to view it: **open the project's `Diagrams` folder in Obsidian** (it's already in Obsidian's vault list if the pipeline ran) and start with the overview.
