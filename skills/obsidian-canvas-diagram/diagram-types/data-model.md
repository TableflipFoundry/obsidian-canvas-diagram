# Data model / Entity-relationship diagram

**Best for:** "How is the data structured?" Database tables, document schemas, domain entities.

## Conventions

- **Box type:** `data` for every table, collection or entity.
- **Arrows:** cyan, with a diamond arrowhead (`"styleAttributes": { "arrow": "diamond" }`) for "owns / is part of". Label with the relationship when it helps: "has many", "belongs to", "1:N".
- **Fields, types and constraints** go in each note's `Schema / shape` section. The canvas shows only how things relate.

## Making it read top to bottom

Point arrows from the **owner to what it owns** (from the "one" side to the "many" side): `customers → orders → order lines`. The top-level things (customers, products, accounts) end up at the top, and the details they own stack below.

For a many-to-many link table, point both owners at the link table so it sits below them.

## Keep it readable

- Group by subsystem: one diagram per area (sales tables, user tables) if there are more than about 25 tables.
- Leave out lookup and log tables that only one table uses, unless they matter to the story. Mention them in the owner's note.
