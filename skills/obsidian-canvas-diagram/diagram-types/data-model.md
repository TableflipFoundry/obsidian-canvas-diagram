# Data model / Entity-relationship diagram

**Best for:** "How is the data structured?" Database tables, document schemas, domain entities.

## Conventions

- **Primary node type:** `data` for every entity / table / collection.
- **Edges:** cyan (data flow / reference). Label with the relationship cardinality when meaningful: "1:N", "N:M", "owns", "references".
- **Flow direction:** none — data models are relational, not directional. Use a radial or grid arrangement.

## Layout shape

Place the most heavily-referenced entity (the "hub" — often `users` or the primary domain object) near the center. Less-connected entities sit further out. Group entities that belong to the same subsystem (e.g., billing entities together, auth entities together).

Foreign-key edges connect entities; route them through the gaps between groups, not through entity nodes.

Use the `Schema / shape` section in each `data` node's markdown to list fields, types, and constraints — that's the detail layer. The canvas only shows relationships.
