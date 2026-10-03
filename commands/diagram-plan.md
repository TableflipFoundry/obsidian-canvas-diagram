---
description: Plan something that isn't built yet. Interviews you about what you want to make, designs how it could be built, then draws it as one auto-laid-out Obsidian diagram.
---

The user wants to plan something that doesn't exist yet. Use the **obsidian-canvas-diagram** skill and follow its SKILL.md for notes, canvas format, colors, layout and review. This file covers how planning *starts*.

What they described (may be empty): $ARGUMENTS

## Rules for this mode

- Most notes have `status: planned` and no `source`. **Planned boxes get a dashed border** and new connections a short-dashed line (SKILL.md, "Line styles and borders"), so the diagram shows at a glance what's new and what already exists.
- If the plan uses parts that already exist in this codebase, reuse their notes from `Diagrams/nodes/` (or write them with `status: exists`), so the plan shows what's new and what's already there.

## 1. Ask how much detail

Use the AskUserQuestion tool:

**"How much detail do you want in the plan?"**
- **Overview**: the main pieces and how they connect. (Recommended to start.)
- **Detailed**: also what goes inside each main piece.
- **Deep dive**: down to individual functions, for when you already know how parts should work.

Every choice produces **one diagram**. Never make extra diagrams the user didn't ask for.

A plan needs the user's input, so this command shouldn't run without a person. If you can't ask questions, stop and say so rather than guessing a design.

## 2. Interview

Learn what they want to build before designing anything. Ask **one or two questions at a time**, in plain language, and build on their answers. Cover:

- **What it is and why:** what problem it solves, and for whom.
- **Who uses it:** people, other systems, scheduled jobs.
- **What it must do:** the main things a user does with it, step by step.
- **What it connects to:** existing parts of this codebase, outside services, data it stores.
- **Limits:** things it must or must not do, and anything already decided.

Stop when you could explain the thing back to them. Usually 3–6 rounds. Don't ask about details the chosen level doesn't need.

## 3. Propose the design, then wait for an OK

Describe the design in plain words before drawing anything:

- the main pieces and what each one does,
- how they connect, in the order things happen,
- what the one diagram will show at their detail level.

Point out any choices you made for them ("I've assumed sales are saved before the online stores are updated, so the register never waits on eBay"). Adjust until they're happy.

## 4. Build

Same as `/diagram-review` step 3: start the job and run the reuse check, write the notes (what, why and how in plain words, then the technical sections as planned), write the canvas at `Diagrams/<name>/<name>.canvas` with positions at 0, then run the pipeline, review, fix, repeat, and record the review (SKILL.md, "Layout and review"). A plan has no code to review, so if there are no open problems to list, run `job.mjs no-issues`; put open questions in the report.

Pick the diagram type that fits (SKILL.md, "Diagram type selection"). For a new feature that is usually an architecture diagram. If the user mainly cares about one flow ("what happens when…"), use a sequence diagram instead.

## 5. Report

Follow SKILL.md "Finishing up". Add a short list of open questions the plan doesn't answer yet.
