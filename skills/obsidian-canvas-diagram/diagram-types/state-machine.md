# State machine diagram

**Best for:** "What states can an X be in, and how does it move between them?" Order statuses, connection lifecycles, workflow stages.

## Conventions

- **Primary node type:** treat each state as a `component` node (states are "things the system is being," which is closest to component). The starting state can be marked by an incoming edge from a small `event` node labeled "start."
- **Edges:** label edges with the *trigger* that causes the transition (e.g., "user pays", "timeout", "admin approves"). Use yellow for conditional transitions, red for failure transitions, green for normal ones.
- **Flow direction:** radial or loose — state machines often have non-linear topologies.

## Layout shape

If states form a linear progression with occasional backtracks, use left-to-right with return channels for backward transitions.

If states form a cycle (e.g., draft → review → approved → published → archived → draft), arrange in a rough circle/ring with edges around the perimeter.

If multiple states can transition to many others (mesh), spread states evenly and route edges through the gaps between them. This is the hardest case; expect to spend extra effort on edge routing.

Self-transitions (a state looping to itself, e.g., "retry") use a small curl off one side of the node.
