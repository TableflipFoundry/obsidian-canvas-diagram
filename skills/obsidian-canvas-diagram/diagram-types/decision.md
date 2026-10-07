# Decision tree / Flowchart diagram

**Best for:** "What logic does this run through?" Business rules, validation, troubleshooting paths.

## Conventions

- **Box types:** `decision` for each question, `function` for actions taken, `event` for final outcomes.
- **Arrows:** plain, labelled with the answer ("yes", "no", "over $500"). Red into a failure outcome. There are no branch or success colors; the labels carry the meaning (SKILL.md, "The legend").

## Making it read top to bottom

One root question at the top. Every arrow points from a question to what follows it, so the tree grows downward. Outcomes are the bottom row. Don't connect outcomes back into the tree.

If the same action happens under several branches (for example "log the error"), use one box and let several arrows arrive at it. Don't copy it.

## Keep it readable

- Keep branch labels to a word or two.
- If the tree is more than about 5 questions deep, split a sub-tree into its own detail diagram.
