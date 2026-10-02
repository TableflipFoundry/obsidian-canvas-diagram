// Usage: node score.mjs <path/to/diagram.canvas> [--json]
// Opens the canvas in Obsidian (debug port), samples every edge along the curve
// Obsidian actually drew, and reports readability problems. 0 = clean.
import { connect, findVaultRoot, openCanvas, relToVault } from './lib/obsidian.mjs';

const [canvasFile, flag] = process.argv.slice(2);
if (!canvasFile) { console.error('usage: node score.mjs <diagram.canvas> [--json]'); process.exit(2); }
const canvasPath = relToVault(findVaultRoot(canvasFile), canvasFile);
const { browser, page } = await connect(findVaultRoot(canvasFile));
await openCanvas(page, canvasPath);

const geo = await page.evaluate(async () => {
  const canvas = app.workspace.getLeaf(false).view.canvas;
  const missingNotes = [...canvas.nodes.values()]
    .filter(n => n.getData().type === 'file' && !app.vault.getAbstractFileByPath(n.getData().file))
    .map(n => n.getData().file);
  const nodes = [...canvas.nodes.values()].map(n => ({
    id: n.id, x: n.x, y: n.y, w: n.width, h: n.height,
    name: n.file ? n.file.basename : (n.label ?? n.text ?? n.id), group: n.getData().type === 'group',
  }));
  const edges = [...canvas.edges.values()].map(e => {
    const p = e.path.display;
    const len = p.getTotalLength();
    const pts = [];
    for (let s = 0; s <= len; s += 6) { const q = p.getPointAtLength(s); pts.push([q.x, q.y]); }
    let label = null;
    const w = e.labelElement?.wrapperEl;
    if (w && e.label) {
      // Measure the visible label, not its wrapper (the wrapper is anchored top-left).
      // Obsidian scales label text by 1/sqrt(zoom scale); normalise to the size the
      // label has at a 60% overview zoom, matching optimize.mjs.
      const r = (w.querySelector('.canvas-path-label') ?? w).getBoundingClientRect();
      const c = canvas.posFromClient({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });
      const k = 1 / Math.sqrt(canvas.scale) / Math.sqrt(0.6);
      label = { x: c.x - r.width * k / 2, y: c.y - r.height * k / 2, w: r.width * k, h: r.height * k };
    }
    return { id: e.id, from: e.from.node.id, to: e.to.node.id, text: e.label || '', pts, label };
  });
  return { nodes, edges, missingNotes };
});
await browser.close(); // disconnects only; Obsidian stays open

// ---------- geometry ----------
const byId = new Map(geo.nodes.map(n => [n.id, n]));
const boxes = geo.nodes.filter(n => !n.group);
const inBox = ([x, y], b, pad = 0) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad;
const dist2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
const nearNode = (pt, id, r) => { const n = byId.get(id); return inBox(pt, n, r); };
const name = e => `${byId.get(e.from).name} -> ${byId.get(e.to).name}${e.text ? ` ("${e.text}")` : ''}`;
const segX = (p1, p2, p3, p4) => {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
  if (!d) return false;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
  const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  return t > 0 && t < 1 && u > 0 && u < 1;
};
// overlap must be at least 3px deep on both axes (ignores boxes that merely touch)
const boxOverlap = (a, b, d = 3) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > d &&
  Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > d;

const E = geo.edges;
const issues = { throughNode: [], overlap: [], crossing: [], labelOnNode: [], labelOnLabel: [], labelOnEdge: [] };

// 1. edge passes through a box it isn't attached to
for (const e of E) for (const b of boxes) {
  if (b.id === e.from || b.id === e.to) continue;
  const hits = e.pts.filter(p => inBox(p, b, -2)).length;
  if (hits) issues.throughNode.push({ edge: name(e), node: b.name, px: hits * 6 });
}

// 2. edges running on top of each other (ignore the zone next to a shared endpoint)
const TOL2 = 7 ** 2;
for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
  const a = E[i], b = E[j];
  const shared = [a.from, a.to].filter(id => id === b.from || id === b.to);
  let run = 0;
  for (const p of a.pts) {
    if (shared.some(id => nearNode(p, id, 45))) continue;
    if (b.pts.some(q => dist2(p, q) < TOL2)) run++;
  }
  if (run * 6 >= 24) issues.overlap.push({ a: name(a), b: name(b), px: run * 6 });
}

// 3. crossings (count once per pair, away from shared endpoints)
for (let i = 0; i < E.length; i++) for (let j = i + 1; j < E.length; j++) {
  const a = E[i], b = E[j];
  const shared = [a.from, a.to].filter(id => id === b.from || id === b.to);
  let crossed = false;
  for (let s = 1; s < a.pts.length && !crossed; s++) {
    if (shared.some(id => nearNode(a.pts[s], id, 45))) continue;
    for (let t = 1; t < b.pts.length; t++) if (segX(a.pts[s - 1], a.pts[s], b.pts[t - 1], b.pts[t])) { crossed = true; break; }
  }
  if (crossed) issues.crossing.push({ a: name(a), b: name(b) });
}

// 4. labels
const L = E.filter(e => e.label);
for (const e of L) {
  for (const b of boxes) if (boxOverlap(e.label, b)) issues.labelOnNode.push({
    edge: name(e), node: b.name,
    depth: `${Math.round(Math.min(e.label.x + e.label.w, b.x + b.w) - Math.max(e.label.x, b.x))}x${Math.round(Math.min(e.label.y + e.label.h, b.y + b.h) - Math.max(e.label.y, b.y))}px`,
  });
  for (const o of E) if (o !== e && o.pts.some(p => inBox(p, e.label, -1))) issues.labelOnEdge.push({ label: e.text, edge: name(o) });
}
for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++)
  if (boxOverlap(L[i].label, L[j].label)) issues.labelOnLabel.push({ a: L[i].text, b: L[j].text });

// 5. flow (diagrams read top to bottom)
issues.upward = []; issues.startNotAtTop = []; issues.tooBig = [];
issues.missingNote = geo.missingNotes.map(f => ({ file: f }));
const cy = n => n.y + n.h / 2;
for (const e of E) {
  const a = byId.get(e.from), b = byId.get(e.to);
  if (cy(b) < cy(a) - 20) issues.upward.push({ edge: name(e) });
}
const topY = Math.min(...boxes.map(b => b.y));
const incoming = new Set(E.map(e => e.to)), outgoing = new Set(E.map(e => e.from));
for (const b of boxes) {
  // a starting point: arrows leave it, none arrive. It should sit in the top row.
  if (outgoing.has(b.id) && !incoming.has(b.id) && b.y > topY + 40) issues.startNotAtTop.push({ node: b.name });
}
// (no size check: a diagram has as many boxes as its scope and depth need)

// ---------- score (lower is better; 0 = clean) ----------
// upward arrows are sometimes right (a reply or callback), so they cost little;
// the reviewer decides whether each one belongs.
const W = { throughNode: 10, overlap: 10, labelOnNode: 6, labelOnLabel: 6, labelOnEdge: 4, crossing: 1,
  upward: 2, startNotAtTop: 5, tooBig: 20, missingNote: 50 };
const score = Object.entries(W).reduce((s, [k, w]) => s + w * issues[k].length, 0);

if (flag === '--json') { console.log(JSON.stringify({ score, issues })); process.exit(0); }
console.log(`${canvasPath}\n  score ${score}  (0 = clean; lower is better)`);
const titles = {
  overlap: 'edges on top of each other', throughNode: 'edges through a box', labelOnNode: 'labels on a box',
  labelOnLabel: 'labels on labels', labelOnEdge: 'labels sitting on another edge', crossing: 'edge crossings',
  upward: 'arrows pointing upward (check each is a reply/callback)', startNotAtTop: 'starting points not in the top row',
  missingNote: 'boxes whose note Obsidian cannot find (shows as a file path, not the note)',
};
for (const k of Object.keys(titles)) {
  console.log(`  ${titles[k]}: ${issues[k].length}`);
  for (const it of issues[k].slice(0, 12)) console.log('     - ' + Object.values(it).join('  |  '));
}
