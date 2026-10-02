---
description: Diagram existing code. Asks how much detail you want, then reviews the codebase and builds linked, auto-laid-out Obsidian diagrams.
---

The user wants diagrams of code that already exists. Use the **obsidian-canvas-diagram** skill and follow its SKILL.md for notes, canvas format, colors, layout and review. This file covers how the review *starts* and what it produces.

The argument (may be empty): $ARGUMENTS

## Rules for this mode

- Notes describe **what the code actually does**. Every claim must be backed by code you read. Don't invent functionality.
- Most notes have `status: exists` and a `source` path to the real file.

## 1. Ask what to diagram, then two questions

**First, find out what the user wants a diagram of.** Never assume the whole system. If the argument already names it ("the sales flow", `src/auth/`), use that. Otherwise ask in plain words, before anything else:

> What would you like a diagram of? It can be the whole app, or one feature or part of it (for example "how a sale works" or "the eBay connection").

Wait for the answer. If it's vague, ask one short follow-up. A light look at the codebase can help you suggest options ("I see Sales, Inventory, Customers, Platform sync…").

Then use the AskUserQuestion tool, both questions in one call. The detail levels apply to **whatever they chose**: an Overview of one feature, a Deep dive of one feature, or either for the whole app.

**"How much detail do you want?"**
- **Overview**: just the big pieces: who uses it, the programs, data and outside services involved. (Recommended to start.)
- **Detailed**: the main parts inside those pieces: services, jobs, screens, tables.
- **Deep dive**: down to the important functions and steps.

Every choice produces **one diagram**. Never make extra diagrams the user didn't ask for.

**"How should I work out what to cover?"**
- **Review it automatically**: explore the codebase and decide how to split it into parts.
- **I'll explain it first**: you describe the app in your own words (what matters, what to focus on, what to skip), and I'll use that as my guide.

For a single feature, "Overview" means the feature's big pieces and what they connect to (the rest of the app as one or two boxes). "Detailed" shows the parts inside those pieces, still in one diagram. If they named a path, diagram what's under it. Otherwise, search for what they described.

If the user chose **"I'll explain it first"**, ask them to go ahead and wait for their answer before exploring.

If you can't ask (AskUserQuestion isn't available, or you're running without a person), use the recommended answers, **Overview** and **Review it automatically**, and say so at the top of your report.

## 2. Explore, then confirm the plan before writing anything

1. Explore the codebase: folder structure, entry points (server start, app root, main routes), config, and each major area. For a large codebase, use Explore subagents in parallel, one per area. **Run them in the foreground** (`run_in_background: false`, all in one message) so their results come back before you continue. Ask each one to report the parts it found with the file paths behind them.
2. Work out the parts at the chosen detail level (C4 levels, see SKILL.md).
   - **Overview (containers):** draw something as a box if it **runs as its own program, is deployed separately, stores data, or is an outside service** the system talks to. Examples: a desktop app, a web app, a server, a background worker process, a database, a hosted relay, eBay's API. Background jobs that run *inside* the server are components, not containers; mention them in the server's note. Dev tools, one-off scripts, launchers and admin utilities aren't drawn. List them in the report under "not covered".
   - **Databases:** one box per database that has its own job (for example inventory, users, audit log). Combine them into one box only if they do the same job. A settings or config file counts as a data store if the running system reads *and* writes it (for example saved connection tokens). Skip small lookup files.
   - **Outside things:** give a box to any outside service or program the system depends on while running, even a local one (another program whose files it reads). This includes services called directly from the screens.
   - **Detailed / Deep dive:** the parts inside those pieces (services, jobs, screens, tables; for Deep dive, the key functions and steps), all in the one diagram.
3. **Tell the user the plan in plain words and wait for an OK.** Describe the one diagram and its main boxes. For example:

   > I found 7 main parts: the desktop app, the screens, the server, three databases, and the eBay/Shopify connections. The diagram will show those, top to bottom from the user down to the outside services. Sound right, or should I change anything?

   Adjust to what they say. The plan comes after exploring but before the detailed reading in step 3. If that reading changes the plan in a way the user would care about (a part you listed doesn't really exist, or a big one was missed), tell them in a line and carry on.

## 3. Build

First, create `Diagrams/` and `Diagrams/nodes/` if they don't exist (SKILL.md, "Vault layout"). Then **start the job** and **run the reuse check** (SKILL.md, "The diagram job (stop check)").

1. **Read the code** for every box in it. Explorer findings tell you *where* things are. Before writing a note, open at least the box's main `source` file yourself, plus whatever you need to back each claim (who calls it, what it reads and writes). Every sentence in a note must come from code you or an explorer actually read, with the file path known.
2. **Reuse existing notes** using the notes index, and link new notes to the bigger notes they're part of (SKILL.md, "Reuse").
3. **Write the notes**: what, why, how in plain words, then the technical sections from the real code (real function names, callers, tables). Link notes with wikilinks. If a box's subject already has its own diagram in the vault, add the `detail:` field and the `Detail diagram:` link.
4. **Write the issues note** for everything broken, unused, duplicated or risky you found (SKILL.md, "Issues found while reviewing"). Keep a running list from the very start of exploring, so nothing gets lost.
5. **Write the canvas** at `Diagrams/<name>/<name>.canvas`. Positions at 0. Arrows point the way things flow. Add the red issues box, with no arrows.
6. **Run the pipeline, review the screenshot, fix, repeat** (SKILL.md, "Layout and review"). Up to 3 rounds. Record your review with `job.mjs reviewed` after the last round.

For a long job, give the user a one-line progress update now and then ("Notes written, 22 boxes. Running the layout.").

## 4. Report

Follow SKILL.md "Finishing up". Include which parts of the codebase you covered and anything you deliberately left out.
