# Architecture / Component diagram

**Best for:** "How is the system put together?" Services, apps, modules and data stores, and how they talk to each other. This is the usual type for C4 levels 1–3.

## Conventions

- **Box types:** `person` for people, `screen` for what they see, `component` for servers, services and modules, `data` for databases, files and queues, `system` for outside services.
- **Arrows:** cyan for data, purple for crossing into an outside system, red for failure paths if you show them, plain for "calls" or "starts". Background or queued work gets a long-dashed line, timers a dotted line (SKILL.md, "The legend").
- **Outside systems** (eBay, a payment provider, an email service) are purple `system` boxes.

## Arrow directions

Every arrow starts where the thing comes from and ends where it goes (SKILL.md, "Arrows"):

- **Requests** go from who asks to who does it: person → screen → server → service.
- **Data** goes from where it lives to who receives it: `settings-file → price-engine` when the engine reads settings, `price-engine → products-table` when it saves prices.

The layout follows the arrows, so a data store that only feeds others may sit high on the page. That's correct; don't flip arrows to push stores to the bottom.

Draw a reply only when it tells the reader something ("callback", "webhook"). A normal request and its answer need just the request arrow.

## Keep it readable

- One diagram per zoom level. The overview shows the containers, and each container's insides go in its own detail diagram.
- A shared utility that everything uses (a logger, a config loader) usually doesn't belong on an architecture diagram at all. Mention it in the notes instead.
