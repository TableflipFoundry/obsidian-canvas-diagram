# Audit what the diagram claims

Read this before creating a diagram or refreshing its content. A complete-looking call tree is not evidence that the reader can understand the feature. Layout checks inspect the arrows that exist; they cannot discover an omitted read, response or consumer.

## Trace independently of the drawing

For each subject, inspect its implementation and search its callers and consumers across the requested feature and its immediate integration boundary. Trace imports, callbacks, hooks, event subscribers and route registrations to actual usage. Search hits identify candidates; read the call sites before asserting relationships. Do not stop at the first caller or use the existing arrows as the search checklist.

Account for six facets: **callers, calls, reads, writes, returns, consumers**. Record the paths and exact source excerpts behind both positive findings and a claim that a facet has no applicable interaction. Distinguish:

- initial load, explicit refresh, and mutation;
- invocation/request from returned payload or completion;
- persistence writes from database reads and their recipients;
- parent/child rendering from callbacks (a form rendering inside a page does not imply all page loads go through that form);
- the owner of local state from every component that invokes the same hook/service. Separate hook invocations can own separate state; do not imply a shared cache without evidence.

For example, a job-title branch must trace loading titles from the database through routes/client/hook to its UI consumers, as well as creating/editing/deleting titles. Check both the management page and selectors in staff forms. The concrete source may show `Page -> hook`, `Form -> page callback -> hook`, and `hook -> client`; do not substitute the visually convenient chain `Page -> Form -> hook` for these distinct interactions.

Inspect apparent terminal nodes, write-only stores, helpers with no consumers, and one-way request chains. Each may be valid, or may expose a missing return/read/subscriber. Explain which the code supports. Do not manufacture symmetric arrows: commands can be fire-and-forget, events asynchronous, returns empty, and some helpers genuinely unused.

At Detailed/Deep dive, draw the meaningful read/return/state delivery paths and other in-scope consumers. At Overview, aggregation is acceptable, but record the exact omitted interaction, why it is beyond the chosen detail, and explain it in the relevant note. A broad phrase like "return is implicit" does not justify hiding the feature's only loading path. An omission that changes how a reader understands the feature must be drawn or disclosed prominently in the note/final report. Never remove true relationships to make layout easier.

## Keep a durable inventory

Save `<diagram>.relationships.json` beside the Canvas. This is authored evidence, separate from `.layout.json` and screenshots. Use:

```json
{
  "version": 1,
  "mode": "code",
  "scope": "Detailed staff administration: job-title loading and editing, including staff form consumers",
  "relationships": [
    {
      "id": "titles-loaded",
      "from": "client",
      "to": "hook",
      "kind": "return",
      "description": "HTTP client returns job-title records to hook state",
      "edge": "client--hook",
      "evidence": [{"file": "src/jobTitlesClient.ts", "line": 12, "text": "  return await response.json();"}]
    }
  ],
  "nodes": [
    {
      "node": "client",
      "evidence": [{"file": "src/jobTitlesClient.ts", "line": 12, "text": "  return await response.json();"}],
      "search": {
        "query": "listJobTitles|useJobTitles",
        "scope": "src staff feature plus imports throughout src",
        "result": "Read the hook and its page/form call sites; all relevant consumers are inventoried",
        "evidence": [{"file": "src/useJobTitles.ts", "line": 20, "text": "      const rows = await listJobTitles();"}]
      },
      "callers": {"relationships": ["hook-requests-titles"]},
      "calls": {"relationships": ["client-requests-server"]},
      "reads": {"relationships": [], "none": "The HTTP client accesses no persistent store directly", "evidence": [{"file": "src/jobTitlesClient.ts", "line": 11, "text": "  const response = await fetch(url);"}]},
      "writes": {"relationships": [], "none": "This scoped list function performs no persistence mutation", "evidence": [{"file": "src/jobTitlesClient.ts", "line": 11, "text": "  const response = await fetch(url);"}]},
      "returns": {"relationships": ["titles-loaded"]},
      "consumers": {"relationships": ["titles-loaded"]}
    }
  ]
}
```

This is a schema example with illustrative paths/line numbers, **not a complete inventory**. Add every subject node, every drawn edge and every discovered relevant interaction. Evidence `text` is exact source at the 1-based `line` (multiline excerpts allowed). Source paths resolve against the project root by default, or `--source-root`. Node `evidence` records implementation review (call-site evidence for people/outside systems). Each empty facet needs `none` plus evidence; do not copy a generic absence explanation across unrelated subjects.

Relationship kinds are `request`, `return`, `read`, `write`, `event`, `render`, `ownership`. `from`/`to` are Canvas node IDs. Reads point from the store to its reader; writes point from the writer to the store. `returns` lists outgoing `return` relationships; `consumers` lists outgoing `return`, `read`, `write` or `event` relationships. `callers`/`calls` list incoming/outgoing `request` or `render` relationships. One source interaction can support multiple edge views at the selected level, but do not conflate different meanings.

A relationship is either drawn (`edge` names an existing edge with matching direction/endpoints) or deliberately omitted (`omitted` explains its scope/detail and where the reader can learn about it). Omitted endpoints may name a component outside the Canvas; at least one endpoint belongs to the diagram. The inventory retains missing reads, returns and consumers even before their arrows are drawn. A relationship with neither an edge nor a reason blocks completion. Every subject edge requires an inventory entry; legend, group and issues cards are excluded from subject coverage. Repeated references to the same note retain their actual Canvas IDs and local edges.

Record and validate it:

```text
node <scripts>/audit.mjs <diagram.canvas> <diagram.relationships.json> [--source-root <project>]
node <scripts>/job.mjs status <diagram.canvas>
```

The check requires coverage of all six facets for every subject and verifies cited source excerpts, edge endpoints/direction, facet membership, and every drawn edge. It records source hashes and the semantic graph hash. Source edits, inventory edits, changed subjects or changed semantic connections invalidate the audit. Moving cards or changing port sides/label offsets does not. Re-run the audit after reviewing affected interactions; do not blindly refresh hashes.

This is **an enforceable evidence and coverage requirement, not an automatic code-understanding proof**. An author can still overlook an interaction or write an unsupported interpretation of valid source. Report actual scope, deliberate omissions and uncertainty. Never describe a clean native score as proof that all code relationships are present.

## Scope of updates and proposed designs

- New diagrams of existing code and content refreshes: `job.mjs start <canvas>`; source-backed inventory is required (`mode: code`).
- Explicitly presentation-only edits: `job.mjs start <canvas> --presentation`. The gate requires the semantic graph to match its starting baseline. It reports **relationships preserved, not code-audited**. Do not expand a port conversion into an unrequested full audit, and do not imply it corrected missing relationships. If the user asks to correct content, start a content job. Existing unaudited diagrams do not become audited by conversion.
- Explicit proposed designs: `job.mjs start <canvas> --design`; use `mode: design`. Each item/absence/search may supply a `design` rationale in place of source evidence. Mark existing-code claims within a mixed plan with `basis: code`; these still require source evidence. Keep planned styles and distinguish the proposal from verified runtime behavior. Never choose design mode for an existing-code diagram to avoid source review.

The visual `reviewed --relationships` check remains separate and still required. The audit report is a final documentation artifact, not a temporary backup; retain it during cleanup. If a real coverage problem cannot be resolved, the documented skip mechanism must name the missing audit/relationship and the final report must disclose it; do not claim a complete architecture.
