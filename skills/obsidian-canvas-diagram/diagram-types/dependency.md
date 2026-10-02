# Dependency / Call graph diagram

**Best for:** "What calls this?" or "What does this depend on?" Relationships between functions, modules or packages (usually C4 level 4).

## Conventions

- **Box types:** `function` for single functions, `component` for whole modules or packages.
- **Arrows:** plain for "calls" or "imports". Cyan when showing data passed along. Purple for outside libraries or services.

## Making it read top to bottom

Point arrows from **caller to callee**, so callers sit above what they call. For "what depends on X", do the same: the callers of X end up above it.

Shared helpers called from many places sink to the bottom on their own, because many arrows arrive there.

## Keep it readable

- Start from one function or module and go 2–3 calls deep. Whole-codebase call graphs are unreadable.
- Leave out standard library and trivial helpers.
- **Circular dependencies** show up as upward arrows. They're worth pointing out: mention them in the report as something the user may want to look at.
