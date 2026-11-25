// Semantic layout constraints. This module has no Obsidian or machine-specific dependencies.
// The agent supplies meaning (spines, nearby helpers, shared-data uses); code places boxes.
import fs from 'node:fs';

const copy = value => structuredClone(value);
const GAP = 100;
const key = file => String(file ?? '').replace(/\\/g, '/');

export function readRelationships(canvasFile) {
  const file = canvasFile.replace(/\.canvas$/i, '.layout.json');
  if (!fs.existsSync(file)) return { file, plan: { version: 1 } };
  const plan = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  if (plan.version !== 1) throw new Error(`${file}: expected layout plan version 1`);
  return { file, plan };
}

function groupOf(canvas, node) {
  if (node.group) return node.group;
  return canvas.nodes.filter(g => g.type === 'group' && !g.id.startsWith('legend-') &&
    node.x >= g.x && node.y >= g.y && node.x + node.width <= g.x + g.width &&
    node.y + node.height <= g.y + g.height)
    .sort((a, b) => a.width * a.height - b.width * b.height)[0]?.id ?? null;
}

/** Add local views of shared data, retaining the same file and note-level edges. Idempotent. */
export function prepareRelationships(input, rawPlan, typeOf) {
  const canvas = copy(input), plan = copy(rawPlan);
  plan.spines ??= []; plan.supports ??= []; plan.rows ??= []; plan.references ??= [];
  for (const field of ['spines', 'supports', 'rows', 'references'])
    if (!Array.isArray(plan[field])) throw new Error(`layout.${field} must be an array`);
  const byId = new Map(canvas.nodes.map(n => [n.id, n]));
  const get = id => {
    const n = byId.get(id);
    if (!n || n.type === 'group') throw new Error(`layout: missing file node ${id}`);
    return n;
  };
  const usedEdges = new Set();
  let added = 0;
  for (const ref of plan.references) {
    const original = get(ref.node), anchor = get(ref.anchor);
    if (typeOf(original) !== 'data') throw new Error(`layout: references are for data notes (${ref.node})`);
    if (!Array.isArray(ref.edges) || !ref.edges.length) throw new Error(`layout: reference ${ref.node} needs explicit edge IDs`);
    const id = ref.id ?? `${original.id}--ref-${anchor.id}`;
    if (id === original.id) throw new Error('layout: a local reference needs its own node ID');
    let local = byId.get(id);
    if (local && key(local.file) !== key(original.file)) throw new Error(`layout: reference ID ${id} is already in use`);
    if (!local) {
      local = { ...copy(original), id, x: anchor.x, y: anchor.y };
      delete local.group;
      const group = groupOf(canvas, anchor);
      if (group) local.group = group;
      canvas.nodes.push(local); byId.set(id, local); added++;
    }
    for (const edgeId of ref.edges) {
      if (usedEdges.has(edgeId)) throw new Error(`layout: edge ${edgeId} belongs to two references`);
      usedEdges.add(edgeId);
      const edge = canvas.edges.find(e => e.id === edgeId);
      if (!edge) throw new Error(`layout: missing reference edge ${edgeId}`);
      const from = byId.get(edge.fromNode), to = byId.get(edge.toNode);
      const source = key(from?.file) === key(original.file), target = key(to?.file) === key(original.file);
      if (source === target) throw new Error(`layout: ${edgeId} must have exactly one endpoint at ${original.file}`);
      if ((source ? edge.toNode : edge.fromNode) !== anchor.id)
        throw new Error(`layout: ${edgeId} does not connect to reference anchor ${anchor.id}`);
      if (source) edge.fromNode = id; else edge.toNode = id;
    }
    plan.supports.push({ node: id, anchor: anchor.id, side: ref.side ?? 'right' });
  }
  for (const spine of plan.spines) {
    if (!Array.isArray(spine) || spine.length < 2) throw new Error('layout: a spine needs at least two node IDs');
    spine.forEach(get);
    for (let i = 1; i < spine.length; i++)
      if (!canvas.edges.some(e => e.fromNode === spine[i - 1] && e.toNode === spine[i]))
        throw new Error(`layout: spine has no directed connection ${spine[i - 1]} -> ${spine[i]}`);
  }
  const sides = new Set(), supported = new Set();
  for (const support of plan.supports) {
    const node = get(support.node), anchor = get(support.anchor);
    if (node === anchor || !['left', 'right'].includes(support.side)) throw new Error('layout: helper needs a different anchor and side left/right');
    if (!canvas.edges.some(e => e.fromNode === node.id && e.toNode === anchor.id || e.toNode === node.id && e.fromNode === anchor.id))
      throw new Error(`layout: helper ${node.id} has no connection to ${anchor.id}`);
    const side = `${anchor.id}:${support.side}`;
    if (sides.has(side) || supported.has(node.id))
      throw new Error(`layout: conflicting helper placement at ${node.id}; use one immediate helper per side and a sibling row for additional branches`);
    sides.add(side); supported.add(node.id);
  }
  for (const row of plan.rows) {
    if (!Array.isArray(row) || row.length < 2) throw new Error('layout: a sibling row needs at least two IDs');
    row.forEach(get);
  }
  // Feature groups remain intact; attach a shared reference to its user's group instead.
  for (const ids of [...plan.spines, ...plan.rows, ...plan.supports.map(s => [s.anchor, s.node])])
    if (new Set(ids.map(id => groupOf(canvas, get(id)))).size > 1)
      throw new Error(`layout: constraints cannot span feature groups (${ids.join(', ')}); use local references or separate spines`);
  assertNoteMeaning(input, canvas);
  return { canvas, plan, added };
}

export function assertNoteMeaning(before, after) {
  const signature = (e, c) => {
    const { fromSide, toSide, fromNode, toNode, ...rest } = e;
    const endpoint = id => { const n = c.nodes.find(x => x.id === id); return n?.type === 'file' ? key(n.file) : id; };
    return JSON.stringify({ ...rest, from: endpoint(fromNode), to: endpoint(toNode) });
  };
  if (before.edges.length !== after.edges.length) throw new Error('layout changed the number of connections');
  for (const e of before.edges) {
    const now = after.edges.find(x => x.id === e.id);
    if (!now || signature(e, before) !== signature(now, after)) throw new Error(`layout changed connection ${e.id}`);
  }
  for (const n of before.nodes) {
    const now = after.nodes.find(x => x.id === n.id);
    const strip = ({ x, y, ...rest }) => rest;
    if (!now || JSON.stringify(strip(n)) !== JSON.stringify(strip(now))) throw new Error(`layout changed node ${n.id}`);
  }
  for (const n of after.nodes.filter(n => !before.nodes.some(b => b.id === n.id)))
    if (n.type !== 'file' || !before.nodes.some(b => key(b.file) === key(n.file))) throw new Error('layout added an unrelated subject');
}

export function selectRelationships(plan, ids) {
  return {
    spines: plan.spines.filter(s => s.every(id => ids.has(id))),
    supports: plan.supports.filter(s => ids.has(s.node) && ids.has(s.anchor)),
    rows: plan.rows.filter(r => r.every(id => ids.has(id))),
  };
}

/** Default simple-chain alignment plus explicit local groups, after automatic layout. */
export function refineRelationships(input, plan = {}) {
  const canvas = copy(input), nodes = canvas.nodes.filter(n => n.type !== 'group');
  if (!nodes.length) return canvas;
  const byId = new Map(nodes.map(n => [n.id, n]));
  const edges = canvas.edges.filter(e => byId.has(e.fromNode) && byId.has(e.toNode));
  const spines = copy(plan.spines ?? []), supports = plan.supports ?? [], rows = plan.rows ?? [];
  const explicit = new Set(spines.flat());
  for (const s of supports) { explicit.add(s.node); explicit.add(s.anchor); }
  const incoming = id => edges.filter(e => e.toNode === id);
  const outgoing = id => edges.filter(e => e.fromNode === id);
  const simple = edges.filter(e => !byId.get(e.fromNode)._data && !byId.get(e.toNode)._data &&
    outgoing(e.fromNode).length === 1 && incoming(e.toNode).length === 1 &&
    byId.get(e.toNode).y > byId.get(e.fromNode).y && !explicit.has(e.fromNode) && !explicit.has(e.toNode));
  const next = new Map(simple.map(e => [e.fromNode, e.toNode])), destinations = new Set(next.values());
  for (const start of next.keys()) if (!destinations.has(start)) {
    const chain = [start]; while (next.has(chain.at(-1))) chain.push(next.get(chain.at(-1)));
    spines.push(chain);
  }
  // Horizontal equations connect entire spines and helpers, so packing moves the
  // whole local group rather than breaking its alignment to solve a collision.
  const equations = new Map(nodes.map(n => [n.id, []]));
  const relate = (a, b, delta) => { equations.get(a).push([b, delta]); equations.get(b).push([a, -delta]); };
  for (const spine of spines) for (const id of spine.slice(1)) relate(spine[0], id, 0);
  const occupiedSides = new Map();
  for (const s of supports) {
    const a = byId.get(s.anchor), n = byId.get(s.node), k = `${s.anchor}:${s.side}`;
    const sign = s.side === 'left' ? -1 : 1;
    const offset = occupiedSides.get(k) ?? a.width / 2;
    const label = edges.filter(e => e.fromNode === a.id && e.toNode === n.id || e.fromNode === n.id && e.toNode === a.id)
      .reduce((length, e) => Math.max(length, (e.label ?? '').length), 0);
    // Match the label estimate used by the optimizer at a 60% reading zoom.
    // "Close" must still leave room to read the connection's existing label.
    const gap = label ? Math.max(GAP, Math.ceil((label * 10.1 + 8) / Math.sqrt(0.6)) + 40) : GAP;
    relate(a.id, n.id, sign * (offset + gap + n.width / 2));
    occupiedSides.set(k, offset + gap + n.width);
  }
  // Row unions: helpers are beside their caller, peers are genuinely the same rank.
  const parent = new Map(nodes.map(n => [n.id, n.id]));
  const root = id => parent.get(id) === id ? id : (parent.set(id, root(parent.get(id))), parent.get(id));
  const join = (a, b) => parent.set(root(b), root(a));
  supports.forEach(s => join(s.anchor, s.node));
  rows.forEach(r => r.slice(1).forEach(id => join(r[0], id)));
  const rank = new Map();
  for (const n of nodes) { const r = root(n.id); if (!rank.has(r)) rank.set(r, []); rank.get(r).push(n); }
  const anchorIds = new Set(supports.map(s => s.anchor));
  const ranks = [...rank.values()].map(ms => ({ ms, y: ms.find(n => anchorIds.has(n.id))?.y ?? ms[0].y }));
  ranks.sort((a, b) => a.y - b.y);
  let bottom = -Infinity, previousY = -Infinity, rowY = 0;
  for (const r of ranks) {
    if (r.y - previousY > 40) { rowY = Math.max(r.y, bottom + 140); previousY = r.y; }
    r.ms.forEach(n => n.y = rowY);
    bottom = Math.max(bottom, rowY + Math.max(...r.ms.map(n => n.height)));
  }
  const priority = [...spines.map(s => s[0]), ...supports.map(s => s.anchor), ...nodes.map(n => n.id)];
  const visited = new Set(), components = [];
  for (const start of priority) {
    if (visited.has(start)) continue;
    const offsets = new Map([[start, 0]]), queue = [start]; visited.add(start);
    for (let i = 0; i < queue.length; i++) for (const [id, delta] of equations.get(queue[i])) {
      const offset = offsets.get(queue[i]) + delta;
      if (offsets.has(id) && Math.abs(offsets.get(id) - offset) > 1)
        throw new Error(`layout: contradictory spine/helper placement at ${id}`);
      if (!offsets.has(id)) { offsets.set(id, offset); visited.add(id); queue.push(id); }
    }
    const cx = byId.get(start).x + byId.get(start).width / 2;
    const ms = queue.map(id => byId.get(id));
    ms.forEach(n => n.x = cx + offsets.get(n.id) - n.width / 2);
    components.push(ms);
  }
  const overlaps = (a, b, dx = 0) => a.y < b.y + b.height + 70 && a.y + a.height + 70 > b.y &&
    a.x + dx < b.x + b.width + GAP && a.x + a.width + dx + GAP > b.x;
  const placed = [];
  for (const ms of components) {
    // ELK may place an independent branch very far from its caller. Prefer
    // the already placed caller's column before finding the nearest free slot;
    // translate the entire chain, preserving all internal helper relationships.
    const own = new Set(ms.map(n => n.id)), settled = new Set(placed.map(n => n.id));
    const incoming = edges.filter(e => own.has(e.toNode) && settled.has(e.fromNode));
    const ties = incoming.length ? incoming : edges.filter(e => own.has(e.fromNode) && settled.has(e.toNode));
    const shifts = ties.map(e => {
      const local = byId.get(own.has(e.toNode) ? e.toNode : e.fromNode);
      const neighbor = byId.get(own.has(e.toNode) ? e.fromNode : e.toNode);
      return neighbor.x + neighbor.width / 2 - local.x - local.width / 2;
    }).sort((a, b) => a - b);
    if (shifts.length) ms.forEach(n => n.x += shifts[(shifts.length - 1) >> 1]);
    for (let i = 0; i < ms.length; i++) for (const b of ms.slice(i + 1))
      if (overlaps(ms[i], b)) throw new Error(`layout: constraints overlap ${ms[i].id} and ${b.id}; choose another helper side`);
    const candidates = new Set([0]);
    for (const a of ms) for (const b of placed) if (a.y < b.y + b.height + 70 && a.y + a.height + 70 > b.y) {
      candidates.add(b.x + b.width + GAP - a.x);
      candidates.add(b.x - GAP - a.width - a.x);
    }
    const dx = [...candidates].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)
      .find(delta => ms.every(a => placed.every(b => !overlaps(a, b, delta))));
    if (dx === undefined) throw new Error('layout: could not pack relationship groups without collisions');
    ms.forEach(n => n.x += dx); placed.push(...ms);
  }
  for (const e of edges) {
    const a = byId.get(e.fromNode), b = byId.get(e.toNode);
    if (Math.abs(a.y - b.y) <= 40) [e.fromSide, e.toSide] = a.x < b.x ? ['right', 'left'] : ['left', 'right'];
    else [e.fromSide, e.toSide] = a.y < b.y ? ['bottom', 'top'] : ['top', 'bottom'];
  }
  return canvas;
}
