# State machine diagram

**Best for:** "What states can an X be in, and how does it move between them?" Order statuses, connection lifecycles, workflow stages.

## Conventions

- **Box types:** `component` for each state (a state is something the system *is being*). A small `event` box labelled like "created" marks where it starts.
- **Arrows:** label each one with what causes the change ("customer pays", "30 days pass", "manager approves"). Plain for normal progress, red for moves into a failure state. Moves that happen on a timer ("30 days pass") get a dotted line (SKILL.md, "The legend").

## Making it read top to bottom

Start at the top with the `event` box that creates the thing. Normal progress points **down**: created → pending → paid → shipped → closed. Moves backwards (reopen, retry, back to draft) are upward arrows. That's correct for a state machine, so keep them, but make sure they're real transitions in the code.

Put end states (closed, cancelled, expired) at the bottom by making sure nothing leaves them.

## Keep it readable

- A state that can jump to almost every other state (like "cancelled from anywhere") makes a mess of arrows. Draw one arrow from the most important state and say "can happen from any state" in the note.
- A state that repeats itself (retry) is an arrow from the box to itself. Only draw it if it matters.
