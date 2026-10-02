// Usage: node layout.mjs <in.canvas> <out.canvas> [DOWN|RIGHT]
// Re-positions every node of an Obsidian .canvas with ELK (layered layout).
// Only geometry changes: x, y, group width/height, and edge fromSide/toSide.
// Group membership = nodes whose box sits inside a group box in the input.
import fs from 'node:fs';
import ELK from 'elkjs/lib/elk.bundled.js';

const [inPath, outPath, direction = 'DOWN'] = process.argv.slice(2);
const canvas = JSON.parse(fs.readFileSync(inPath, 'utf8').replace(/^\uFEFF/, ''));
const nodes = canvas.nodes ?? [];
const edges = canvas.edges ?? [];

// --- group membership by containment (smallest containing group wins) ---
const groups = nodes.filter(n => n.type === 'group');
const inside = (a, g) => a !== g && a.x >= g.x && a.y >= g.y &&
  a.x + a.width <= g.x + g.width && a.y + a.height <= g.y + g.height;
const parentOf = new Map();
for (const n of nodes) {
  const owners = groups.filter(g => inside(n, g)).sort((a, b) => a.width * a.height - b.width * b.height);
  if (owners[0]) parentOf.set(n.id, owners[0].id);
}

// --- build ELK graph ---
const labelSize = text => ({ width: Math.ceil(text.length * 7.5) + 16, height: 22 });
const baseOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': direction,
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
  'elk.edgeRouting': 'SPLINES',
  'elk.layered.spacing.nodeNodeBetweenLayers': '90',
  'elk.spacing.nodeNode': '70',
  'elk.spacing.edgeNode': '30',
  'elk.spacing.edgeEdge': '20',
  'elk.spacing.edgeLabel': '6',
  'elk.edgeLabels.inline': 'true',
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
  'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
};
const elkNode = new Map();
const makeElk = n => {
  const e = { id: n.id, width: n.width, height: n.height, children: [] };
  if (n.type === 'group') {
    e.layoutOptions = { 'elk.padding': '[top=50,left=30,bottom=30,right=30]' };
    delete e.width; delete e.height;
  }
  elkNode.set(n.id, e);
  return e;
};
nodes.forEach(makeElk);
const root = { id: '__root', layoutOptions: baseOptions, children: [], edges: [] };
for (const n of nodes) {
  const p = parentOf.get(n.id);
  (p ? elkNode.get(p).children : root.children).push(elkNode.get(n.id));
}
root.edges = edges.map(e => ({
  id: e.id, sources: [e.fromNode], targets: [e.toNode],
  labels: e.label ? [{ text: e.label, ...labelSize(e.label) }] : [],
}));

const result = await new ELK().layout(root);

// --- read back absolute positions ---
const abs = new Map();
const walk = (n, ox, oy) => {
  for (const c of n.children ?? []) {
    const x = ox + c.x, y = oy + c.y;
    abs.set(c.id, { x, y, width: c.width, height: c.height });
    walk(c, x, y);
  }
};
walk(result, 0, 0);

for (const n of nodes) {
  const a = abs.get(n.id);
  n.x = Math.round(a.x); n.y = Math.round(a.y);
  if (n.type === 'group') { n.width = Math.round(a.width); n.height = Math.round(a.height); }
}

// --- edge sides: face the other box (dominant axis of center-to-center vector) ---
const byId = new Map(nodes.map(n => [n.id, n]));
const center = n => ({ x: n.x + n.width / 2, y: n.y + n.height / 2 });
const sideToward = (from, to) => {
  const a = center(from), b = center(to);
  const dx = (b.x - a.x) / from.width, dy = (b.y - a.y) / from.height; // normalise by box shape
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
};
for (const e of edges) {
  const f = byId.get(e.fromNode), t = byId.get(e.toNode);
  e.fromSide = sideToward(f, t);
  e.toSide = sideToward(t, f);
}

fs.writeFileSync(outPath, JSON.stringify(canvas, null, '\t'));
const w = Math.max(...nodes.map(n => n.x + n.width)), h = Math.max(...nodes.map(n => n.y + n.height));
console.log(`laid out ${nodes.length} nodes, ${edges.length} edges; ${direction}; size ${w}x${h}`);
