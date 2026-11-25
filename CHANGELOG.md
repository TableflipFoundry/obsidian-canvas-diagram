# Release notes

## 0.6.0 — I/O diagrams and relationship-first finishing

- Bundles the editable Canvas IO desktop companion and built runtime. Native tools install it for I/O diagrams without a download or build at diagram time.
- Uses eight fixed mirrored I/O ports, separate call/return lanes, saved connections and native interaction support. Native center hover connectors are disabled on port-enabled cards.
- New diagrams use I/O edges. Saved diagrams retain their mode and geometry unless conversion, refinement or a new arrangement is requested.
- Applies a final fixed-card I/O pass after relationship placement and group assembly. It preserves main paths and explicit attachments, discourages backward curls, and positions labels separately from curves.
- Adds saved attachment decisions and explicit fixed-card refinement. Predictions remain distinct from native checks.
- Records crossing categories without requiring zero crossings. Through-card paths, prolonged overlaps and unreadable labels remain completion blockers unless reported as limitations.
- Requires current readable closeup evidence for new nontrivial diagram jobs, followed by recorded visual review.
- Parses note frontmatter with YAML, including quoted colon-containing titles.
- Updates plan/review/update workflows, plain-language documentation, geometry regressions and native layout checks.

Dynamic port swapping, automatic side-drag creation, waypoint editing, line bridges and automatic call/return creation remain out of scope for this release. The desktop companion uses private Canvas APIs and is verified on Obsidian 1.15.1; future releases and mobile require separate validation.
