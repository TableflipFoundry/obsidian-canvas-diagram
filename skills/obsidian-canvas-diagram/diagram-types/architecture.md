# Architecture / Component diagram

**Best for:** "How is the system put together?" Services, apps, modules and data stores, and how they talk to each other. This is the usual type for C4 levels 1–3.

## Conventions

- **Box types:** `component` for services, apps and modules. `data` for databases, files and queues. `actor` for users and outside systems.
- **Arrows:** cyan for data flow, purple for crossing into an outside system, orange for queued or background work, red for failure paths if you show them. Plain for "calls" or "starts".
- **Outside systems** (eBay, a payment provider, an email service) are purple `actor` boxes.

## Making it read top to bottom

Point arrows the way requests and data flow, so the layers stack naturally:

1. who uses it (people, triggers)
2. what they touch (apps, screens)
3. what that talks to (servers, APIs)
4. the services doing the work
5. where things are stored, and the outside systems at the bottom

Draw a reply only when it tells the reader something ("callback", "webhook"). Normal request and response doesn't need a return arrow.

## Keep it readable

- One diagram per zoom level. The overview shows the containers, and each container's insides go in its own detail diagram.
- A shared utility that everything uses (a logger, a config loader) usually doesn't belong on an architecture diagram at all. Mention it in the notes instead.
