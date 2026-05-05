# Architecture / Component diagram

**Best for:** "How is the system put together?" Showing services, modules, or major code units and how they communicate.

## Conventions

- **Primary node type:** `component`. Use `data` for stores/databases, `actor` for users or external systems.
- **Edges:** typically cyan (data flow) or purple (external boundary). Use red for failure paths if showing them.
- **Flow direction:** depends on the system. Top-down for layered architectures (UI → API → service → DB). Left-to-right for pipelines. Radial when there's a central hub with peripheral consumers.
- **Grouping:** group nodes that belong to the same logical layer or bounded context.
- **External systems:** always purple node (`actor` type), placed at the edge of the diagram, not the center.

## Layout shape

Layered systems: rows of nodes per layer, edges flowing top-to-bottom across layer boundaries.

Microservices: cluster nodes by service group with thick gaps between groups; inter-service edges cross the gaps in dedicated lanes.
