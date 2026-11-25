# Release notes

## 0.6.1 — Standard cards and I/O cards

- Adds **Add I/O card** alongside Obsidian's existing **Add card** command.
- Adds **Use I/O card / Use standard card** to each ordinary card's context menu. Choices persist and support native undo/redo; creation is one undo step.
- Ordinary text, image and web cards default to native four-port behavior. Markdown-backed cards default to I/O. Existing hand-drawn I/O cards remain compatible.
- Old generated legends stay standard without rewriting their Canvas files. Native center connectors are hidden only on I/O cards.
- Mixed-mode I/O connections use each endpoint's card mode. The companion and layout tools share this geometry.
- An enabled older companion is upgraded when a diagram is opened through the tools, even if that diagram has only ordinary edges.
- Includes 16 native menu/card-mode checks and fixes the debugger's false detection of unrelated isolated Obsidian profiles.

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
