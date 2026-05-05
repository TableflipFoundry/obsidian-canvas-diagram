# Sequence / Flow diagram

**Best for:** "What happens when a user does X?" Ordered steps over time.

## Conventions

- **Primary node types:** `function` for steps, `actor` for participants, `event` for triggers, `decision` for branches.
- **Edges:** numbered or labeled with the message/action when ordering isn't visually obvious. Use green for happy path, red for error path, yellow for conditional branches.
- **Flow direction:** **left-to-right.** Time advances rightward.
- **Triggering event:** start at the leftmost position, usually an `actor` or `event` node.

## Layout shape

Strictly linear backbone for the happy path, left-to-right. Error paths branch downward (red edges); alternative branches go above or below the main line. Loops use a return channel below the backbone.

Don't render swimlanes (one row per actor) — Obsidian Canvas isn't great for that. Instead, label each step with which actor performs it, or color nodes by actor type.
