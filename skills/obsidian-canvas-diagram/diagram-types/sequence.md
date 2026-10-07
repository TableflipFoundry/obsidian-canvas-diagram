# Sequence / Flow diagram

**Best for:** "What happens when a user does X?" Steps in order over time.

## Conventions

- **Box types:** `event`, `person` or `system` for what starts it, `screen` for what the user sees, `function` for each step, `decision` for branch points, `data` for things read or saved.
- **Arrows:** plain for the normal path, red for errors, cyan where data is passed, purple into outside systems. Steps that happen later (queued, after a delay) get a long-dashed line; steps that repeat on a timer get a dotted line. Branches are shown with labels ("if paid"), not color (SKILL.md, "The legend"). Label an arrow only when the step's meaning isn't clear from the boxes (1–3 words).

## Making it read top to bottom

**Time runs downward.** The trigger (user action, incoming order, timer) is the single box at the top. Each arrow goes from a step to the step after it. Error paths branch sideways and down to their own outcome boxes. Don't loop them back into the main line unless the code really retries.

A retry or "go back" is an upward arrow. That's fine when it's real, but keep it to one or two per diagram.

## Keep it readable

- One flow per diagram. "Checkout" and "refund" are two diagrams.
- Don't draw a lane per actor. Obsidian canvas can't do lanes well. Say who does each step in the note, or let the box types (person, screen, system) show it.
- If a step has its own complicated insides, give it a detail diagram rather than growing this one.
